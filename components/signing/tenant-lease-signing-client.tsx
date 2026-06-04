"use client";

import { LeaseSigningForm } from "@/components/signing/lease-signing-form";
import { InlineNotice } from "@/components/portal/ui";
import { useRouter } from "next/navigation";

type TenantLeaseSigningClientProps = {
  token: string;
  propertyName: string;
  unitLabel: string;
  tenantExpectedName: string;
  alreadySigned: boolean;
  signerName: string | null;
  signedAt: string | null;
};

export function TenantLeaseSigningClient({
  token,
  propertyName,
  unitLabel,
  tenantExpectedName,
  alreadySigned,
  signerName,
  signedAt,
}: TenantLeaseSigningClientProps) {
  const router = useRouter();

  async function submitSignature(input: {
    signerName: string;
    acknowledgedReview: boolean;
    signatureDataUrl: string;
  }) {
    const response = await fetch(`/api/sign/lease/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      return { ok: false as const, error: body?.error ?? "Could not submit signature" };
    }
    router.refresh();
    return { ok: true as const };
  }

  return (
    <>
      <div className="space-y-1">
        <p className="text-sm text-neutral-600">
          {propertyName} · {unitLabel}
        </p>
        <p className="text-sm text-neutral-700">
          Review the RTB-1 draft, confirm your legal name, and sign below. This secure link is separate
          from tenant portal login, which becomes available after your property manager activates your
          tenancy.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <a
          href={`/api/sign/lease/${encodeURIComponent(token)}/document`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-neutral-900 underline"
        >
          View / download draft
        </a>
      </div>

      {alreadySigned ? (
        <InlineNotice className="mt-6">
          You signed this agreement as {signerName} on{" "}
          {signedAt
            ? new Date(signedAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "record"}
          . Your property manager will counter-sign to finalize the lease.
        </InlineNotice>
      ) : (
        <div className="mt-6">
          <LeaseSigningForm
            expectedName={tenantExpectedName}
            submitLabel="Submit signature"
            successMessage="Thank you. Your signature has been recorded. You may close this page."
            onSubmit={submitSignature}
          />
        </div>
      )}
    </>
  );
}
