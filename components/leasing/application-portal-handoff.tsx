"use client";

import { Button, buttonClasses } from "@/components/portal/button";
import { FOCUS_RING } from "@/components/portal/focus";
import { noticeClasses, SURFACE_PANEL } from "@/components/portal/ui";
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
      <p className="text-sm text-foreground-muted">{handoff.instructionText}</p>
      <p className="mt-2 text-sm text-foreground-muted">
        <span className="text-foreground-subtle">Application form · </span>
        <Link href={handoff.portalPath} className={`font-medium underline ${FOCUS_RING}`}>
          {handoff.portalPath}
        </Link>
      </p>
      <p className="mt-2 text-sm text-foreground-muted">
        <span className="text-foreground-subtle">Property · </span>
        {handoff.propertyName}
      </p>
      {handoff.unitLabel ? (
        <p className="mt-1 text-sm text-foreground-muted">
          <span className="text-foreground-subtle">Unit · </span>
          {handoff.unitLabel}
        </p>
      ) : null}
      <p className="mt-1 text-sm text-foreground-muted">
        <span className="text-foreground-subtle">Email for prefill · </span>
        {handoff.email}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {canMarkApplicationSent && prospectId && !alreadySent ? (
          <Button
            variant="primary"
            size="lg"
            disabled={sentPending}
            onClick={() => void onSendApplication()}
          >
            {sentPending ? "Sending…" : copied && !sentPending ? "Copied — saving…" : "Send application"}
          </Button>
        ) : null}

        {alreadySent || !canMarkApplicationSent || !prospectId ? (
          <Button variant="primary" size="lg" onClick={() => void onCopyAgain()}>
            {copied ? "Copied" : "Copy message"}
          </Button>
        ) : null}

        {copyError ? (
          <span className="text-sm font-medium text-danger-foreground" role="alert">
            {copyError}
          </span>
        ) : null}
        {actionError ? (
          <span className="text-sm font-medium text-danger-foreground" role="alert">
            {actionError}
          </span>
        ) : null}
      </div>

      {showFallback && !alreadySent && prospectId ? (
        <div className={noticeClasses("warning", "compact", "mt-4")} role="alert">
          <p className="text-sm">
            Clipboard access failed. The application was <span className="font-medium">not</span>{" "}
            marked as sent. Open email with the prepared message, or mark sent after you share it
            another way.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a href={mailtoHref} className={buttonClasses({ variant: "primary" })}>
              Open in email
            </a>
            <Button variant="primary" size="lg" disabled={sentPending} onClick={markSent}>
              {sentPending ? "Saving…" : "Mark as sent"}
            </Button>
          </div>
        </div>
      ) : null}

      {applicationSentAt ? (
        <p className="mt-3 text-xs text-foreground-muted">
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
