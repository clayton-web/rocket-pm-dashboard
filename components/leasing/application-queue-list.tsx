"use client";

import {
  FormField,
  FormSection,
  InlineNotice,
  SURFACE_CARD,
  SURFACE_PANEL,
  toggleTileClasses,
} from "@/components/portal/ui";
import { FOCUS_RING } from "@/components/portal/focus";
import { StatusBadge } from "@/components/portal/status-badge";
import type { ApplicationConversionQueueRow } from "@/lib/leasing/application-conversion-staff-queue";
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

type ApplicationQueueListProps = {
  loadError: string | null;
} & (
  | {
      queueMode: "review";
      initialApplications: ApplicationQueueRow[];
    }
  | {
      queueMode: "conversion";
      initialApplications: ApplicationConversionQueueRow[];
    }
);

export function ApplicationQueueList(props: ApplicationQueueListProps) {
  const { loadError, queueMode } = props;
  const [applications] = useState(props.initialApplications);
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

  const isConversion = queueMode === "conversion";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          {isConversion ? "Approved · finish leasing" : "Rental applications"}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {isConversion ? (
            <>
              Recovery queue for approved applications that still need tenancy creation or
              placement completion. Prefer finishing from the application page after Approve.{" "}
              <Link href="/leasing/applications" className={`font-medium underline ${FOCUS_RING}`}>
                View review queue
              </Link>
            </>
          ) : (
            <>
              Submitted and in-review applications from public intake.{" "}
              <Link href="/leasing/applications?queue=conversion" className={`font-medium underline ${FOCUS_RING}`}>
                Recovery: unfinished approved
              </Link>
              {" · Public form: "}
              <Link href="/portal/application" className={`font-medium underline ${FOCUS_RING}`}>
                /portal/application
              </Link>
            </>
          )}
        </p>
      </div>

      {loadError ? (
        <InlineNotice className="mb-4" tone="danger">
          {loadError}
        </InlineNotice>
      ) : null}

      <div className="flex flex-col gap-8">
        <FormField
          label="Queue overview"
          htmlFor="application-queue-summary"
        >
          <output id="application-queue-summary" className={`block ${SURFACE_PANEL} px-3.5 py-3 text-sm`}>
            <span className="font-medium text-foreground">
              {applications.length} application{applications.length === 1 ? "" : "s"}
            </span>
            <span className="mt-1 block text-foreground-muted">{visible.length} shown with current filter</span>
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
          <InlineNotice>
            {isConversion
              ? "No approved applications waiting for conversion."
              : "No submitted applications yet."}
          </InlineNotice>
        ) : visible.length === 0 ? (
          <InlineNotice>No applications match this filter.</InlineNotice>
        ) : (
          <ul className="flex list-none flex-col gap-3 p-0">
            {visible.map((app) => {
              const timestamp = isConversion
                ? formatSubmittedAt(
                    (app as ApplicationConversionQueueRow).decisionAt ??
                      app.submittedAt,
                  )
                : formatSubmittedAt(app.submittedAt);
              const displayName = formatName(app.firstName, app.lastName, app.email);
              return (
                <li key={app.id}>
                  <Link
                    href={`/leasing/applications/${app.id}`}
                    className={`block ${SURFACE_CARD} px-4 py-4 transition-colors hover:border-foreground-subtle ${FOCUS_RING}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <StatusBadge
                        tone={
                          isConversion
                            ? (app as ApplicationConversionQueueRow).canConvertToManagedTenancy
                              ? "success"
                              : "warning"
                            : "neutral"
                        }
                        emphasis={isConversion ? "soft" : "strong"}
                      >
                        {isConversion
                          ? (app as ApplicationConversionQueueRow).conversionStateLabel
                          : formatApplicationQueueStatus(app.status)}
                      </StatusBadge>
                      <time className="text-xs text-foreground-subtle" dateTime={timestamp.dateTime}>
                        {timestamp.label}
                      </time>
                    </div>
                    <h2 className="mt-3 text-sm font-semibold text-foreground">{displayName}</h2>
                    <p className="mt-1 text-xs font-medium text-foreground-muted">{app.propertyName}</p>
                    <p className="mt-2 text-sm text-foreground-muted">{app.unitLabel}</p>
                    <p className="mt-2 text-sm text-foreground-muted">
                      <span className="text-foreground-subtle">Email · </span>
                      {app.email}
                    </p>
                    {app.phone ? (
                      <p className="mt-1 text-sm text-foreground-muted">
                        <span className="text-foreground-subtle">Phone · </span>
                        {app.phone}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm text-foreground-muted">
                      <span className="text-foreground-subtle">Desired move-in · </span>
                      {formatMoveInDate(app.desiredMoveInDate)}
                    </p>
                    <p className="mt-2 font-mono text-xs text-foreground-subtle">Ref · {app.id}</p>
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
