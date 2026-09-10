"use client";

import { Button } from "@/components/portal/button";
import { FOCUS_RING } from "@/components/portal/focus";
import { formControlClasses } from "@/components/portal/form-control";
import { FormField, InlineNotice } from "@/components/portal/ui";
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
      <InlineNotice tone="success" role="status">
        {successMessage ?? "Your signature has been recorded."}
      </InlineNotice>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <InlineNotice tone="danger" role="alert">
          {error}
        </InlineNotice>
      ) : null}

      <FormField label="Legal name" htmlFor="signer-name">
        <input
          id="signer-name"
          type="text"
          className={formControlClasses()}
          value={signerName}
          disabled={disabled || pending}
          onChange={(e) => setSignerName(e.target.value)}
          autoComplete="name"
        />
      </FormField>

      <label className="flex items-start gap-2 text-sm text-foreground-muted">
        <input
          type="checkbox"
          className={`mt-1 h-4 w-4 rounded border-border-strong ${FOCUS_RING}`}
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

      <Button variant="primary" size="lg" type="submit" disabled={disabled || pending}>
        {pending ? "Submitting…" : submitLabel}
      </Button>
    </form>
  );
}
