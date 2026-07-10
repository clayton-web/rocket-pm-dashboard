"use client";

import { PrimaryButton, SURFACE_PANEL } from "@/components/portal/ui";
import { withBasePath } from "@/lib/app-path";
import { markApplicationSentAction } from "@/app/(dashboard)/leasing/prospects/[prospectId]/actions";
import type { ApplicationPortalHandoff } from "@/lib/leasing/application-portal-link";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

function buildAbsoluteCopyText(handoff: ApplicationPortalHandoff): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (!origin) return handoff.copyText;
  return handoff.copyText.replace(handoff.portalPath, `${origin}${withBasePath(handoff.portalPath)}`);
}

function buildMailtoHref(copyText: string, email: string): string {
  const subject = encodeURIComponent("Rental application");
  const body = encodeURIComponent(copyText);
  const to = encodeURIComponent(email.trim());
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

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
  const [showFallback, setShowFallback] = useState(false);
  const [sentPending, startSentTransition] = useTransition();

  const alreadySent = applicationSentAt != null;

  const mailtoHref = useMemo(() => {
    if (typeof window === "undefined") return `mailto:${handoff.email}`;
    return buildMailtoHref(buildAbsoluteCopyText(handoff), handoff.email);
  }, [handoff]);

  async function copyPreparedMessage(): Promise<boolean> {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(buildAbsoluteCopyText(handoff));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      setCopyError("Could not copy to clipboard.");
      return false;
    }
  }

  function markSent() {
    if (!prospectId) return;
    setActionError(null);
    startSentTransition(async () => {
      const result = await markApplicationSentAction(prospectId);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setShowFallback(false);
      router.refresh();
    });
  }

  async function onSendApplication() {
    if (!prospectId || alreadySent || !canMarkApplicationSent) return;
    setActionError(null);
    setShowFallback(false);
    const copiedOk = await copyPreparedMessage();
    if (!copiedOk) {
      setShowFallback(true);
      return;
    }
    markSent();
  }

  async function onCopyAgain() {
    setShowFallback(false);
    await copyPreparedMessage();
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
        {canMarkApplicationSent && prospectId && !alreadySent ? (
          <PrimaryButton
            type="button"
            className="!w-auto px-6"
            disabled={sentPending}
            onClick={() => void onSendApplication()}
          >
            {sentPending ? "Sending…" : copied && !sentPending ? "Copied — saving…" : "Send application"}
          </PrimaryButton>
        ) : null}

        {alreadySent || !canMarkApplicationSent || !prospectId ? (
          <PrimaryButton type="button" className="!w-auto px-6" onClick={() => void onCopyAgain()}>
            {copied ? "Copied" : "Copy message"}
          </PrimaryButton>
        ) : null}

        {copyError ? <span className="text-sm text-red-700">{copyError}</span> : null}
        {actionError ? <span className="text-sm text-red-700">{actionError}</span> : null}
      </div>

      {showFallback && !alreadySent && prospectId ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3">
          <p className="text-sm text-amber-950">
            Clipboard access failed. The application was <span className="font-medium">not</span>{" "}
            marked as sent. Open email with the prepared message, or mark sent after you share it
            another way.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a
              href={mailtoHref}
              className="inline-flex items-center rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white no-underline hover:bg-neutral-800"
            >
              Open in email
            </a>
            <PrimaryButton
              type="button"
              className="!w-auto px-6"
              disabled={sentPending}
              onClick={markSent}
            >
              {sentPending ? "Saving…" : "Mark as sent"}
            </PrimaryButton>
          </div>
        </div>
      ) : null}

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
