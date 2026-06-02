"use client";

import {
  FormField,
  FormSection,
  InlineAlert,
  PortalPageHeader,
  PrimaryButton,
  SelectionCard,
  StickyFormFooter,
  SURFACE_DASHED,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import { PortalBackLink } from "@/components/portal/portal-nav";
import { tradeFromIssueLabel } from "@/lib/maintenance/triage-map";
import { parseCreatedMaintenanceRequestId } from "@/lib/validation/maintenance";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

const ISSUE_TYPES = [
  { label: "Leak", issueType: "leak" },
  { label: "Heating", issueType: "heating" },
  { label: "Electrical", issueType: "electrical" },
  { label: "Appliance", issueType: "appliance" },
  { label: "Other", issueType: "other" },
] as const;

type SubmitOption = { tenancyId: string; label: string };

export default function TenantMaintenanceNewPage() {
  const descriptionId = useId();
  const tenancySelectId = useId();
  const photosId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [options, setOptions] = useState<SubmitOption[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [selectedTenancyId, setSelectedTenancyId] = useState("");
  const [issueType, setIssueType] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [photoLabel, setPhotoLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/maintenance/submit-options")
      .then(async (res) => {
        const payload: unknown = await res.json().catch(() => []);
        if (!res.ok || !Array.isArray(payload)) {
          setOptionsError("Could not load property options. Try again later.");
          return;
        }
        setOptions(payload as SubmitOption[]);
        if (payload.length === 1) {
          setSelectedTenancyId((payload[0] as SubmitOption).tenancyId);
        }
      })
      .catch(() => setOptionsError("Could not load property options."));
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);

      if (!selectedTenancyId) {
        setError("Please select your property and unit.");
        return;
      }
      if (!issueType) {
        setError("Please select an issue type.");
        return;
      }

      const trimmed = description.trim();
      if (!trimmed) {
        setError("Please add a brief description.");
        return;
      }

      const label = ISSUE_TYPES.find((t) => t.issueType === issueType)?.label ?? issueType;
      const photoCount = fileInputRef.current?.files?.length ?? 0;
      const photoNote =
        photoCount > 0
          ? `[Tenant attached ${photoCount} photo(s); file upload storage not yet wired.]`
          : undefined;
      const descriptionBody = `[Tenant-selected category: ${label}]\n\n${trimmed}${photoNote ? `\n\n${photoNote}` : ""}`;

      const body = {
        tenancyId: selectedTenancyId,
        title: `${label} — maintenance report`,
        description: descriptionBody,
        issueType,
        triage_urgency: "routine" as const,
        triage_trade: tradeFromIssueLabel(issueType),
        triage_summary: "Submitted without guided triage",
      };

      setLoading(true);
      try {
        const res = await fetch("/api/maintenance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const parsed: unknown = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            typeof parsed === "object" &&
            parsed !== null &&
            typeof (parsed as { error?: unknown }).error === "string"
              ? (parsed as { error: string }).error
              : "We could not send your report. Please try again.";
          setError(msg);
          return;
        }
        const requestId = parseCreatedMaintenanceRequestId(parsed);
        if (!requestId) {
          setError("Report submitted but reference could not be confirmed.");
          return;
        }
        setSubmittedRequestId(requestId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed");
      } finally {
        setLoading(false);
      }
    },
    [description, issueType, selectedTenancyId],
  );

  if (submittedRequestId !== null) {
    return (
      <div className="pb-14 pt-1">
        <PortalBackLink />
        <PortalPageHeader
          eyebrow="Maintenance"
          title="We've got it"
          description="Your maintenance request is submitted. Save your reference to check status later."
        />
        <div className={`mt-6 ${SURFACE_PANEL} px-3.5 py-4`}>
          <p className="text-xs text-neutral-500">Your reference</p>
          <p className="mt-1 break-all font-mono text-sm">{submittedRequestId}</p>
          <p className="mt-3 text-sm text-neutral-600">
            <Link href="/portal/maintenance/status" className="font-medium text-neutral-900 underline">
              Check status
            </Link>{" "}
            using this reference and your tenancy email.
          </p>
        </div>
        <p className="mt-4">
          <Link href="/portal" className="text-sm font-medium text-neutral-700 underline">
            Back to tenant portal
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="pb-24 pt-1">
      <PortalBackLink />
      <PortalPageHeader
        eyebrow="Tenant portal"
        title="Report a maintenance issue"
        description="Share a few details and we will route your request. No account required for this form."
      />

      <form className="flex flex-col gap-8" onSubmit={onSubmit} noValidate>
        <FormField
          htmlFor={tenancySelectId}
          label="Your home"
          helper="Select the property and unit this request is for."
        >
          {optionsError ? <InlineAlert>{optionsError}</InlineAlert> : null}
          <select
            id={tenancySelectId}
            value={selectedTenancyId}
            onChange={(e) => setSelectedTenancyId(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-sm"
            required
          >
            <option value="">Select property / unit…</option>
            {options.map((o) => (
              <option key={o.tenancyId} value={o.tenancyId}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormSection legend="Issue type" helper="Choose the option that best fits.">
          {ISSUE_TYPES.map(({ label, issueType: key }) => (
            <SelectionCard
              key={key}
              selected={issueType === key}
              onSelect={() => {
                setIssueType(key);
                setError(null);
              }}
            >
              {label}
            </SelectionCard>
          ))}
        </FormSection>

        <FormField
          htmlFor={photosId}
          label="Photos (optional)"
          helper="Photo upload is metadata-only until storage is wired."
        >
          <input
            ref={fileInputRef}
            id={photosId}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              const n = e.target.files?.length ?? 0;
              setPhotoLabel(n === 0 ? null : n === 1 ? "1 photo attached" : `${n} photos attached`);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`flex min-h-[3.25rem] w-full items-center justify-center px-4 py-3.5 text-sm ${SURFACE_DASHED}`}
          >
            {photoLabel ?? "Add photos"}
          </button>
        </FormField>

        <FormField htmlFor={descriptionId} label="Brief description (required)">
          <textarea
            id={descriptionId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="min-h-[8.5rem] w-full resize-y rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
          />
        </FormField>

        {error ? <InlineAlert>{error}</InlineAlert> : null}

        <StickyFormFooter>
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Submitting…" : "Submit report"}
          </PrimaryButton>
        </StickyFormFooter>
      </form>
    </div>
  );
}
