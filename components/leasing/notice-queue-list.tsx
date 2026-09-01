"use client";

import {
  FormSection,
  InlineNotice,
  SURFACE_CARD,
  toggleTileClasses,
} from "@/components/portal/ui";
import { FOCUS_RING } from "@/components/portal/focus";
import { StatusBadge, type StatusTone } from "@/components/portal/status-badge";
import type { NoticeQueueRow } from "@/lib/leasing/notice-staff-queue";
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
  badgeTone,
  notices,
  propertyFilter,
  emptyMessage,
}: {
  title: string;
  badgeLabel: string;
  badgeTone: StatusTone;
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
        <InlineNotice>No notices match this filter.</InlineNotice>
      ) : (
        <ul className="flex list-none flex-col gap-3 p-0">
          {visible.map((notice) => {
            const submitted = formatSubmittedAt(notice.submittedAt);
            return (
              <li key={notice.id}>
                <Link
                  href={`/leasing/notices/${notice.id}`}
                  className={`block ${SURFACE_CARD} px-4 py-4 transition-colors hover:border-foreground-subtle ${FOCUS_RING}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <StatusBadge tone={badgeTone}>{badgeLabel}</StatusBadge>
                    <time className="text-xs text-foreground-subtle" dateTime={submitted.dateTime}>
                      {submitted.label}
                    </time>
                  </div>
                  <h2 className="mt-3 text-sm font-semibold text-foreground">
                    {notice.tenantLabel ?? "Tenant"}
                  </h2>
                  <p className="mt-1 text-xs font-medium text-foreground-muted">{notice.propertyName}</p>
                  <p className="mt-2 text-sm text-foreground-muted">{notice.unitLabel}</p>
                  <p className="mt-2 text-sm text-foreground-muted">
                    <span className="text-foreground-subtle">Requested move-out · </span>
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

export function NoticeQueueList({
  initialPendingNotices,
  initialAwaitingSchedule,
  loadError,
}: {
  initialPendingNotices: NoticeQueueRow[];
  initialAwaitingSchedule: NoticeQueueRow[];
  loadError: string | null;
}) {
  const [pendingNotices] = useState(initialPendingNotices);
  const [awaitingSchedule] = useState(initialAwaitingSchedule);
  const [propertyFilter, setPropertyFilter] = useState<string>("all");

  const propertyOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of [...pendingNotices, ...awaitingSchedule]) {
      map.set(n.propertyId, n.propertyName);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [pendingNotices, awaitingSchedule]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Tenant notices</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Review tenant notices to end tenancy, then schedule confirmed move-out dates.
        </p>
      </div>

      {loadError ? (
        <InlineNotice className="mb-4" tone="danger">
          {loadError}
        </InlineNotice>
      ) : null}

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
          title="Pending review"
          badgeLabel="Pending review"
          badgeTone="warning"
          notices={pendingNotices}
          propertyFilter={propertyFilter}
          emptyMessage="No pending tenant notices."
        />

        <NoticeListSection
          title="Awaiting schedule"
          badgeLabel="Awaiting schedule"
          badgeTone="info"
          notices={awaitingSchedule}
          propertyFilter={propertyFilter}
          emptyMessage="No accepted notices awaiting move-out scheduling."
        />
      </div>
    </div>
  );
}
