"use client";

import {
  FormField,
  InlineAlert,
  PortalPageHeader,
  PrimaryButton,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import { PortalBackLink } from "@/components/portal/portal-nav";
import { withBasePath } from "@/lib/app-path";
import Link from "next/link";
import { useState } from "react";

type StatusResult = {
  id: string;
  title: string;
  statusLabel: string;
  urgency: string;
  trade: string;
  submittedAt: string;
  scheduledWorkAt: string | null;
  completedAt: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function MaintenanceStatusPage() {
  const [requestId, setRequestId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StatusResult | null>(null);

  return (
    <div className="pb-14 pt-1">
      <PortalBackLink />
      <PortalPageHeader
        eyebrow="Maintenance"
        title="Check request status"
        description="Enter the reference number from your confirmation and the email address on your tenancy."
      />

      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setResult(null);
          setLoading(true);
          try {
            const res = await fetch(withBasePath("/api/portal/maintenance/lookup"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ requestId: requestId.trim(), email: email.trim() }),
            });
            const payload: unknown = await res.json().catch(() => ({}));
            if (!res.ok) {
              const msg =
                typeof payload === "object" &&
                payload !== null &&
                typeof (payload as { error?: unknown }).error === "string"
                  ? (payload as { error: string }).error
                  : "Could not find a matching request.";
              setError(msg);
              return;
            }
            setResult(payload as StatusResult);
          } catch {
            setError("Something went wrong. Please try again.");
          } finally {
            setLoading(false);
          }
        }}
      >
        <FormField htmlFor="requestId" label="Reference number" helper="From your submission confirmation.">
          <input
            id="requestId"
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
            required
            className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 font-mono text-sm"
            placeholder="Paste your reference"
            autoComplete="off"
          />
        </FormField>
        <FormField htmlFor="email" label="Email" helper="Must match your tenancy contact email on file.">
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
            autoComplete="email"
          />
        </FormField>
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? "Looking up…" : "Check status"}
        </PrimaryButton>
      </form>

      {result ? (
        <div className={`mt-8 ${SURFACE_PANEL} px-3.5 py-4`}>
          <h2 className="text-sm font-semibold text-neutral-900">{result.title}</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-xs text-neutral-500">Status</dt>
              <dd className="mt-0.5 text-neutral-800">{result.statusLabel}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Submitted</dt>
              <dd className="mt-0.5 text-neutral-800">{formatDate(result.submittedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Urgency / trade</dt>
              <dd className="mt-0.5 capitalize text-neutral-800">
                {result.urgency} · {result.trade.replace(/_/g, " ")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Scheduled work</dt>
              <dd className="mt-0.5 text-neutral-800">{formatDate(result.scheduledWorkAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Completed</dt>
              <dd className="mt-0.5 text-neutral-800">{formatDate(result.completedAt)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-neutral-500">
            Reference · <span className="font-mono">{result.id}</span>
          </p>
        </div>
      ) : null}

      <p className="mt-6 text-sm text-neutral-600">
        Need to report a new issue?{" "}
        <Link href="/portal/maintenance/new" className="font-medium underline">
          Submit maintenance
        </Link>
      </p>
    </div>
  );
}
