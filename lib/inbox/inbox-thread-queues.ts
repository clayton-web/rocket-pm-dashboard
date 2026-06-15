import type { InboxThreadDisplayRow } from "@/lib/inbox/inbox-thread-display";
import {
  categoryPriorityIndex,
  getPrimaryStakeholderCategory,
} from "@/lib/inbox/thread-category-assignments";

export const INBOX_PREVIEW_LIMIT = 5;

export type InboxQueueParam =
  | "needs_reply"
  | "needs_review"
  | "classification_review"
  | "unlinked"
  | "recent";

export type InboxCommandCenterSummary = {
  totalUnique: number;
  unreadInbound: number;
  needsReply: number;
  unlinked: number;
  reviewRequired: number;
  classificationReview: number;
  connectionIssues: number;
};

export type InboxCommandCenterSection = {
  total: number;
  preview: InboxThreadDisplayRow[];
};

function sortByLastMessageDesc(rows: InboxThreadDisplayRow[]): InboxThreadDisplayRow[] {
  return [...rows].sort((a, b) => {
    const aTime = a.lastMessageAt ?? "";
    const bTime = b.lastMessageAt ?? "";
    return bTime.localeCompare(aTime);
  });
}

function sortByDraftCreatedDesc(rows: InboxThreadDisplayRow[]): InboxThreadDisplayRow[] {
  return [...rows].sort((a, b) => {
    const aTime = a.draftCreatedAt ?? "";
    const bTime = b.draftCreatedAt ?? "";
    return bTime.localeCompare(aTime);
  });
}

function sortByClassificationAttemptDesc(rows: InboxThreadDisplayRow[]): InboxThreadDisplayRow[] {
  return [...rows].sort((a, b) => {
    const aTime = a.lastClassificationAttemptAt ?? "";
    const bTime = b.lastClassificationAttemptAt ?? "";
    return bTime.localeCompare(aTime);
  });
}

function previewSection(rows: InboxThreadDisplayRow[]): InboxCommandCenterSection {
  return {
    total: rows.length,
    preview: rows.slice(0, INBOX_PREVIEW_LIMIT),
  };
}

/** Needs-reply queue: stakeholder priority ascending, then oldest waiting first. */
export function sortNeedsReplyByStakeholderThenAge(
  rows: InboxThreadDisplayRow[],
): InboxThreadDisplayRow[] {
  return [...rows].sort((left, right) => {
    const leftPriority = categoryPriorityIndex(getPrimaryStakeholderCategory(left.categories));
    const rightPriority = categoryPriorityIndex(getPrimaryStakeholderCategory(right.categories));
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;

    const leftTime = left.lastMessageAt ?? "";
    const rightTime = right.lastMessageAt ?? "";
    return leftTime.localeCompare(rightTime);
  });
}

export function filterNeedsReply(rows: InboxThreadDisplayRow[]): InboxThreadDisplayRow[] {
  return sortNeedsReplyByStakeholderThenAge(rows.filter((row) => row.needsReply));
}

export function filterNeedsReview(rows: InboxThreadDisplayRow[]): InboxThreadDisplayRow[] {
  return sortByDraftCreatedDesc(rows.filter((row) => row.reviewRequired));
}

export function filterClassificationReview(rows: InboxThreadDisplayRow[]): InboxThreadDisplayRow[] {
  return sortByClassificationAttemptDesc(rows.filter((row) => row.needsClassificationReview));
}

export function filterUnlinked(rows: InboxThreadDisplayRow[]): InboxThreadDisplayRow[] {
  return sortByLastMessageDesc(rows.filter((row) => row.unlinked));
}

export function filterRecent(rows: InboxThreadDisplayRow[]): InboxThreadDisplayRow[] {
  return sortByLastMessageDesc(rows);
}

export function computeInboxSummary(
  rows: InboxThreadDisplayRow[],
  connectionIssues: number,
  classificationReviewCount: number,
): InboxCommandCenterSummary {
  const attentionIds = new Set<string>();

  let unreadInbound = 0;
  let needsReply = 0;
  let unlinked = 0;
  let reviewRequired = 0;

  for (const row of rows) {
    if (row.unreadInbound) {
      unreadInbound += 1;
      attentionIds.add(row.id);
    }
    if (row.needsReply) {
      needsReply += 1;
      attentionIds.add(row.id);
    }
    if (row.unlinked) {
      unlinked += 1;
      attentionIds.add(row.id);
    }
    if (row.reviewRequired) {
      reviewRequired += 1;
      attentionIds.add(row.id);
    }
    if (row.needsClassificationReview) {
      attentionIds.add(row.id);
    }
  }

  return {
    totalUnique: attentionIds.size,
    unreadInbound,
    needsReply,
    unlinked,
    reviewRequired,
    classificationReview: classificationReviewCount,
    connectionIssues,
  };
}

export function buildInboxQueueSections(
  rows: InboxThreadDisplayRow[],
  classificationReviewPreview: InboxThreadDisplayRow[],
  classificationReviewTotal: number,
): {
  needsReply: InboxCommandCenterSection;
  needsReview: InboxCommandCenterSection;
  classificationReview: InboxCommandCenterSection;
  unlinked: InboxCommandCenterSection;
  recentActivity: InboxCommandCenterSection;
} {
  return {
    needsReply: previewSection(filterNeedsReply(rows)),
    needsReview: previewSection(filterNeedsReview(rows)),
    classificationReview: {
      total: classificationReviewTotal,
      preview: classificationReviewPreview.slice(0, INBOX_PREVIEW_LIMIT),
    },
    unlinked: previewSection(filterUnlinked(rows)),
    recentActivity: previewSection(filterRecent(rows)),
  };
}

export function filterRowsByQueue(
  rows: InboxThreadDisplayRow[],
  queue: InboxQueueParam,
): InboxThreadDisplayRow[] {
  switch (queue) {
    case "needs_reply":
      return filterNeedsReply(rows);
    case "needs_review":
      return filterNeedsReview(rows);
    case "classification_review":
      return filterClassificationReview(rows);
    case "unlinked":
      return filterUnlinked(rows);
    case "recent":
      return filterRecent(rows);
  }
}

export function isInboxQueueParam(value: string | undefined): value is InboxQueueParam {
  return (
    value === "needs_reply" ||
    value === "needs_review" ||
    value === "classification_review" ||
    value === "unlinked" ||
    value === "recent"
  );
}
