"use client";

import {
  FormField,
  InlineNotice,
  PrimaryButton,
} from "@/components/portal/ui";
import { SignaturePad } from "@/components/signing/signature-pad";
import { useState, useTransition } from "react";

type LeaseSigningFormProps = {
  expectedName?: string;
  submitLabel: string;
  onSubmit: (input: {
    signerName: string;
    acknowledgedReview: boolean;
    signatureDataUrl: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  disabled?: boolean;
  successMessage?: string;
};

export function LeaseSigningForm({
  expectedName,
  submitLabel,
  onSubmit,
  disabled = false,
  successMessage,
}: LeaseSigningFormProps) {
  const [signerName, setSignerName] = useState(expectedName ?? "");
  const [acknowledgedReview, setAcknowledgedReview] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!acknowledgedReview) {
      setError("Confirm that you have reviewed the agreement.");
      return;
    }
    if (!signerName.trim()) {
      setError("Enter your legal name.");
      return;
    }
    if (!signatureDataUrl) {
      setError("Draw your signature before submitting.");
      return;
    }

    startTransition(async () => {
      const result = await onSubmit({
        signerName: signerName.trim(),
        acknowledgedReview,
        signatureDataUrl,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <InlineNotice>{successMessage ?? "Your signature has been recorded."}</InlineNotice>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? <InlineNotice>{error}</InlineNotice> : null}

      <FormField label="Legal name" htmlFor="signer-name">
        <input
          id="signer-name"
          type="text"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          value={signerName}
          disabled={disabled || pending}
          onChange={(e) => setSignerName(e.target.value)}
          autoComplete="name"
        />
      </FormField>

      <label className="flex items-start gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          className="mt-1"
          checked={acknowledgedReview}
          disabled={disabled || pending}
          onChange={(e) => setAcknowledgedReview(e.target.checked)}
        />
        <span>I confirm that I have reviewed this tenancy agreement and understand its terms.</span>
      </label>

      <FormField label="Signature">
        <SignaturePad
          disabled={disabled || pending}
          onChange={setSignatureDataUrl}
        />
      </FormField>

      <PrimaryButton type="submit" disabled={disabled || pending} className="!w-auto px-6">
        {pending ? "Submitting…" : submitLabel}
      </PrimaryButton>
    </form>
  );
}
