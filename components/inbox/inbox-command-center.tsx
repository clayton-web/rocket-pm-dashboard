"use client";

import { FOCUS_RING } from "@/components/portal/focus";
import {
  FormField,
  FormSection,
  InlineNotice,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import {
  inboxCommandCenterQuery,
  InboxSecondaryLinks,
} from "@/components/inbox/inbox-secondary-links";
import { InboxThreadRow } from "@/components/inbox/inbox-thread-row";
import { ThreadList } from "@/components/inbox/thread-list";
import type { InboxCommandCenterData } from "@/lib/inbox/inbox-command-center.service";
import type { InboxCrateFilter } from "@/lib/inbox/email-thread-category";
import type { InboxQueueParam, StakeholderBinSection } from "@/lib/inbox/inbox-thread-queues";
import Link from "next/link";
import type { ReactNode } from "react";
import { SummaryPill } from "@/components/portal/summary-pill";

function mailboxQuery(mailboxId: string, queue?: InboxQueueParam) {
  const params = new URLSearchParams({ mailbox: mailboxId });
  if (queue) params.set("queue", queue);
  return `/inbox?${params.toString()}`;
}

function mailboxCrateQuery(mailboxId: string, crate: InboxCrateFilter) {
  const params = new URLSearchParams({ mailbox: mailboxId, crate });
  return `/inbox?${params.toString()}`;
}

function SectionHeader({
  id,
  title,
  total,
  viewAllHref,
  cleanup,
}: {
  id: string;
  title: string;
  total: number;
  viewAllHref: string;
  cleanup?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2
          id={id}
          className={`scroll-mt-6 text-lg font-semibold ${cleanup ? "text-warning-foreground-strong" : "text-foreground"}`}
        >
          {title}
        </h2>
        <p className={`mt-1 text-sm ${cleanup ? "text-warning-foreground" : "text-foreground-muted"}`}>
          {total} thread{total === 1 ? "" : "s"}
        </p>
      </div>
      <Link
        href={viewAllHref}
        className={`rounded-sm text-sm font-medium text-foreground underline ${FOCUS_RING}`}
      >
        View all →
      </Link>
    </div>
  );
}

function StakeholderBinPreview({
  bin,
  mailboxId,
}: {
  bin: StakeholderBinSection;
  mailboxId: string;
}) {
  return (
    <FormSection legend="">
      <SectionHeader
        id={bin.sectionId}
        title={bin.title}
        total={bin.total}
        viewAllHref={mailboxCrateQuery(mailboxId, bin.category)}
        cleanup={bin.variant === "cleanup"}
      />
      <div className="mt-4">
        {bin.preview.length === 0 ? (
          <InlineNotice>{bin.emptyMessage}</InlineNotice>
        ) : (
          <div
            className={`overflow-hidden rounded-xl border bg-surface ${
              bin.variant === "cleanup" ? "border-warning-border" : "border-border"
            }`}
          >
            <ul className="divide-y divide-border">
              {bin.preview.map((row) => (
                <li key={row.id}>
                  <InboxThreadRow row={row} mailboxId={mailboxId} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </FormSection>
  );
}

function PreviewSection({
  id,
  title,
  description,
  total,
  viewAllHref,
  mailboxId,
  rows,
  emptyMessage,
}: {
  id: string;
  title: string;
  description?: string;
  total: number;
  viewAllHref: string;
  mailboxId: string;
  rows: InboxCommandCenterData["needsReview"]["preview"];
  emptyMessage: string;
}) {
  return (
    <FormSection legend="">
      <SectionHeader id={id} title={title} total={total} viewAllHref={viewAllHref} />
      {description ? <p className="mt-1 text-sm text-foreground-muted">{description}</p> : null}
      <div className="mt-4">
        {total === 0 ? (
          <InlineNotice>{emptyMessage}</InlineNotice>
        ) : (
          <div className={`overflow-hidden ${SURFACE_PANEL}`}>
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li key={row.id}>
                  <InboxThreadRow row={row} mailboxId={mailboxId} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </FormSection>
  );
}

export function InboxCommandCenter(props: {
  data: InboxCommandCenterData;
  mailboxId: string;
  queue: InboxQueueParam | null;
  crate: InboxCrateFilter | null;
  lastSyncedAt: string | null;
}) {
  const { data, mailboxId, queue, crate, lastSyncedAt } = props;
  const { summary } = data;
  const isFiltered = Boolean(crate || queue);

  let filteredContent: ReactNode = null;
  if (isFiltered && data.filteredThreads && data.filteredViewTitle) {
    filteredContent = (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">{data.filteredViewTitle}</h2>
          <Link
            href={inboxCommandCenterQuery(mailboxId)}
            className={`rounded-sm text-sm font-medium text-foreground underline ${FOCUS_RING}`}
          >
            Back to command center
          </Link>
        </div>
        <ThreadList
          mailboxId={mailboxId}
          threads={data.filteredThreads}
          lastSyncedAt={lastSyncedAt ? new Date(lastSyncedAt) : null}
          emptyMessage={`No threads in ${data.filteredViewTitle.toLowerCase()}.`}
        />
      </div>
    );
  }

  const attentionSummary = (
    <div id="attention-summary">
      <FormField label="Attention summary" htmlFor="inbox-command-center-summary">
        <output
          id="inbox-command-center-summary"
          className={`block ${SURFACE_PANEL} px-3.5 py-3 text-sm`}
        >
          <span className="font-medium text-foreground">
            {summary.totalUnique} thread{summary.totalUnique === 1 ? "" : "s"} need attention
          </span>
          {summary.totalUnique > 0 || summary.connectionIssues > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <SummaryPill
                href="#landlord-communication"
                label="Waiting for reply"
                count={summary.needsReply}
              />
              <SummaryPill href="#unlinked" label="Unlinked" count={summary.unlinked} />
              <SummaryPill
                href="#needs-review"
                label="Draft review"
                count={summary.reviewRequired}
              />
              <SummaryPill
                href="#classification-review"
                label="Classification Review"
                count={summary.classificationReview}
              />
              {summary.connectionIssues > 0 ? (
                <Link
                  href="#mailbox-toolbar"
                  className={`inline-flex items-center gap-2 rounded-md border border-warning-border-strong bg-warning-surface px-3 py-1.5 text-sm text-warning-foreground-strong transition-colors hover:border-warning ${FOCUS_RING}`}
                >
                  <span className="font-semibold tabular-nums">!</span>
                  <span>Connection issue</span>
                </Link>
              ) : null}
            </div>
          ) : (
            <span className="mt-1 block text-foreground-muted">Nothing needs attention right now.</span>
          )}
        </output>
      </FormField>
    </div>
  );

  const stakeholderBins = (
    <div className="flex flex-col gap-10">
      {data.stakeholderBins.map((bin) => (
        <StakeholderBinPreview key={bin.category} bin={bin} mailboxId={mailboxId} />
      ))}
      <InboxSecondaryLinks
        mailboxId={mailboxId}
        crateCounts={data.crateCounts}
        crateActionCounts={data.crateActionCounts}
        activeCrate={crate}
      />
    </div>
  );

  const remainingSections = (
    <div className="flex flex-col gap-10">
      <PreviewSection
        id="needs-review"
        title="Needs review"
        description="AI draft responses flagged for review."
        total={data.needsReview.total}
        viewAllHref={mailboxQuery(mailboxId, "needs_review")}
        mailboxId={mailboxId}
        rows={data.needsReview.preview}
        emptyMessage="No drafts flagged for review."
      />

      <PreviewSection
        id="classification-review"
        title="Classification Review"
        description="Synced emails the classifier attempted but left uncategorized."
        total={data.classificationReview.total}
        viewAllHref={mailboxQuery(mailboxId, "classification_review")}
        mailboxId={mailboxId}
        rows={data.classificationReview.preview}
        emptyMessage="No threads need classification review."
      />

      <PreviewSection
        id="unlinked"
        title="Unlinked"
        total={data.unlinked.total}
        viewAllHref={mailboxQuery(mailboxId, "unlinked")}
        mailboxId={mailboxId}
        rows={data.unlinked.preview}
        emptyMessage="All synced threads have PM context links."
      />

      <PreviewSection
        id="recent-activity"
        title="Recent activity"
        total={data.recentActivity.total}
        viewAllHref={mailboxQuery(mailboxId, "recent")}
        mailboxId={mailboxId}
        rows={data.recentActivity.preview}
        emptyMessage="No synced threads yet."
      />
    </div>
  );

  return (
    <div className="space-y-8">
      {isFiltered ? (
        filteredContent
      ) : (
        <>
          {attentionSummary}
          {stakeholderBins}
          {remainingSections}
        </>
      )}
    </div>
  );
}
