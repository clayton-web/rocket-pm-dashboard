"use client";

import {
  FormField,
  FormSection,
  InlineNotice,
  SURFACE_CARD,
  SURFACE_PANEL,
  toggleTileClasses,
} from "@/components/portal/ui";
import {
  formatApplicationQueueStatus,
  type ApplicationQueueRow,
} from "@/lib/leasing/application-staff-queue";
import Link from "next/link";
import { useMemo, useState } from "react";

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

export function ApplicationQueueList({
  initialApplications,
  loadError,
}: {
  initialApplications: ApplicationQueueRow[];
  loadError: string | null;
}) {
  const [applications] = useState(initialApplications);
  const [propertyFilter, setPropertyFilter] = useState<string>("all");

  const propertyOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const a of applications) {
      names.set(a.propertyId, a.propertyName);
    }
    return [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [applications]);

  const visible = useMemo(() => {
    if (propertyFilter === "all") return applications;
    return applications.filter((a) => a.propertyId === propertyFilter);
  }, [applications, propertyFilter]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Rental applications</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Submitted and in-review applications from public intake. Public form:{" "}
          <Link href="/portal/application" className="font-medium underline">
            /portal/application
          </Link>
        </p>
      </div>

      {loadError ? <InlineNotice className="mb-4">{loadError}</InlineNotice> : null}

      <div className="flex flex-col gap-8">
        <FormField label="Queue overview" htmlFor="application-queue-summary">
          <output id="application-queue-summary" className={`block ${SURFACE_PANEL} px-3.5 py-3 text-sm`}>
            <span className="font-medium text-neutral-900">
              {applications.length} application{applications.length === 1 ? "" : "s"}
            </span>
            <span className="mt-1 block text-neutral-600">{visible.length} shown with current filter</span>
          </output>
        </FormField>

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

        {applications.length === 0 ? (
          <InlineNotice>No submitted applications yet.</InlineNotice>
        ) : visible.length === 0 ? (
          <InlineNotice>No applications match this filter.</InlineNotice>
        ) : (
          <ul className="flex list-none flex-col gap-3 p-0">
            {visible.map((app) => {
              const submitted = formatSubmittedAt(app.submittedAt);
              const displayName = formatName(app.firstName, app.lastName, app.email);
              return (
                <li key={app.id}>
                  <article className={`${SURFACE_CARD} px-4 py-4`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium text-neutral-800">
                        {formatApplicationQueueStatus(app.status)}
                      </span>
                      <time className="text-xs text-neutral-500" dateTime={submitted.dateTime}>
                        {submitted.label}
                      </time>
                    </div>
                    <h2 className="mt-3 text-sm font-semibold text-neutral-900">{displayName}</h2>
                    <p className="mt-1 text-xs font-medium text-neutral-700">{app.propertyName}</p>
                    <p className="mt-2 text-sm text-neutral-600">{app.unitLabel}</p>
                    <p className="mt-2 text-sm text-neutral-600">
                      <span className="text-neutral-500">Email · </span>
                      {app.email}
                    </p>
                    {app.phone ? (
                      <p className="mt-1 text-sm text-neutral-600">
                        <span className="text-neutral-500">Phone · </span>
                        {app.phone}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm text-neutral-600">
                      <span className="text-neutral-500">Desired move-in · </span>
                      {formatMoveInDate(app.desiredMoveInDate)}
                    </p>
                    <p className="mt-2 font-mono text-xs text-neutral-500">Ref · {app.id}</p>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
