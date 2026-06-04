"use client";

import {
  FormField,
  FormSection,
  InlineNotice,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import { InboxThreadRow } from "@/components/inbox/inbox-thread-row";
import { ThreadList } from "@/components/inbox/thread-list";
import type { InboxCommandCenterData } from "@/lib/inbox/inbox-command-center.service";
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
  total,
  viewAllHref,
  mailboxId,
  rows,
  emptyMessage,
}: {
  id: string;
  title: string;
  total: number;
  viewAllHref: string;
  mailboxId: string;
  rows: InboxCommandCenterData["needsReply"]["preview"];
  emptyMessage: string;
}) {
  return (
    <FormSection legend="">
      <SectionHeader id={id} title={title} total={total} viewAllHref={viewAllHref} />
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

const QUEUE_TITLES: Record<InboxQueueParam, string> = {
  needs_reply: "Needs reply",
  needs_review: "Needs review",
  unlinked: "Unlinked",
  recent: "Recent activity",
};

export function InboxCommandCenter(props: {
  data: InboxCommandCenterData;
  mailboxId: string;
  queue: InboxQueueParam | null;
  lastSyncedAt: string | null;
}) {
  const { data, mailboxId, queue, lastSyncedAt } = props;
  const { summary } = data;

  let filteredContent: ReactNode = null;
  if (queue && data.filteredThreads) {
    filteredContent = (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">{QUEUE_TITLES[queue]}</h2>
          <Link href={mailboxQuery(mailboxId)} className="text-sm font-medium text-neutral-900 underline">
            Back to command center
          </Link>
        </div>
        <ThreadList
          mailboxId={mailboxId}
          threads={data.filteredThreads}
          lastSyncedAt={lastSyncedAt ? new Date(lastSyncedAt) : null}
          emptyMessage={`No threads in ${QUEUE_TITLES[queue].toLowerCase()}.`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div id="unread-inbound">
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
              <SummaryPill
                href="#unread-inbound"
                label="Unread inbound"
                count={summary.unreadInbound}
              />
              <SummaryPill href="#needs-reply" label="Needs reply" count={summary.needsReply} />
              <SummaryPill href="#unlinked" label="Unlinked" count={summary.unlinked} />
              <SummaryPill
                href="#needs-review"
                label="Review required"
                count={summary.reviewRequired}
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
          {summary.totalUnique > 0 ? (
            <span className="mt-2 block text-xs text-neutral-500">
              Counts may overlap — one thread can appear in multiple categories.
            </span>
          ) : null}
        </output>
        </FormField>
      </div>

      {filteredContent ?? (
        <div className="flex flex-col gap-10">
          <PreviewSection
            id="needs-reply"
            title="Needs reply"
            total={data.needsReply.total}
            viewAllHref={mailboxQuery(mailboxId, "needs_reply")}
            mailboxId={mailboxId}
            rows={data.needsReply.preview}
            emptyMessage="No threads waiting for a reply."
          />

          <PreviewSection
            id="needs-review"
            title="Needs review"
            total={data.needsReview.total}
            viewAllHref={mailboxQuery(mailboxId, "needs_review")}
            mailboxId={mailboxId}
            rows={data.needsReview.preview}
            emptyMessage="No drafts flagged for review."
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
      )}
    </div>
  );
}
