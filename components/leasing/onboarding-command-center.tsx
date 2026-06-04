"use client";

import {
  FormField,
  FormSection,
  InlineNotice,
  SURFACE_CARD,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import type { OnboardingAttentionRow } from "@/lib/leasing/onboarding-attention-queue";
import type {
  OnboardingCommandCenterData,
  OnboardingQueueParam,
} from "@/lib/leasing/onboarding-command-center.service";
import Link from "next/link";
import type { ReactNode } from "react";

function formatMoveInDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function onboardingQueueHref(queue?: OnboardingQueueParam) {
  return queue ? `/leasing/onboarding?queue=${queue}` : "/leasing/onboarding";
}

function SummaryPill({ href, label, count }: { href: string; label: string; count: number }) {
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
          {total} item{total === 1 ? "" : "s"} need attention
        </p>
      </div>
      <Link href={viewAllHref} className="text-sm font-medium text-neutral-900 underline">
        View all →
      </Link>
    </div>
  );
}

function attentionBadgeClass(kind: OnboardingAttentionRow["kind"]) {
  if (kind === "overdue") return "border-red-200 bg-red-50 text-red-900";
  if (kind === "upcoming") return "border-sky-200 bg-sky-50 text-sky-900";
  if (kind === "portal_not_ready") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-violet-200 bg-violet-50 text-violet-900";
}

function portalLabel(portalAccessEnabled: boolean | null) {
  if (portalAccessEnabled === true) return "Portal · Enabled";
  if (portalAccessEnabled === false) return "Portal · Disabled";
  return "Portal · No contact";
}

function OnboardingPreview({ row }: { row: OnboardingAttentionRow }) {
  return (
    <Link
      href={row.href}
      className={`block ${SURFACE_CARD} px-4 py-4 transition-colors hover:border-neutral-400`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${attentionBadgeClass(row.kind)}`}
        >
          {row.badgeLabel}
        </span>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-neutral-900">
        {row.tenantLabel ?? "No contact on file"}
      </h3>
      <p className="mt-1 text-xs font-medium text-neutral-700">{row.propertyName}</p>
      <p className="mt-2 text-sm text-neutral-600">{row.unitLabel}</p>
      <p className="mt-2 text-sm text-neutral-600">
        <span className="text-neutral-500">Move-in · </span>
        {formatMoveInDate(row.moveInDate)}
      </p>
      <p className="mt-1 text-sm text-neutral-600">{portalLabel(row.portalAccessEnabled)}</p>
    </Link>
  );
}

function PreviewSection({
  id,
  title,
  total,
  viewAllHref,
  rows,
  emptyMessage,
}: {
  id: string;
  title: string;
  total: number;
  viewAllHref: string;
  rows: OnboardingAttentionRow[];
  emptyMessage: string;
}) {
  return (
    <FormSection legend="">
      <SectionHeader id={id} title={title} total={total} viewAllHref={viewAllHref} />
      <div className="mt-4">
        {total === 0 ? (
          <InlineNotice>{emptyMessage}</InlineNotice>
        ) : (
          <ul className="flex list-none flex-col gap-3 p-0">
            {rows.map((row) => (
              <li key={row.tenancy.id}>
                <OnboardingPreview row={row} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </FormSection>
  );
}

const QUEUE_TITLES: Record<OnboardingQueueParam, string> = {
  overdue: "Overdue move-ins",
  upcoming: "Upcoming move-ins",
  portal_not_ready: "Portal not ready",
  pending: "Pending move-ins",
};

export function OnboardingCommandCenter({
  data,
  queue,
  loadError,
}: {
  data: OnboardingCommandCenterData | null;
  queue: OnboardingQueueParam | null;
  loadError: string | null;
}) {
  const summary = data?.summary;

  let filteredContent: ReactNode = null;
  if (queue && data?.filteredRows) {
    filteredContent = (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">{QUEUE_TITLES[queue]}</h2>
          <Link
            href="/leasing/onboarding"
            className="text-sm font-medium text-neutral-900 underline"
          >
            Back to command center
          </Link>
        </div>
        {data.filteredRows.length === 0 ? (
          <InlineNotice>{`No tenancies in ${QUEUE_TITLES[queue].toLowerCase()}.`}</InlineNotice>
        ) : (
          <ul className="flex list-none flex-col gap-3 p-0">
            {data.filteredRows.map((row) => (
              <li key={row.tenancy.id}>
                <OnboardingPreview row={row} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Tenant onboarding</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Pending move-ins before activation. Onboarding steps are tracked manually in this phase.
        </p>
      </div>

      {loadError ? <InlineNotice className="mb-4">{loadError}</InlineNotice> : null}

      {filteredContent}

      {!queue && summary ? (
        <>
          <FormField label="Attention summary" htmlFor="onboarding-command-center-summary">
            <output
              id="onboarding-command-center-summary"
              className={`block ${SURFACE_PANEL} px-3.5 py-3 text-sm`}
            >
              <span className="font-medium text-neutral-900">
                {summary.total} pending move-in{summary.total === 1 ? "" : "s"}
              </span>
              {summary.total > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <SummaryPill
                    href={onboardingQueueHref("overdue")}
                    label="Overdue"
                    count={summary.overdue}
                  />
                  <SummaryPill
                    href={onboardingQueueHref("upcoming")}
                    label="Upcoming"
                    count={summary.upcoming}
                  />
                  <SummaryPill
                    href={onboardingQueueHref("portal_not_ready")}
                    label="Portal not ready"
                    count={summary.portalNotReady}
                  />
                  <SummaryPill
                    href={onboardingQueueHref("pending")}
                    label="Pending"
                    count={summary.pending}
                  />
                </div>
              ) : (
                <span className="mt-1 block text-neutral-600">
                  No tenancies are pending move-in right now.
                </span>
              )}
            </output>
          </FormField>

          {data ? (
            <div className="mt-8 flex flex-col gap-10">
              <PreviewSection
                id="overdue-move-ins"
                title="Overdue move-ins"
                total={data.overdue.total}
                viewAllHref={onboardingQueueHref("overdue")}
                rows={data.overdue.preview}
                emptyMessage="No overdue move-ins."
              />

              <PreviewSection
                id="upcoming-move-ins"
                title="Upcoming move-ins"
                total={data.upcoming.total}
                viewAllHref={onboardingQueueHref("upcoming")}
                rows={data.upcoming.preview}
                emptyMessage="No move-ins in the next 7 days."
              />

              <PreviewSection
                id="portal-not-ready"
                title="Portal not ready"
                total={data.portalNotReady.total}
                viewAllHref={onboardingQueueHref("portal_not_ready")}
                rows={data.portalNotReady.preview}
                emptyMessage="All pending move-ins have portal access enabled on the primary contact."
              />

              <PreviewSection
                id="pending-move-ins"
                title="Pending move-ins"
                total={data.pending.total}
                viewAllHref={onboardingQueueHref("pending")}
                rows={data.pending.preview}
                emptyMessage="No general pending move-ins."
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
