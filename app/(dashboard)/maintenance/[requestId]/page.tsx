"use client";

import {
  MaintenanceActionCard,
  MaintenanceDetailHeader,
  TenantReportSection,
  TriageSummaryCard,
} from "@/components/maintenance";
import type { MaintenanceTriageUrgency, MaintenanceWorkflowStatus } from "@/components/maintenance/types";
import { InlineNotice } from "@/components/portal/ui";
import { splitTriageSummaryForDisplay } from "@/lib/maintenance/split-triage";
import { withBasePath } from "@/lib/app-path";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type MaintenanceRequestRow = {
  id: string;
  property_name: string;
  unit_label: string;
  tenant_name: string | null;
  title: string;
  description: string;
  status: string;
  submitted_at: string;
  triage_urgency: string | null;
  triage_trade: string | null;
  triage_summary: string | null;
};

function requestIdFromParams(raw: string | string[] | undefined): string {
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && raw[0]) return String(raw[0]).trim();
  return "";
}

function parseWorkflowStatus(s: string | null | undefined): MaintenanceWorkflowStatus {
  if (typeof s !== "string") return "new";
  const v = s.trim().toLowerCase();
  if (v === "new" || v === "dispatched" || v === "completed" || v === "cancelled") return v;
  return "new";
}

function normalizeUrgency(u: string | null | undefined): MaintenanceTriageUrgency {
  if (u === "emergency" || u === "urgent" || u === "routine") return u;
  return "routine";
}

export default function MaintenanceDetailPage() {
  const params = useParams();
  const requestId = requestIdFromParams(params.requestId);

  const [row, setRow] = useState<MaintenanceRequestRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [patching, setPatching] = useState(false);

  useEffect(() => {
    if (!requestId) {
      setLoading(false);
      setError("Missing request reference.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(withBasePath(`/api/maintenance/${requestId}`))
      .then(async (res) => {
        const payload: unknown = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setRow(null);
          const msg =
            typeof payload === "object" &&
            payload !== null &&
            typeof (payload as { error?: unknown }).error === "string"
              ? (payload as { error: string }).error
              : "Something went wrong.";
          setError(res.status === 403 ? `${msg} You may lack access to this property.` : msg);
          return;
        }
        setRow(payload as MaintenanceRequestRow);
      })
      .catch(() => {
        if (!cancelled) {
          setRow(null);
          setError("Could not load this request.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const persistPatch = useCallback(
    async (body: Record<string, unknown>) => {
      if (!requestId) return;
      setActionError(null);
      setPatching(true);
      try {
        const res = await fetch(withBasePath(`/api/maintenance/${requestId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload: unknown = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            typeof payload === "object" &&
            payload !== null &&
            typeof (payload as { message?: unknown }).message === "string"
              ? (payload as { message: string }).message
              : typeof payload === "object" &&
                  payload !== null &&
                  typeof (payload as { error?: unknown }).error === "string"
                ? (payload as { error: string }).error
                : "Update failed.";
          setActionError(msg);
          return;
        }
        setRow(payload as MaintenanceRequestRow);
      } finally {
        setPatching(false);
      }
    },
    [requestId],
  );

  const workflowStatus = row ? parseWorkflowStatus(row.status) : "new";
  const submitted = row
    ? (() => {
        const d = new Date(row.submitted_at);
        return Number.isNaN(d.getTime())
          ? { display: row.submitted_at, atIso: row.submitted_at }
          : {
              display: d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
              atIso: d.toISOString(),
            };
      })()
    : { display: "", atIso: "" };

  const triageParts = row ? splitTriageSummaryForDisplay(row.triage_summary) : { narrative: "", guidedMetaRaw: null };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/maintenance" className="text-sm font-medium text-neutral-700 underline">
          ← Back to maintenance queue
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">Request detail</h1>
      </div>

      {loading ? <InlineNotice>Loading request…</InlineNotice> : null}
      {!loading && error ? <InlineNotice>{error}</InlineNotice> : null}

      {!loading && row ? (
        <div className="flex flex-col gap-6">
          <MaintenanceDetailHeader
            issueType={row.title}
            workflowStatus={workflowStatus}
            propertyName={row.property_name}
            unitLabel={row.unit_label?.trim() || "—"}
            tenantName={row.tenant_name?.trim() || "—"}
            submittedAt={submitted.display}
            submittedAtIso={submitted.atIso}
          />
          <TenantReportSection description={row.description} photos={[]} accessInstructions="" />
          <TriageSummaryCard
            triage={{
              urgency: normalizeUrgency(row.triage_urgency),
              suggestedTrade: row.triage_trade?.trim() || "—",
              summary: triageParts.narrative,
              ...(triageParts.guidedMetaRaw ? { technicalAppendix: triageParts.guidedMetaRaw } : {}),
            }}
          />
          {actionError ? <InlineNotice role="alert">{actionError}</InlineNotice> : null}
          <MaintenanceActionCard
            workflowStatus={workflowStatus}
            actionsDisabled={patching}
            onDispatched={(assignee) => persistPatch({ status: "dispatched", assigned_to_name: assignee })}
            onCompleted={(note) => persistPatch({ status: "completed", completion_note: note })}
            onCancelled={(note) => persistPatch({ status: "cancelled", completion_note: note })}
          />
        </div>
      ) : null}
    </div>
  );
}
