"use client";

import {
  FormField,
  FormSection,
  InlineNotice,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import { InboxCrateNav, inboxCommandCenterQuery } from "@/components/inbox/inbox-crate-nav";
import { InboxThreadRow } from "@/components/inbox/inbox-thread-row";
import { ThreadList } from "@/components/inbox/thread-list";
import type { InboxCommandCenterData } from "@/lib/inbox/inbox-command-center.service";
import type { InboxCrateFilter } from "@/lib/inbox/email-thread-category";
import type { InboxQueueParam } from "@/lib/inbox/inbox-thread-queues";
import Link from "next/link";
import type { ReactNode } from "react";

function SummaryPill({
  href,
  label,
  count,
}: {
  href: string;
  label: string;
  count: number;
}) {
  if (count === 0) return null;
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 transition-colors hover:border-neutral-400"
    >
      <span className="font-semibold tabular-nums text-neutral-900">{count}</span>
      <span>{label}</span>
    </Link>
  );
}

function mailboxQuery(mailboxId: string, queue?: InboxQueueParam) {
  const params = new URLSearchParams({ mailbox: mailboxId });
  if (queue) params.set("queue", queue);
  return `/inbox?${params.toString()}`;
}

function SectionHeader({
  id,
  title,
  total,
  viewAllHref,
}: {
  id: string;
  title: string;
  total: number;
  viewAllHref: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id={id} className="scroll-mt-6 text-lg font-semibold text-neutral-900">
          {title}
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          {total} thread{total === 1 ? "" : "s"}
        </p>
      </div>
      <Link href={viewAllHref} className="text-sm font-medium text-neutral-900 underline">
        View all →
      </Link>
    </div>
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
  rows: InboxCommandCenterData["needsReply"]["preview"];
  emptyMessage: string;
}) {
  return (
    <FormSection legend="">
      <SectionHeader id={id} title={title} total={total} viewAllHref={viewAllHref} />
      {description ? <p className="mt-1 text-sm text-neutral-600">{description}</p> : null}
      <div className="mt-4">
        {total === 0 ? (
          <InlineNotice>{emptyMessage}</InlineNotice>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <ul className="divide-y divide-neutral-100">
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
          <h2 className="text-lg font-semibold text-neutral-900">{data.filteredViewTitle}</h2>
          <Link
            href={inboxCommandCenterQuery(mailboxId)}
            className="text-sm font-medium text-neutral-900 underline"
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
          <span className="font-medium text-neutral-900">
            {summary.totalUnique} thread{summary.totalUnique === 1 ? "" : "s"} need attention
          </span>
          {summary.totalUnique > 0 || summary.connectionIssues > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <SummaryPill href="#needs-reply" label="Needs reply" count={summary.needsReply} />
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
                  className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-950 transition-colors hover:border-amber-400"
                >
                  <span className="font-semibold tabular-nums">!</span>
                  <span>Connection issue</span>
                </Link>
              ) : null}
            </div>
          ) : (
            <span className="mt-1 block text-neutral-600">Nothing needs attention right now.</span>
          )}
        </output>
      </FormField>
    </div>
  );

  const needsReplySection = (
    <PreviewSection
      id="needs-reply"
      title="Needs reply"
      description="Sorted by stakeholder priority, oldest waiting first."
      total={data.needsReply.total}
      viewAllHref={mailboxQuery(mailboxId, "needs_reply")}
      mailboxId={mailboxId}
      rows={data.needsReply.preview}
      emptyMessage="No threads waiting for a reply."
    />
  );

  const crateNav = (
    <InboxCrateNav
      mailboxId={mailboxId}
      crateCounts={data.crateCounts}
      crateActionCounts={data.crateActionCounts}
      activeCrate={crate}
    />
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
          {needsReplySection}
          {crateNav}
          {remainingSections}
        </>
      )}
    </div>
  );
}
