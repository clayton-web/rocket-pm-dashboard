import type { ConnectedEmailAccountStatus } from "@prisma/client";
import {
  computeCrateCounts,
  filterRowsByCrate,
  inboxCrateLabel,
  type InboxCrateCounts,
  type InboxCrateFilter,
} from "@/lib/inbox/email-thread-category";
import {
  buildInboxQueueSections,
  computeInboxSummary,
  filterRowsByQueue,
  type InboxCommandCenterSection,
  type InboxCommandCenterSummary,
  type InboxQueueParam,
} from "@/lib/inbox/inbox-thread-queues";
import { buildInboxThreadDisplayRows } from "@/lib/inbox/inbox-thread-display";
import {
  loadInboxThreadsForMailbox,
  loadLatestDraftsByThreadId,
  loadLatestMessagesByThreadId,
} from "@/lib/inbox/inbox-thread-data";
import type { InboxThreadDisplayRow } from "@/lib/inbox/inbox-thread-display";

export type InboxCommandCenterData = {
  summary: InboxCommandCenterSummary;
  crateCounts: InboxCrateCounts;
  needsReply: InboxCommandCenterSection;
  needsReview: InboxCommandCenterSection;
  unlinked: InboxCommandCenterSection;
  recentActivity: InboxCommandCenterSection;
  filteredThreads: InboxThreadDisplayRow[] | null;
  filteredViewTitle: string | null;
};

export async function getInboxCommandCenter(args: {
  organizationId: string;
  mailboxId: string;
  mailboxStatus: ConnectedEmailAccountStatus;
  queue?: InboxQueueParam | null;
  crate?: InboxCrateFilter | null;
}): Promise<InboxCommandCenterData> {
  const threads = await loadInboxThreadsForMailbox(args.organizationId, args.mailboxId);
  const threadIds = threads.map((t) => t.id);

  const [latestMessages, latestDrafts] = await Promise.all([
    loadLatestMessagesByThreadId(threadIds),
    loadLatestDraftsByThreadId(args.organizationId, threadIds),
  ]);

  const rows = await buildInboxThreadDisplayRows(
    args.organizationId,
    threads,
    latestMessages,
    latestDrafts,
  );

  const connectionIssues = args.mailboxStatus !== "CONNECTED" ? 1 : 0;
  const summary = computeInboxSummary(rows, connectionIssues);
  const sections = buildInboxQueueSections(rows);
  const crateCounts = computeCrateCounts(rows);

  let filteredThreads: InboxThreadDisplayRow[] | null = null;
  let filteredViewTitle: string | null = null;

  if (args.crate) {
    filteredThreads = filterRowsByCrate(rows, args.crate);
    filteredViewTitle = inboxCrateLabel(args.crate);
  } else if (args.queue) {
    filteredThreads = filterRowsByQueue(rows, args.queue);
    const titles: Record<InboxQueueParam, string> = {
      needs_reply: "Needs reply",
      needs_review: "Needs review",
      unlinked: "Unlinked",
      recent: "Recent activity",
    };
    filteredViewTitle = titles[args.queue];
  }

  return {
    summary,
    crateCounts,
    needsReply: sections.needsReply,
    needsReview: sections.needsReview,
    unlinked: sections.unlinked,
    recentActivity: sections.recentActivity,
    filteredThreads,
    filteredViewTitle,
  };
}
