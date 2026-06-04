"use client";

import { PrimaryButton, SURFACE_PANEL } from "@/components/portal/ui";
import type { ApplicationPortalHandoff } from "@/lib/leasing/application-portal-link";
import Link from "next/link";
import { useState } from "react";

export function ApplicationPortalHandoffPanel({
  handoff,
}: {
  handoff: ApplicationPortalHandoff;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  async function onCopy() {
    setCopyError(null);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const copyText = origin
        ? handoff.copyText.replace(handoff.portalPath, `${origin}${handoff.portalPath}`)
        : handoff.copyText;
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Could not copy to clipboard.");
    }
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
        {copyError ? <span className="text-sm text-red-700">{copyError}</span> : null}
      </div>
    </div>
  );
}
