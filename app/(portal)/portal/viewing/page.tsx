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
import { withBasePath } from "@/lib/app-path";
import {
  HOUSEHOLD_INCOME_RANGES,
  SMOKER_STATUSES,
} from "@/lib/leasing/prospect-intake";
import { parseCreatedProspectId } from "@/lib/validation/leasing";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

type LeasingSubmitOptionUnit = {
  unitId: string;
  unitNumber: string;
  rentalListingId?: string;
  monthlyRent?: string | null;
  headline?: string | null;
  isPublishedListing?: boolean;
};

type LeasingSubmitOption = {
  propertyId: string;
  propertyName: string;
  units: LeasingSubmitOptionUnit[];
};

const INCOME_LABELS: Record<(typeof HOUSEHOLD_INCOME_RANGES)[number], string> = {
  under_3000: "Under $3,000 / month",
  "3000_4999": "$3,000 – $4,999",
  "5000_7499": "$5,000 – $7,499",
  "7500_9999": "$7,500 – $9,999",
  "10000_plus": "$10,000+",
  prefer_not_to_say: "Prefer not to say",
};

const SMOKER_LABELS: Record<(typeof SMOKER_STATUSES)[number], string> = {
  non_smoker: "Non-smoker",
  smoker: "Smoker",
  occasional: "Occasional smoker",
  prefer_not_to_say: "Prefer not to say",
};

export default function ViewingRequestPage() {
  const propertySelectId = useId();
  const unitSelectId = useId();
  const firstNameId = useId();
  const lastNameId = useId();
  const emailId = useId();
  const phoneId = useId();
  const occupantCountId = useId();
  const hasPetsId = useId();
  const petDetailsId = useId();
  const smokerStatusId = useId();
  const incomeRangeId = useId();
  const moveInId = useId();
  const preferredViewingId = useId();
  const messageId = useId();

  const [options, setOptions] = useState<LeasingSubmitOption[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [occupantCount, setOccupantCount] = useState("1");
  const [hasPets, setHasPets] = useState(false);
  const [petDetails, setPetDetails] = useState("");
  const [smokerStatus, setSmokerStatus] = useState("");
  const [householdIncomeRange, setHouseholdIncomeRange] = useState("");
  const [desiredMoveInDate, setDesiredMoveInDate] = useState("");
  const [preferredViewingNotes, setPreferredViewingNotes] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedProspectId, setSubmittedProspectId] = useState<string | null>(null);

  useEffect(() => {
    fetch(withBasePath("/api/leasing/submit-options"))
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

  const selectedUnit = useMemo(
    () => selectedProperty?.units.find((u) => u.unitId === selectedUnitId) ?? null,
    [selectedProperty, selectedUnitId],
  );

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);

      if (!selectedPropertyId) {
        setError("Please select a property.");
        return;
      }
      if (!firstName.trim() || !lastName.trim()) {
        setError("Please enter your first and last name.");
        return;
      }
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        setError("Please enter your email address.");
        return;
      }
      const occupants = Number(occupantCount);
      if (!Number.isInteger(occupants) || occupants < 1) {
        setError("Please enter the number of occupants.");
        return;
      }
      if (!smokerStatus) {
        setError("Please select your smoking status.");
        return;
      }
      if (!householdIncomeRange) {
        setError("Please select your household income range.");
        return;
      }
      if (!desiredMoveInDate) {
        setError("Please enter your desired move-in date.");
        return;
      }
      if (hasPets && !petDetails.trim()) {
        setError("Please describe your pets.");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(withBasePath("/api/leasing/viewing-request"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: selectedPropertyId,
            unitId: selectedUnitId || undefined,
            rentalListingId: selectedUnit?.rentalListingId || undefined,
            email: trimmedEmail,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.trim() || undefined,
            occupantCount: occupants,
            hasPets,
            petDetails: hasPets ? petDetails.trim() : undefined,
            smokerStatus,
            householdIncomeRange,
            desiredMoveInDate,
            preferredViewingNotes: preferredViewingNotes.trim() || undefined,
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
    [
      desiredMoveInDate,
      email,
      firstName,
      hasPets,
      householdIncomeRange,
      lastName,
      message,
      occupantCount,
      petDetails,
      phone,
      preferredViewingNotes,
      selectedPropertyId,
      selectedUnit,
      selectedUnitId,
      smokerStatus,
    ],
  );

  if (submittedProspectId !== null) {
    return (
      <div className="pb-14 pt-1">
        <PortalBackLink />
        <PortalPageHeader
          eyebrow="Viewing request"
          title="We've received your request"
          description="Our team will review your details and follow up by email. No account is required."
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
        description="Tell us about your household and when you'd like to see the home. No login required."
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

        <FormField htmlFor={firstNameId} label="First name">
          <input
            id={firstNameId}
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
            required
          />
        </FormField>

        <FormField htmlFor={lastNameId} label="Last name">
          <input
            id={lastNameId}
            type="text"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
            required
          />
        </FormField>

        <FormField htmlFor={emailId} label="Email" helper="We'll use this to follow up about your viewing.">
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

        <FormField htmlFor={phoneId} label="Phone">
          <input
            id={phoneId}
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
          />
        </FormField>

        <FormField htmlFor={occupantCountId} label="Number of occupants">
          <input
            id={occupantCountId}
            type="number"
            min={1}
            max={50}
            value={occupantCount}
            onChange={(e) => setOccupantCount(e.target.value)}
            className="w-full max-w-[8rem] rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
            required
          />
        </FormField>

        <FormField htmlFor={hasPetsId} label="Pets">
          <label className="flex items-center gap-2 text-sm text-neutral-800">
            <input
              id={hasPetsId}
              type="checkbox"
              checked={hasPets}
              onChange={(e) => setHasPets(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300"
            />
            I have pets
          </label>
        </FormField>

        {hasPets ? (
          <FormField htmlFor={petDetailsId} label="Pet details">
            <textarea
              id={petDetailsId}
              value={petDetails}
              onChange={(e) => setPetDetails(e.target.value)}
              rows={3}
              className="min-h-[5rem] w-full resize-y rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
              required
            />
          </FormField>
        ) : null}

        <FormField htmlFor={smokerStatusId} label="Smoking">
          <select
            id={smokerStatusId}
            value={smokerStatus}
            onChange={(e) => setSmokerStatus(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-sm"
            required
          >
            <option value="">Select…</option>
            {SMOKER_STATUSES.map((v) => (
              <option key={v} value={v}>
                {SMOKER_LABELS[v]}
              </option>
            ))}
          </select>
        </FormField>

        <FormField htmlFor={incomeRangeId} label="Household income range (monthly)">
          <select
            id={incomeRangeId}
            value={householdIncomeRange}
            onChange={(e) => setHouseholdIncomeRange(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-sm"
            required
          >
            <option value="">Select…</option>
            {HOUSEHOLD_INCOME_RANGES.map((v) => (
              <option key={v} value={v}>
                {INCOME_LABELS[v]}
              </option>
            ))}
          </select>
        </FormField>

        <FormField htmlFor={moveInId} label="Desired move-in date">
          <input
            id={moveInId}
            type="date"
            value={desiredMoveInDate}
            onChange={(e) => setDesiredMoveInDate(e.target.value)}
            className="w-full max-w-xs rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
            required
          />
        </FormField>

        <FormField
          htmlFor={preferredViewingId}
          label="Preferred viewing time"
          helper="e.g. weekday afternoons, Saturday morning, or specific dates."
        >
          <textarea
            id={preferredViewingId}
            value={preferredViewingNotes}
            onChange={(e) => setPreferredViewingNotes(e.target.value)}
            rows={3}
            className="min-h-[5rem] w-full resize-y rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
          />
        </FormField>

        <FormField htmlFor={messageId} label="Additional notes (optional)">
          <textarea
            id={messageId}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="min-h-[5rem] w-full resize-y rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
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
