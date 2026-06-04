"use client";

import {
  FormField,
  FormSection,
  InlineNotice,
  SURFACE_CARD,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import { formatApplicationQueueStatus } from "@/lib/leasing/application-staff-queue";
import type { ApplicationConversionQueueRow } from "@/lib/leasing/application-conversion-staff-queue";
import type { ApplicationQueueRow } from "@/lib/leasing/application-staff-queue";
import type { OffboardingAttentionRow } from "@/lib/leasing/offboarding-attention-queue";
import type { OnboardingAttentionRow } from "@/lib/leasing/onboarding-attention-queue";
import type { LeasingDashboardData } from "@/lib/leasing/leasing-dashboard.service";
import type { ProspectQueueRow } from "@/lib/leasing/staff-queue";
import Link from "next/link";
import type { ReactNode } from "react";

function formatSubmittedAt(iso: string | null) {
  if (!iso) return { label: "—", dateTime: undefined };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { label: iso, dateTime: iso };
  return {
    label: d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
    dateTime: d.toISOString(),
  };
}

function formatName(firstName: string | null, lastName: string | null, email: string) {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || email;
}

function formatMoveInDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
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

function ViewingRequestPreview({ prospect }: { prospect: ProspectQueueRow }) {
  const submitted = formatSubmittedAt(prospect.createdAt);
  const displayName = formatName(prospect.firstName, prospect.lastName, prospect.email);

  return (
    <Link
      href="/leasing/prospects"
      className={`block ${SURFACE_CARD} px-4 py-4 transition-colors hover:border-neutral-400`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900">
          New request
        </span>
        <time className="text-xs text-neutral-500" dateTime={submitted.dateTime}>
          {submitted.label}
        </time>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-neutral-900">{displayName}</h3>
      <p className="mt-1 text-xs font-medium text-neutral-700">{prospect.propertyName}</p>
      {prospect.unitLabel ? (
        <p className="mt-2 text-sm text-neutral-600">{prospect.unitLabel}</p>
      ) : null}
      <p className="mt-2 text-sm text-neutral-600">
        <span className="text-neutral-500">Desired move-in · </span>
        {formatMoveInDate(prospect.desiredMoveInDate)}
      </p>
    </Link>
  );
}

function ApplicationPreview({ application }: { application: ApplicationQueueRow }) {
  const submitted = formatSubmittedAt(application.submittedAt);
  const displayName = formatName(application.firstName, application.lastName, application.email);

  return (
    <Link
      href={`/leasing/applications/${application.id}`}
      className={`block ${SURFACE_CARD} px-4 py-4 transition-colors hover:border-neutral-400`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium text-neutral-800">
          {formatApplicationQueueStatus(application.status)}
        </span>
        <time className="text-xs text-neutral-500" dateTime={submitted.dateTime}>
          {submitted.label}
        </time>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-neutral-900">{displayName}</h3>
      <p className="mt-1 text-xs font-medium text-neutral-700">{application.propertyName}</p>
      <p className="mt-2 text-sm text-neutral-600">{application.unitLabel}</p>
    </Link>
  );
}

function ConversionPreview({ application }: { application: ApplicationConversionQueueRow }) {
  const approved = formatSubmittedAt(application.decisionAt ?? application.submittedAt);
  const displayName = formatName(application.firstName, application.lastName, application.email);

  return (
    <Link
      href={`/leasing/applications/${application.id}`}
      className={`block ${SURFACE_CARD} px-4 py-4 transition-colors hover:border-neutral-400`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900">
          Ready to convert
        </span>
        <time className="text-xs text-neutral-500" dateTime={approved.dateTime}>
          {approved.label}
        </time>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-neutral-900">{displayName}</h3>
      <p className="mt-1 text-xs font-medium text-neutral-700">{application.propertyName}</p>
      <p className="mt-2 text-sm text-neutral-600">{application.unitLabel}</p>
    </Link>
  );
}

function onboardingBadgeClass(kind: OnboardingAttentionRow["kind"]) {
  if (kind === "overdue") return "border-red-200 bg-red-50 text-red-900";
  if (kind === "upcoming") return "border-sky-200 bg-sky-50 text-sky-900";
  if (kind === "portal_not_ready") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-violet-200 bg-violet-50 text-violet-900";
}

function OnboardingPreview({ row }: { row: OnboardingAttentionRow }) {
  return (
    <Link
      href={row.href}
      className={`block ${SURFACE_CARD} px-4 py-4 transition-colors hover:border-neutral-400`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${onboardingBadgeClass(row.kind)}`}
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
    </Link>
  );
}

function offboardingRowKey(row: OffboardingAttentionRow): string {
  switch (row.kind) {
    case "pending_notice":
    case "awaiting_schedule":
      return row.notice.id;
    case "awaiting_inspection_schedule":
    case "awaiting_inspection_complete":
      return row.tenancy.id;
  }
}

function offboardingBadgeClass(kind: OffboardingAttentionRow["kind"]) {
  if (kind === "pending_notice") return "border-amber-200 bg-amber-50 text-amber-900";
  if (kind === "awaiting_schedule") return "border-sky-200 bg-sky-50 text-sky-900";
  if (kind === "awaiting_inspection_schedule") return "border-violet-200 bg-violet-50 text-violet-900";
  return "border-indigo-200 bg-indigo-50 text-indigo-900";
}

function OffboardingPreview({ row }: { row: OffboardingAttentionRow }) {
  const submitted = formatSubmittedAt(row.sortAt);

  return (
    <Link
      href={row.href}
      className={`block ${SURFACE_CARD} px-4 py-4 transition-colors hover:border-neutral-400`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${offboardingBadgeClass(row.kind)}`}
        >
          {row.badgeLabel}
        </span>
        <time className="text-xs text-neutral-500" dateTime={submitted.dateTime}>
          {submitted.label}
        </time>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-neutral-900">
        {row.tenantLabel ?? "Tenant"}
      </h3>
      <p className="mt-1 text-xs font-medium text-neutral-700">{row.propertyName}</p>
      <p className="mt-2 text-sm text-neutral-600">{row.unitLabel}</p>
      <p className="mt-2 text-sm text-neutral-600">
        <span className="text-neutral-500">{row.datePrefix}</span>
        {row.dateLabel}
      </p>
    </Link>
  );
}

function PreviewSection<T>({
  id,
  title,
  total,
  viewAllHref,
  rows,
  emptyMessage,
  renderRow,
  getKey,
}: {
  id: string;
  title: string;
  total: number;
  viewAllHref: string;
  rows: T[];
  emptyMessage: string;
  renderRow: (row: T) => ReactNode;
  getKey: (row: T) => string;
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
              <li key={getKey(row)}>{renderRow(row)}</li>
            ))}
          </ul>
        )}
      </div>
    </FormSection>
  );
}

export function LeasingDashboard({
  data,
  loadError,
}: {
  data: LeasingDashboardData | null;
  loadError: string | null;
}) {
  const summary = data?.summary;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Leasing</h1>
        <p className="mt-1 text-sm text-neutral-600">
          What needs attention across intake, applications, move-ins, and offboarding.
        </p>
      </div>

      {loadError ? <InlineNotice className="mb-4">{loadError}</InlineNotice> : null}

      {summary ? (
        <FormField label="Attention summary" htmlFor="leasing-dashboard-summary">
          <output
            id="leasing-dashboard-summary"
            className={`block ${SURFACE_PANEL} px-3.5 py-3 text-sm`}
          >
            <span className="font-medium text-neutral-900">
              {summary.total} item{summary.total === 1 ? "" : "s"} need attention
            </span>
            {summary.total > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <SummaryPill
                  href="#viewing-requests"
                  label="Viewing requests"
                  count={summary.viewingRequests}
                />
                <SummaryPill
                  href="#applications-to-review"
                  label="To review"
                  count={summary.applicationsToReview}
                />
                <SummaryPill
                  href="#approved-ready-to-convert"
                  label="Ready to convert"
                  count={summary.approvedReadyToConvert}
                />
                <SummaryPill
                  href="#onboarding"
                  label="Onboarding"
                  count={summary.onboarding}
                />
                <SummaryPill
                  href="#offboarding"
                  label="Offboarding"
                  count={summary.offboarding}
                />
              </div>
            ) : (
              <span className="mt-1 block text-neutral-600">Nothing needs attention right now.</span>
            )}
          </output>
        </FormField>
      ) : null}

      {data ? (
        <div className="mt-8 flex flex-col gap-10">
          <PreviewSection
            id="viewing-requests"
            title="Viewing requests"
            total={data.viewingRequests.total}
            viewAllHref="/leasing/prospects"
            rows={data.viewingRequests.preview}
            emptyMessage="No new viewing requests."
            getKey={(row) => row.id}
            renderRow={(row) => <ViewingRequestPreview prospect={row} />}
          />

          <PreviewSection
            id="applications-to-review"
            title="Applications to review"
            total={data.applicationsToReview.total}
            viewAllHref="/leasing/applications"
            rows={data.applicationsToReview.preview}
            emptyMessage="No applications waiting for review."
            getKey={(row) => row.id}
            renderRow={(row) => <ApplicationPreview application={row} />}
          />

          <PreviewSection
            id="approved-ready-to-convert"
            title="Approved · ready to convert"
            total={data.approvedReadyToConvert.total}
            viewAllHref="/leasing/applications?queue=conversion"
            rows={data.approvedReadyToConvert.preview}
            emptyMessage="No approved applications waiting for tenancy conversion."
            getKey={(row) => row.id}
            renderRow={(row) => <ConversionPreview application={row} />}
          />

          <PreviewSection
            id="onboarding"
            title="Onboarding"
            total={data.onboarding.total}
            viewAllHref="/leasing/onboarding"
            rows={data.onboarding.preview}
            emptyMessage="No tenancies pending move-in."
            getKey={(row) => row.tenancy.id}
            renderRow={(row) => <OnboardingPreview row={row} />}
          />

          <PreviewSection
            id="offboarding"
            title="Offboarding"
            total={data.offboarding.total}
            viewAllHref="/leasing/offboarding"
            rows={data.offboarding.preview}
            emptyMessage="No offboarding items need attention."
            getKey={offboardingRowKey}
            renderRow={(row) => <OffboardingPreview row={row} />}
          />
        </div>
      ) : null}
    </div>
  );
}
