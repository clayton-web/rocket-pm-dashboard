"use client";

import {
  FormField,
  FormSection,
  InlineNotice,
  PrimaryButton,
  SURFACE_CARD,
  SURFACE_PANEL,
  toggleTileClasses,
} from "@/components/portal/ui";
import { triageSummaryListPreview } from "@/lib/maintenance/split-triage";
import Link from "next/link";
import { useMemo, useState } from "react";

type MaintenanceRequestRow = {
  id: string;
  property_id: string;
  property_name: string;
  unit_label: string;
  tenant_name: string | null;
  title: string;
  description: string;
  status: string | null | undefined;
  submitted_at: string;
  triage_urgency: string | null;
  triage_trade: string | null;
  triage_summary: string | null;
};

type RequestStatus = "new" | "dispatched" | "completed" | "cancelled";
type FilterKey = "all" | RequestStatus;

const FILTERS: readonly { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "dispatched", label: "Dispatched" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

function normalizeWorkflowStatus(raw: unknown): RequestStatus {
  if (typeof raw !== "string") return "new";
  const s = raw.trim().toLowerCase();
  if (s === "new" || s === "dispatched" || s === "completed" || s === "cancelled") return s;
  return "new";
}

function statusBadgeClasses(status: RequestStatus): string {
  const base = "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium";
  switch (status) {
    case "new":
      return `${base} border border-neutral-300 bg-white text-neutral-800`;
    case "dispatched":
      return `${base} bg-neutral-100 text-neutral-800`;
    case "completed":
      return `${base} bg-neutral-900 text-white`;
    case "cancelled":
      return `${base} text-neutral-500`;
    default:
      return base;
  }
}

function statusLabel(status: RequestStatus): string {
  switch (status) {
    case "new":
      return "New";
    case "dispatched":
      return "Dispatched";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function formatSubmittedAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { label: iso, dateTime: iso };
  return {
    label: d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
    dateTime: d.toISOString(),
  };
}

function formatUnitTenantLine(unitLabel: string | null | undefined, tenantName: string | null | undefined) {
  const unit = unitLabel?.trim();
  const tenant = tenantName?.trim();
  if (unit && tenant) return `${unit} · ${tenant}`;
  if (unit) return unit;
  if (tenant) return tenant;
  return "No unit or tenant on file";
}

function formatTriageHint(triageUrgency: string | null | undefined, triageTrade: string | null | undefined) {
  const u = triageUrgency?.trim().toLowerCase();
  const urgency =
    u === "emergency" ? "Emergency" : u === "urgent" ? "Urgent" : u === "routine" ? "Routine" : null;
  const trade = triageTrade?.trim();
  if (urgency && trade) return `${urgency} · ${trade}`;
  if (trade) return trade;
  if (urgency) return urgency;
  return null;
}

function urgencyListAccentClass(triageUrgency: string | null | undefined) {
  const u = triageUrgency?.trim().toLowerCase();
  if (u === "emergency") return "border-l-[3px] border-l-red-600";
  if (u === "urgent") return "border-l-[3px] border-l-amber-500";
  return "border-l-[3px] border-l-transparent";
}

export function MaintenanceManagerList({
  initialRequests,
  loadError,
}: {
  initialRequests: MaintenanceRequestRow[];
  loadError: string | null;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const requests = initialRequests;

  const visible = useMemo(() => {
    if (filter === "all") return requests;
    return requests.filter((r) => normalizeWorkflowStatus(r.status) === filter);
  }, [requests, filter]);

  const queueCounts = useMemo(() => {
    const c = { new: 0, dispatched: 0, completed: 0, cancelled: 0 };
    for (const r of requests) {
      c[normalizeWorkflowStatus(r.status)]++;
    }
    return c;
  }, [requests]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Maintenance</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Organization queue — newest first. Tenant intake:{" "}
          <Link href="/portal/maintenance/new" className="font-medium underline">
            /portal/maintenance/new
          </Link>
        </p>
      </div>

      {loadError ? <InlineNotice className="mb-4">{loadError}</InlineNotice> : null}

      <div className="flex flex-col gap-8">
        <FormField label="Queue overview" htmlFor="queue-summary">
          <output id="queue-summary" className={`block ${SURFACE_PANEL} px-3.5 py-3 text-sm`}>
            <span className="font-medium text-neutral-900">
              {requests.length} total · {queueCounts.new} new · {queueCounts.dispatched} dispatched ·{" "}
              {queueCounts.completed} completed · {queueCounts.cancelled} cancelled
            </span>
            <span className="mt-1 block text-neutral-600">{visible.length} shown with current filter</span>
          </output>
        </FormField>

        <FormSection legend="Filter">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={toggleTileClasses(filter === key)}
                aria-pressed={filter === key}
              >
                {label}
              </button>
            ))}
          </div>
        </FormSection>

        {requests.length === 0 ? (
          <InlineNotice>No maintenance requests yet.</InlineNotice>
        ) : visible.length === 0 ? (
          <InlineNotice>No requests match this filter.</InlineNotice>
        ) : (
          <ul className="flex list-none flex-col gap-3 p-0">
            {visible.map((req) => {
              const rowStatus = normalizeWorkflowStatus(req.status);
              const submitted = formatSubmittedAt(req.submitted_at);
              const triageHint = formatTriageHint(req.triage_urgency, req.triage_trade);
              const triageSnippet = triageSummaryListPreview(req.triage_summary);
              return (
                <li key={req.id}>
                  <article
                    className={`${SURFACE_CARD} overflow-hidden py-4 pl-3 pr-4 ${urgencyListAccentClass(req.triage_urgency)}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className={statusBadgeClasses(rowStatus)}>{statusLabel(rowStatus)}</span>
                      <time className="text-xs text-neutral-500" dateTime={submitted.dateTime}>
                        {submitted.label}
                      </time>
                    </div>
                    <h2 className="mt-3 text-sm font-semibold text-neutral-900">
                      {req.title.trim() || "Untitled request"}
                    </h2>
                    <p className="mt-1 text-xs font-medium text-neutral-700">{req.property_name}</p>
                    <p className="mt-2 line-clamp-3 text-sm text-neutral-600">
                      {formatUnitTenantLine(req.unit_label, req.tenant_name)}
                    </p>
                    {triageHint ? (
                      <p className="mt-2 text-sm">
                        <span className="text-xs text-neutral-500">Routing · </span>
                        <span className="font-medium">{triageHint}</span>
                      </p>
                    ) : null}
                    {triageSnippet ? (
                      <p className="mt-2 line-clamp-2 text-sm text-neutral-700" title={triageSnippet}>
                        {triageSnippet}
                      </p>
                    ) : null}
                    <p className="mt-2 font-mono text-xs text-neutral-500">Ref · {req.id}</p>
                    <div className="mt-4">
                      <Link href={`/maintenance/${req.id}`}>
                        <PrimaryButton type="button" className="!w-auto px-6">
                          Review request
                        </PrimaryButton>
                      </Link>
                    </div>
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
