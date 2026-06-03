"use client";

import {
  FormSection,
  InlineNotice,
  SURFACE_CARD,
  toggleTileClasses,
} from "@/components/portal/ui";
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

export function NoticeQueueList({
  initialNotices,
  loadError,
}: {
  initialNotices: NoticeQueueRow[];
  loadError: string | null;
}) {
  const [notices] = useState(initialNotices);
  const [propertyFilter, setPropertyFilter] = useState<string>("all");

  const propertyOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of notices) {
      map.set(n.propertyId, n.propertyName);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [notices]);

  const visible = useMemo(() => {
    if (propertyFilter === "all") return notices;
    return notices.filter((n) => n.propertyId === propertyFilter);
  }, [notices, propertyFilter]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Tenant notices</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Review notices to end tenancy submitted from the tenant portal.
        </p>
      </div>

      {loadError ? <InlineNotice className="mb-4">{loadError}</InlineNotice> : null}

      <div className="flex flex-col gap-8">
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

        {notices.length === 0 ? (
          <InlineNotice>No pending tenant notices.</InlineNotice>
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
                    className={`block ${SURFACE_CARD} px-4 py-4 transition-colors hover:border-neutral-400`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                        Pending review
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
                      <span className="text-neutral-500">Requested end · </span>
                      {formatMoveOutDate(notice.tenantRequestedMoveOutDate)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
