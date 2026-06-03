"use client";

import {
  FormSection,
  InlineNotice,
  SURFACE_CARD,
  toggleTileClasses,
} from "@/components/portal/ui";
import type { NoticeQueueRow } from "@/lib/leasing/notice-staff-queue";
import type { OffboardingTenancyQueueRow } from "@/lib/leasing/offboarding-queue";
import { formatTenancyStatus } from "@/lib/leasing/application-staff-detail";
import Link from "next/link";
import { useMemo, useState } from "react";

function formatSubmittedAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { label: iso, dateTime: iso };
  return {
    label: d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
    dateTime: d.toISOString(),
  };
}

function formatMoveOutDate(iso: string) {
  const d = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function NoticeListSection({
  title,
  badgeLabel,
  badgeClassName,
  notices,
  propertyFilter,
  emptyMessage,
}: {
  title: string;
  badgeLabel: string;
  badgeClassName: string;
  notices: NoticeQueueRow[];
  propertyFilter: string;
  emptyMessage: string;
}) {
  const visible = useMemo(() => {
    if (propertyFilter === "all") return notices;
    return notices.filter((n) => n.propertyId === propertyFilter);
  }, [notices, propertyFilter]);

  return (
    <FormSection legend={title}>
      {notices.length === 0 ? (
        <InlineNotice>{emptyMessage}</InlineNotice>
      ) : visible.length === 0 ? (
        <InlineNotice>No items match this filter.</InlineNotice>
      ) : (
        <ul className="flex list-none flex-col gap-3 p-0">
          {visible.map((notice) => {
            const submitted = formatSubmittedAt(notice.submittedAt);
            return (
              <li key={notice.id}>
                <Link
                  href={`/leasing/notices/${notice.id}`}
                  className={`block ${SURFACE_CARD} px-4 py-4 transition-colors hover:border-neutral-400`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${badgeClassName}`}
                    >
                      {badgeLabel}
                    </span>
                    <time className="text-xs text-neutral-500" dateTime={submitted.dateTime}>
                      {submitted.label}
                    </time>
                  </div>
                  <h2 className="mt-3 text-sm font-semibold text-neutral-900">
                    {notice.tenantLabel ?? "Tenant"}
                  </h2>
                  <p className="mt-1 text-xs font-medium text-neutral-700">{notice.propertyName}</p>
                  <p className="mt-2 text-sm text-neutral-600">{notice.unitLabel}</p>
                  <p className="mt-2 text-sm text-neutral-600">
                    <span className="text-neutral-500">Requested move-out · </span>
                    {formatMoveOutDate(notice.tenantRequestedMoveOutDate)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </FormSection>
  );
}

function TenancyListSection({
  title,
  badgeLabel,
  badgeClassName,
  tenancies,
  propertyFilter,
  emptyMessage,
  showInspectionDate,
}: {
  title: string;
  badgeLabel: string;
  badgeClassName: string;
  tenancies: OffboardingTenancyQueueRow[];
  propertyFilter: string;
  emptyMessage: string;
  showInspectionDate: boolean;
}) {
  const visible = useMemo(() => {
    if (propertyFilter === "all") return tenancies;
    return tenancies.filter((t) => t.propertyId === propertyFilter);
  }, [tenancies, propertyFilter]);

  return (
    <FormSection legend={title}>
      {tenancies.length === 0 ? (
        <InlineNotice>{emptyMessage}</InlineNotice>
      ) : visible.length === 0 ? (
        <InlineNotice>No items match this filter.</InlineNotice>
      ) : (
        <ul className="flex list-none flex-col gap-3 p-0">
          {visible.map((t) => (
            <li key={t.id}>
              <Link
                href={`/leasing/tenancies/${t.id}#offboarding-summary`}
                className={`block ${SURFACE_CARD} px-4 py-4 transition-colors hover:border-neutral-400`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${badgeClassName}`}
                  >
                    {badgeLabel}
                  </span>
                  <span className="text-xs text-neutral-500">{formatTenancyStatus(t.status)}</span>
                </div>
                <h2 className="mt-3 text-sm font-semibold text-neutral-900">
                  {t.tenantLabel ?? "Tenant"}
                </h2>
                <p className="mt-1 text-xs font-medium text-neutral-700">{t.propertyName}</p>
                <p className="mt-2 text-sm text-neutral-600">{t.unitLabel}</p>
                <p className="mt-2 text-sm text-neutral-600">
                  <span className="text-neutral-500">Scheduled move-out · </span>
                  {t.moveOutDate ? formatMoveOutDate(t.moveOutDate) : "—"}
                </p>
                {showInspectionDate ? (
                  <p className="mt-1 text-sm text-neutral-600">
                    <span className="text-neutral-500">Inspection date · </span>
                    {t.inspectionDate ? formatMoveOutDate(t.inspectionDate) : "—"}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </FormSection>
  );
}

export function OffboardingQueueList({
  initialPendingNotices,
  initialAwaitingSchedule,
  initialAwaitingInspectionSchedule,
  initialAwaitingInspectionComplete,
  loadError,
}: {
  initialPendingNotices: NoticeQueueRow[];
  initialAwaitingSchedule: NoticeQueueRow[];
  initialAwaitingInspectionSchedule: OffboardingTenancyQueueRow[];
  initialAwaitingInspectionComplete: OffboardingTenancyQueueRow[];
  loadError: string | null;
}) {
  const [pendingNotices] = useState(initialPendingNotices);
  const [awaitingSchedule] = useState(initialAwaitingSchedule);
  const [awaitingInspectionSchedule] = useState(initialAwaitingInspectionSchedule);
  const [awaitingInspectionComplete] = useState(initialAwaitingInspectionComplete);
  const [propertyFilter, setPropertyFilter] = useState<string>("all");

  const propertyOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of [...pendingNotices, ...awaitingSchedule]) {
      map.set(n.propertyId, n.propertyName);
    }
    for (const t of [...awaitingInspectionSchedule, ...awaitingInspectionComplete]) {
      map.set(t.propertyId, t.propertyName);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [
    pendingNotices,
    awaitingSchedule,
    awaitingInspectionSchedule,
    awaitingInspectionComplete,
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Offboarding</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Review tenant notices, schedule move-out and inspection, then end and archive tenancies.
        </p>
      </div>

      {loadError ? <InlineNotice className="mb-4">{loadError}</InlineNotice> : null}

      <div className="flex flex-col gap-10">
        {propertyOptions.length > 1 ? (
          <FormSection legend="Filter by property">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPropertyFilter("all")}
                className={toggleTileClasses(propertyFilter === "all")}
                aria-pressed={propertyFilter === "all"}
              >
                All properties
              </button>
              {propertyOptions.map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPropertyFilter(id)}
                  className={toggleTileClasses(propertyFilter === id)}
                  aria-pressed={propertyFilter === id}
                >
                  {name}
                </button>
              ))}
            </div>
          </FormSection>
        ) : null}

        <NoticeListSection
          title="Pending notice review"
          badgeLabel="Pending review"
          badgeClassName="border-amber-200 bg-amber-50 text-amber-900"
          notices={pendingNotices}
          propertyFilter={propertyFilter}
          emptyMessage="No pending tenant notices."
        />

        <NoticeListSection
          title="Awaiting move-out schedule"
          badgeLabel="Awaiting schedule"
          badgeClassName="border-sky-200 bg-sky-50 text-sky-900"
          notices={awaitingSchedule}
          propertyFilter={propertyFilter}
          emptyMessage="No accepted notices awaiting move-out scheduling."
        />

        <TenancyListSection
          title="Awaiting inspection schedule"
          badgeLabel="Schedule inspection"
          badgeClassName="border-violet-200 bg-violet-50 text-violet-900"
          tenancies={awaitingInspectionSchedule}
          propertyFilter={propertyFilter}
          emptyMessage="No tenancies awaiting move-out inspection scheduling."
          showInspectionDate={false}
        />

        <TenancyListSection
          title="Awaiting inspection complete"
          badgeLabel="Complete inspection"
          badgeClassName="border-indigo-200 bg-indigo-50 text-indigo-900"
          tenancies={awaitingInspectionComplete}
          propertyFilter={propertyFilter}
          emptyMessage="No tenancies awaiting inspection completion."
          showInspectionDate
        />
      </div>
    </div>
  );
}
