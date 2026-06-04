import type { ConnectedEmailAccountStatus } from "@prisma/client";
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
  needsReply: InboxCommandCenterSection;
  needsReview: InboxCommandCenterSection;
  unlinked: InboxCommandCenterSection;
  recentActivity: InboxCommandCenterSection;
  filteredThreads: InboxThreadDisplayRow[] | null;
};

export async function getInboxCommandCenter(args: {
  organizationId: string;
  mailboxId: string;
  mailboxStatus: ConnectedEmailAccountStatus;
  queue?: InboxQueueParam | null;
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

  return {
    summary,
    needsReply: sections.needsReply,
    needsReview: sections.needsReview,
    unlinked: sections.unlinked,
    recentActivity: sections.recentActivity,
    filteredThreads: args.queue ? filterRowsByQueue(rows, args.queue) : null,
  };
}
