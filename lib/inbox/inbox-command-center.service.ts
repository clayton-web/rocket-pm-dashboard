import type { ConnectedEmailAccountStatus } from "@prisma/client";
import {
  computeCrateNeedsReplyCounts,
  filterRowsByCrate,
  inboxCrateLabel,
  type InboxCrateActionCounts,
  type InboxCrateCounts,
  type InboxCrateFilter,
} from "@/lib/inbox/email-thread-category";
import {
  buildInboxQueueSections,
  buildStakeholderBinSections,
  computeInboxSummary,
  filterRowsByQueue,
  INBOX_PREVIEW_LIMIT,
  type InboxCommandCenterSection,
  type InboxCommandCenterSummary,
  type InboxQueueParam,
  type StakeholderBinSection,
} from "@/lib/inbox/inbox-thread-queues";
import { buildInboxThreadDisplayRows, type InboxThreadDisplayRow } from "@/lib/inbox/inbox-thread-display";
import {
  countClassificationReviewThreads,
  loadClassificationReviewThreadsForMailbox,
  loadCrateCountsForMailbox,
  loadInboxThreadsForMailbox,
  loadLatestDraftsByThreadId,
  loadLatestMessagesByThreadId,
  type InboxThreadRecord,
} from "@/lib/inbox/inbox-thread-data";

export type InboxCommandCenterData = {
  summary: InboxCommandCenterSummary;
  crateCounts: InboxCrateCounts;
  crateActionCounts: InboxCrateActionCounts;
  stakeholderBins: StakeholderBinSection[];
  needsReview: InboxCommandCenterSection;
  classificationReview: InboxCommandCenterSection;
  unlinked: InboxCommandCenterSection;
  recentActivity: InboxCommandCenterSection;
  filteredThreads: InboxThreadDisplayRow[] | null;
  filteredViewTitle: string | null;
};

async function buildDisplayRowsForThreads(
  organizationId: string,
  threads: InboxThreadRecord[],
): Promise<InboxThreadDisplayRow[]> {
  const threadIds = threads.map((thread) => thread.id);
  const [latestMessages, latestDrafts] = await Promise.all([
    loadLatestMessagesByThreadId(threadIds),
    loadLatestDraftsByThreadId(organizationId, threadIds),
  ]);

  return buildInboxThreadDisplayRows(organizationId, threads, latestMessages, latestDrafts);
}

export async function getInboxCommandCenter(args: {
  organizationId: string;
  mailboxId: string;
  mailboxStatus: ConnectedEmailAccountStatus;
  queue?: InboxQueueParam | null;
  crate?: InboxCrateFilter | null;
}): Promise<InboxCommandCenterData> {
  const [recentThreads, crateCounts, classificationReviewCount] = await Promise.all([
    loadInboxThreadsForMailbox(args.organizationId, args.mailboxId),
    loadCrateCountsForMailbox(args.organizationId, args.mailboxId),
    countClassificationReviewThreads(args.organizationId, args.mailboxId),
  ]);

  const rows = await buildDisplayRowsForThreads(args.organizationId, recentThreads);

  const classificationReviewThreads = await loadClassificationReviewThreadsForMailbox(
    args.organizationId,
    args.mailboxId,
    INBOX_PREVIEW_LIMIT,
  );
  const classificationReviewPreview = await buildDisplayRowsForThreads(
    args.organizationId,
    classificationReviewThreads,
  );

  const connectionIssues = args.mailboxStatus !== "CONNECTED" ? 1 : 0;
  const summary = computeInboxSummary(rows, connectionIssues, classificationReviewCount);
  const crateActionCounts = computeCrateNeedsReplyCounts(rows);
  const stakeholderBins = buildStakeholderBinSections({ rows, crateActionCounts, crateCounts });
  const sections = buildInboxQueueSections(
    rows,
    classificationReviewPreview,
    classificationReviewCount,
  );

  let filteredThreads: InboxThreadDisplayRow[] | null = null;
  let filteredViewTitle: string | null = null;

  if (args.crate) {
    filteredThreads = filterRowsByCrate(rows, args.crate);
    filteredViewTitle = inboxCrateLabel(args.crate);
  } else if (args.queue) {
    if (args.queue === "classification_review") {
      const reviewThreads = await loadClassificationReviewThreadsForMailbox(
        args.organizationId,
        args.mailboxId,
        100,
      );
      filteredThreads = await buildDisplayRowsForThreads(args.organizationId, reviewThreads);
    } else {
      filteredThreads = filterRowsByQueue(rows, args.queue);
    }

    const titles: Record<InboxQueueParam, string> = {
      needs_reply: "Needs reply",
      needs_review: "Needs review",
      classification_review: "Classification Review",
      unlinked: "Unlinked",
      recent: "Recent activity",
    };
    filteredViewTitle = titles[args.queue];
  }

  return {
    summary,
    crateCounts,
    crateActionCounts,
    stakeholderBins,
    needsReview: sections.needsReview,
    classificationReview: sections.classificationReview,
    unlinked: sections.unlinked,
    recentActivity: sections.recentActivity,
    filteredThreads,
    filteredViewTitle,
  };
}
