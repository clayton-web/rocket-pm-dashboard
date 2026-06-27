"use client";

import { PrimaryButton, SURFACE_PANEL } from "@/components/portal/ui";
import { withBasePath } from "@/lib/app-path";
import { markApplicationSentAction } from "@/app/(dashboard)/leasing/prospects/[prospectId]/actions";
import type { ApplicationPortalHandoff } from "@/lib/leasing/application-portal-link";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ApplicationPortalHandoffPanel({
  handoff,
  prospectId,
  canMarkApplicationSent = false,
  applicationSentAt = null,
}: {
  handoff: ApplicationPortalHandoff;
  prospectId?: string;
  canMarkApplicationSent?: boolean;
  applicationSentAt?: string | null;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sentPending, startSentTransition] = useTransition();

  async function onCopy() {
    setCopyError(null);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const copyText = origin
        ? handoff.copyText.replace(handoff.portalPath, `${origin}${withBasePath(handoff.portalPath)}`)
        : handoff.copyText;
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Could not copy to clipboard.");
    }
  }

  function onMarkApplicationSent() {
    if (!prospectId) return;
    setActionError(null);
    startSentTransition(async () => {
      const result = await markApplicationSentAction(prospectId);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className={`${SURFACE_PANEL} px-3.5 py-3`}>
      <p className="text-sm text-neutral-700">{handoff.instructionText}</p>
      <p className="mt-2 text-sm text-neutral-700">
        <span className="text-neutral-500">Application form · </span>
        <Link href={handoff.portalPath} className="font-medium underline">
          {handoff.portalPath}
        </Link>
      </p>
      <p className="mt-2 text-sm text-neutral-600">
        <span className="text-neutral-500">Property · </span>
        {handoff.propertyName}
      </p>
      {handoff.unitLabel ? (
        <p className="mt-1 text-sm text-neutral-600">
          <span className="text-neutral-500">Unit · </span>
          {handoff.unitLabel}
        </p>
      ) : null}
      <p className="mt-1 text-sm text-neutral-600">
        <span className="text-neutral-500">Email for prefill · </span>
        {handoff.email}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PrimaryButton type="button" className="!w-auto px-6" onClick={() => void onCopy()}>
          {copied ? "Copied" : "Copy handoff text"}
        </PrimaryButton>
        {canMarkApplicationSent && prospectId ? (
          <PrimaryButton
            type="button"
            className="!w-auto px-6"
            disabled={sentPending}
            onClick={onMarkApplicationSent}
          >
            {sentPending ? "Saving…" : "Mark Application Sent"}
          </PrimaryButton>
        ) : null}
        {copyError ? <span className="text-sm text-red-700">{copyError}</span> : null}
        {actionError ? <span className="text-sm text-red-700">{actionError}</span> : null}
      </div>
      {applicationSentAt ? (
        <p className="mt-3 text-xs text-neutral-600">
          Application marked sent{" "}
          {new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(
            new Date(applicationSentAt),
          )}
          .
        </p>
      ) : null}
    </div>
  );
}
