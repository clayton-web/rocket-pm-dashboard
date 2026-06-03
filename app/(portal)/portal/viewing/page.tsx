"use client";

import {
  FormField,
  InlineAlert,
  PortalPageHeader,
  PrimaryButton,
  StickyFormFooter,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import { PortalBackLink } from "@/components/portal/portal-nav";
import { parseCreatedProspectId } from "@/lib/validation/leasing";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

type LeasingSubmitOption = {
  propertyId: string;
  propertyName: string;
  units: { unitId: string; unitNumber: string }[];
};

export default function ViewingRequestPage() {
  const propertySelectId = useId();
  const unitSelectId = useId();
  const firstNameId = useId();
  const lastNameId = useId();
  const emailId = useId();
  const phoneId = useId();
  const messageId = useId();

  const [options, setOptions] = useState<LeasingSubmitOption[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedProspectId, setSubmittedProspectId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/leasing/submit-options")
      .then(async (res) => {
        const payload: unknown = await res.json().catch(() => []);
        if (!res.ok || !Array.isArray(payload)) {
          setOptionsError("Could not load rental options. Try again later.");
          return;
        }
        const list = payload as LeasingSubmitOption[];
        setOptions(list);
        if (list.length === 1) {
          setSelectedPropertyId(list[0].propertyId);
        }
      })
      .catch(() => setOptionsError("Could not load rental options."));
  }, []);

  const selectedProperty = useMemo(
    () => options.find((o) => o.propertyId === selectedPropertyId) ?? null,
    [options, selectedPropertyId],
  );

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);

      if (!selectedPropertyId) {
        setError("Please select a property.");
        return;
      }

      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        setError("Please enter your email address.");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/leasing/viewing-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: selectedPropertyId,
            unitId: selectedUnitId || undefined,
            email: trimmedEmail,
            firstName: firstName.trim() || undefined,
            lastName: lastName.trim() || undefined,
            phone: phone.trim() || undefined,
            message: message.trim() || undefined,
          }),
        });
        const parsed: unknown = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            typeof parsed === "object" &&
            parsed !== null &&
            typeof (parsed as { error?: unknown }).error === "string"
              ? (parsed as { error: string }).error
              : "We could not send your request. Please try again.";
          setError(msg);
          return;
        }
        const prospectId = parseCreatedProspectId(parsed);
        if (!prospectId) {
          setError("Request submitted but reference could not be confirmed.");
          return;
        }
        setSubmittedProspectId(prospectId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed");
      } finally {
        setLoading(false);
      }
    },
    [email, firstName, lastName, message, phone, selectedPropertyId, selectedUnitId],
  );

  if (submittedProspectId !== null) {
    return (
      <div className="pb-14 pt-1">
        <PortalBackLink />
        <PortalPageHeader
          eyebrow="Viewing request"
          title="We've received your request"
          description="Our team will review your message and follow up by email. No account is required."
        />
        <div className={`mt-6 ${SURFACE_PANEL} px-3.5 py-4`}>
          <p className="text-xs text-neutral-500">Your reference</p>
          <p className="mt-1 break-all font-mono text-sm">{submittedProspectId}</p>
          <p className="mt-3 text-sm text-neutral-600">
            Save this reference if you need to follow up with the property manager.
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
        title="Request a viewing"
        description="Tell us which home you're interested in and how to reach you. No login required."
      />

      <form className="flex flex-col gap-8" onSubmit={onSubmit} noValidate>
        <FormField
          htmlFor={propertySelectId}
          label="Property"
          helper="Choose the building you'd like to see."
        >
          {optionsError ? <InlineAlert>{optionsError}</InlineAlert> : null}
          <select
            id={propertySelectId}
            value={selectedPropertyId}
            onChange={(e) => {
              setSelectedPropertyId(e.target.value);
              setSelectedUnitId("");
            }}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-sm"
            required
          >
            <option value="">Select property…</option>
            {options.map((o) => (
              <option key={o.propertyId} value={o.propertyId}>
                {o.propertyName}
              </option>
            ))}
          </select>
        </FormField>

        {selectedProperty && selectedProperty.units.length > 0 ? (
          <FormField
            htmlFor={unitSelectId}
            label="Unit (optional)"
            helper="Pick a specific unit, or leave blank for general interest in this property."
          >
            <select
              id={unitSelectId}
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-sm"
            >
              <option value="">Any available unit</option>
              {selectedProperty.units.map((u) => (
                <option key={u.unitId} value={u.unitId}>
                  Unit {u.unitNumber}
                </option>
              ))}
            </select>
          </FormField>
        ) : null}

        <FormField htmlFor={firstNameId} label="First name (optional)">
          <input
            id={firstNameId}
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
          />
        </FormField>

        <FormField htmlFor={lastNameId} label="Last name (optional)">
          <input
            id={lastNameId}
            type="text"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
          />
        </FormField>

        <FormField htmlFor={emailId} label="Email (required)" helper="We'll use this to follow up about your viewing.">
          <input
            id={emailId}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
            required
          />
        </FormField>

        <FormField htmlFor={phoneId} label="Phone (optional)">
          <input
            id={phoneId}
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
          />
        </FormField>

        <FormField
          htmlFor={messageId}
          label="Message (optional)"
          helper="Preferred times, move-in date, pets, or other questions."
        >
          <textarea
            id={messageId}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="min-h-[8.5rem] w-full resize-y rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
          />
        </FormField>

        {error ? <InlineAlert>{error}</InlineAlert> : null}

        <StickyFormFooter>
          <PrimaryButton type="submit" disabled={loading || options.length === 0}>
            {loading ? "Submitting…" : "Submit viewing request"}
          </PrimaryButton>
        </StickyFormFooter>
      </form>
    </div>
  );
}
