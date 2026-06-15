import prisma from "@/lib/db/prisma";
import { classificationReviewThreadWhere } from "@/lib/inbox/classification-review";
import {
  getEffectiveCategories,
  type ThreadCategoryAssignment,
} from "@/lib/inbox/thread-category-assignments";
import {
  mapAssignmentGroupByToCrateCounts,
  type InboxCrateCounts,
} from "@/lib/inbox/email-thread-category";
import { parseDraftClassification } from "@/lib/inbox/draft-classification";
import type { EmailThreadCategory, EmailThreadCategoryAssignmentSource } from "@prisma/client";

const INBOX_THREAD_SELECT = {
  id: true,
  subject: true,
  snippet: true,
  lastMessageAt: true,
  isUnread: true,
  participantEmails: true,
  contextLinks: true,
  category: true,
  categorySource: true,
  categoryConfidence: true,
  categoryAiReason: true,
  lastClassificationAttemptAt: true,
  categoryAssignments: {
    select: {
      category: true,
      source: true,
      reason: true,
      assignedAt: true,
    },
  },
} as const;

export type InboxThreadRecord = {
  id: string;
  subject: string | null;
  snippet: string | null;
  lastMessageAt: Date | null;
  isUnread: boolean;
  participantEmails: string[];
  contextLinks: unknown;
  category: EmailThreadCategory;
  categorySource: string | null;
  categoryConfidence: number | null;
  categoryAiReason: string | null;
  lastClassificationAttemptAt: Date | null;
  categoryAssignments: ThreadCategoryAssignment[];
};

export type LatestMessageSnapshot = {
  isOutbound: boolean;
  isUnread: boolean;
  sentAt: Date;
};

export type LatestDraftSnapshot = {
  id: string;
  classification: unknown;
  createdAt: Date;
  reviewRequired: boolean;
};

function mapAssignments(
  rows: Array<{
    category: EmailThreadCategory;
    source: EmailThreadCategoryAssignmentSource;
    reason: string | null;
    assignedAt: Date;
  }>,
): ThreadCategoryAssignment[] {
  return rows.map((row) => ({
    category: row.category,
    source: row.source,
    reason: row.reason,
    assignedAt: row.assignedAt,
  }));
}

function mapThreadRecord(
  row: Omit<InboxThreadRecord, "categoryAssignments"> & {
    categoryAssignments: Array<{
      category: EmailThreadCategory;
      source: EmailThreadCategoryAssignmentSource;
      reason: string | null;
      assignedAt: Date;
    }>;
  },
): InboxThreadRecord {
  return {
    ...row,
    categoryAssignments: mapAssignments(row.categoryAssignments),
  };
}

export async function loadInboxThreadsForMailbox(
  organizationId: string,
  mailboxId: string,
): Promise<InboxThreadRecord[]> {
  const rows = await prisma.emailThread.findMany({
    where: {
      organizationId,
      connectedAccountId: mailboxId,
    },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    select: INBOX_THREAD_SELECT,
  });

  return rows.map(mapThreadRecord);
}

export async function loadCrateCountsForMailbox(
  organizationId: string,
  mailboxId: string,
): Promise<InboxCrateCounts> {
  const [groups, totalThreads] = await Promise.all([
    prisma.emailThreadCategoryAssignment.groupBy({
      by: ["category"],
      where: {
        thread: {
          organizationId,
          connectedAccountId: mailboxId,
        },
      },
      _count: { _all: true },
    }),
    prisma.emailThread.count({
      where: {
        organizationId,
        connectedAccountId: mailboxId,
      },
    }),
  ]);

  const assignmentCounts = mapAssignmentGroupByToCrateCounts(groups, totalThreads);

  if (groups.length > 0) {
    return assignmentCounts;
  }

  const legacyGroups = await prisma.emailThread.groupBy({
    by: ["category"],
    where: {
      organizationId,
      connectedAccountId: mailboxId,
    },
    _count: { _all: true },
  });

  const counts: InboxCrateCounts = {
    LANDLORD_COMMUNICATION: 0,
    TENANT_COMMUNICATION: 0,
    STRATA: 0,
    TENANT_INQUIRY: 0,
    UNCATEGORIZED: 0,
    all: totalThreads,
  };

  for (const group of legacyGroups) {
    counts[group.category] = group._count._all;
  }

  return counts;
}

export async function countClassificationReviewThreads(
  organizationId: string,
  mailboxId: string,
): Promise<number> {
  return prisma.emailThread.count({
    where: classificationReviewThreadWhere(organizationId, mailboxId),
  });
}

export async function loadClassificationReviewThreadsForMailbox(
  organizationId: string,
  mailboxId: string,
  take: number,
): Promise<InboxThreadRecord[]> {
  const rows = await prisma.emailThread.findMany({
    where: classificationReviewThreadWhere(organizationId, mailboxId),
    orderBy: { lastClassificationAttemptAt: "desc" },
    take,
    select: INBOX_THREAD_SELECT,
  });

  return rows.map(mapThreadRecord);
}

export async function loadLatestMessagesByThreadId(
  threadIds: string[],
): Promise<Map<string, LatestMessageSnapshot>> {
  const map = new Map<string, LatestMessageSnapshot>();
  if (threadIds.length === 0) return map;

  const messages = await prisma.emailMessage.findMany({
    where: { threadId: { in: threadIds } },
    orderBy: { sentAt: "desc" },
    select: {
      threadId: true,
      isOutbound: true,
      isUnread: true,
      sentAt: true,
    },
  });

  for (const message of messages) {
    if (!map.has(message.threadId)) {
      map.set(message.threadId, {
        isOutbound: message.isOutbound,
        isUnread: message.isUnread,
        sentAt: message.sentAt,
      });
    }
  }

  return map;
}

export async function loadLatestDraftsByThreadId(
  organizationId: string,
  threadIds: string[],
): Promise<Map<string, LatestDraftSnapshot>> {
  const map = new Map<string, LatestDraftSnapshot>();
  if (threadIds.length === 0) return map;

  const drafts = await prisma.aiDraftResponse.findMany({
    where: {
      organizationId,
      threadId: { in: threadIds },
      status: "DRAFT",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      threadId: true,
      classification: true,
      createdAt: true,
    },
  });

  for (const draft of drafts) {
    if (!draft.threadId || map.has(draft.threadId)) continue;
    const flags = parseDraftClassification(draft.classification);
    map.set(draft.threadId, {
      id: draft.id,
      classification: draft.classification,
      createdAt: draft.createdAt,
      reviewRequired: flags.reviewRequired,
    });
  }

  return map;
}

export { getEffectiveCategories };
