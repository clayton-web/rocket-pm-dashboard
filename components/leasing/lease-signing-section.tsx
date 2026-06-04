"use client";

import {
  refreshLeaseSigningLinkAction,
  retryLeaseExecutionAction,
  sendLeaseForSignatureAction,
  submitPmLeaseSignatureAction,
} from "@/app/(dashboard)/leasing/tenancies/actions";
import {
  FormSection,
  InlineNotice,
  PrimaryButton,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import { LeaseSigningForm } from "@/components/signing/lease-signing-form";
import type { TenancyStaffDetail } from "@/lib/leasing/tenancy-staff-detail-types";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

function formatDateTime(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function absoluteSigningUrl(path: string) {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function LeaseSigningSection({ detail }: { detail: TenancyStaffDetail }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [signingLink, setSigningLink] = useState<string | null>(detail.leaseSigning.signingUrl);
  const [pending, startTransition] = useTransition();
  const signing = detail.leaseSigning;

  const latestDraftId = detail.rtb1DraftDocuments[0]?.id ?? null;

  const stepItems = useMemo(
    () =>
      signing.steps.map((step) => ({
        ...step,
        timestampLabel: formatDateTime(step.timestamp),
      })),
    [signing.steps],
  );

  function onSendForSignature() {
    if (!latestDraftId) return;
    setError(null);
    startTransition(async () => {
      const result = await sendLeaseForSignatureAction(detail.id, latestDraftId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSigningLink(result.signingUrl);
      router.refresh();
    });
  }

  function onRefreshLink() {
    if (!signing.signatureRequestId) return;
    setError(null);
    startTransition(async () => {
      const result = await refreshLeaseSigningLinkAction(signing.signatureRequestId!);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSigningLink(result.signingUrl);
      router.refresh();
    });
  }

  async function onPmSign(input: {
    signerName: string;
    acknowledgedReview: boolean;
    signatureDataUrl: string;
  }) {
    if (!signing.signatureRequestId) {
      return { ok: false as const, error: "No active signature request" };
    }
    return submitPmLeaseSignatureAction(signing.signatureRequestId, input);
  }

  return (
    <FormSection legend="Lease execution">
      <p className="text-sm text-neutral-600">
        Send the RTB-1 draft for in-app tenant signature, then counter-sign to generate a locked
        executed agreement.
      </p>

      {error ? <InlineNotice className="mt-4">{error}</InlineNotice> : null}

      <ol className={`${SURFACE_PANEL} mt-4 divide-y divide-neutral-200`}>
        {stepItems.map((step) => (
          <li key={step.id} className="flex flex-col gap-0.5 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
                  step.complete ? "bg-emerald-600 text-white" : "bg-neutral-200 text-neutral-600"
                }`}
                aria-hidden
              >
                {step.complete ? "✓" : "·"}
              </span>
              <span className="text-sm font-medium text-neutral-900">{step.label}</span>
            </div>
            {step.timestampLabel ? (
              <span className="text-xs text-neutral-500 sm:ml-7">{step.timestampLabel}</span>
            ) : null}
          </li>
        ))}
      </ol>

      <p className="mt-3 text-sm text-neutral-600">Status: {signing.statusLabel}</p>

      {signing.signatures.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-neutral-700">
          {signing.signatures.map((sig) => (
            <li key={`${sig.signerRole}-${sig.signedAt}`}>
              {sig.signerRole === "tenant" ? "Tenant" : "Property manager"}: {sig.signerName} ·{" "}
              {formatDateTime(sig.signedAt)}
            </li>
          ))}
        </ul>
      ) : null}

      {signing.canSendForSignature ? (
        <PrimaryButton
          type="button"
          className="mt-4 !w-auto px-6"
          disabled={pending}
          onClick={onSendForSignature}
        >
          {pending ? "Sending…" : "Send For Signature"}
        </PrimaryButton>
      ) : null}

      {signing.signatureRequestId &&
      !signing.steps.find((s) => s.id === "tenant_signed")?.complete ? (
        <div className="mt-4 space-y-2">
          {signingLink ? (
            <p className="text-sm text-neutral-700">
              Tenant signing link:{" "}
              <a href={signingLink} className="font-medium underline" target="_blank" rel="noreferrer">
                {absoluteSigningUrl(signingLink)}
              </a>
            </p>
          ) : (
            <p className="text-sm text-neutral-600">
              A signing link was sent. Refresh the link if the tenant needs a new URL.
            </p>
          )}
          <button
            type="button"
            className="text-sm font-medium text-neutral-800 underline disabled:opacity-50"
            disabled={pending}
            onClick={onRefreshLink}
          >
            Refresh signing link
          </button>
        </div>
      ) : null}

      {signing.canRetryLeaseExecution ? (
        <div className="mt-6 border-t border-neutral-200 pt-6">
          <h3 className="text-sm font-semibold text-neutral-900">Complete lease execution</h3>
          <p className="mt-1 text-sm text-neutral-600">
            The property manager signature is recorded but the executed RTB-1 was not finalized.
            Retry to generate the locked executed agreement.
          </p>
          <PrimaryButton
            type="button"
            className="mt-4 !w-auto px-6"
            disabled={pending}
            onClick={() => {
              if (!signing.signatureRequestId) return;
              setError(null);
              startTransition(async () => {
                const result = await retryLeaseExecutionAction(signing.signatureRequestId!);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                router.refresh();
              });
            }}
          >
            {pending ? "Retrying…" : "Retry execution"}
          </PrimaryButton>
        </div>
      ) : null}

      {signing.canPmSign ? (
        <div className="mt-6 border-t border-neutral-200 pt-6">
          <h3 className="text-sm font-semibold text-neutral-900">Property manager counter-sign</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Review the tenant signature, then sign below to generate the executed RTB-1.
          </p>
          <div className="mt-4">
            <LeaseSigningForm
              submitLabel="Counter-sign and execute"
              onSubmit={async (input) => {
                const result = await onPmSign(input);
                if (result.ok) router.refresh();
                return result;
              }}
              successMessage="Executed RTB-1 generated. Download it below."
            />
          </div>
        </div>
      ) : null}

      {signing.executedDownloadHref ? (
        <a
          href={signing.executedDownloadHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block text-sm font-medium text-neutral-900 underline"
        >
          Download executed agreement
        </a>
      ) : null}
    </FormSection>
  );
}
