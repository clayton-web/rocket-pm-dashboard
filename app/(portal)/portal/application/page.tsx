"use client";

import {
  FormField,
  FormSection,
  InlineAlert,
  PortalPageHeader,
  PrimaryButton,
  StickyFormFooter,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import { PortalBackLink } from "@/components/portal/portal-nav";
import type { PublicProspectPrefillFields } from "@/lib/leasing/prospect-prefill";
import { parseCreatedApplicationId } from "@/lib/validation/application";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

type ApplicationStep = "lookup" | "application";

type ProspectPrefillApiResponse =
  | { found: false }
  | {
      found: true;
      prospectId: string;
      prefill: PublicProspectPrefillFields;
    };

type LeasingSubmitOption = {
  propertyId: string;
  propertyName: string;
  units: { unitId: string; unitNumber: string }[];
};

function apiErrorMessage(parsed: unknown, fallback: string): string {
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    typeof (parsed as { error?: unknown }).error === "string"
  ) {
    return (parsed as { error: string }).error;
  }
  return fallback;
}

export default function RentalApplicationPage() {
  const propertySelectId = useId();
  const unitSelectId = useId();
  const emailId = useId();
  const firstNameId = useId();
  const lastNameId = useId();
  const phoneId = useId();
  const currentAddressId = useId();
  const moveInId = useId();
  const occupantCountId = useId();
  const monthlyIncomeId = useId();
  const hasPetsId = useId();
  const petDetailsId = useId();
  const smokerStatusId = useId();
  const employerNameId = useId();
  const jobTitleId = useId();
  const employmentNotesId = useId();
  const consentCheckId = useId();
  const consentSignatureId = useId();

  const [options, setOptions] = useState<LeasingSubmitOption[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentAddress, setCurrentAddress] = useState("");
  const [desiredMoveInDate, setDesiredMoveInDate] = useState("");
  const [occupantCount, setOccupantCount] = useState("1");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [hasPets, setHasPets] = useState(false);
  const [petDetails, setPetDetails] = useState("");
  const [smokerStatus, setSmokerStatus] = useState("");
  const [employerName, setEmployerName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [employmentNotes, setEmploymentNotes] = useState("");
  const [consentCreditCheck, setConsentCreditCheck] = useState(false);
  const [consentSignatureName, setConsentSignatureName] = useState("");
  const [step, setStep] = useState<ApplicationStep>("lookup");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [matchedProspectId, setMatchedProspectId] = useState<string | null>(null);
  const [householdIncomeRangeLabel, setHouseholdIncomeRangeLabel] = useState<string | null>(
    null,
  );
  const [lookupContextKey, setLookupContextKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedApplicationId, setSubmittedApplicationId] = useState<string | null>(null);

  const clearProspectMatch = useCallback(() => {
    setMatchedProspectId(null);
    setHouseholdIncomeRangeLabel(null);
    setLookupContextKey(null);
  }, []);

  const applyProspectPrefill = useCallback((prefill: PublicProspectPrefillFields) => {
    if (prefill.firstName) setFirstName(prefill.firstName);
    if (prefill.lastName) setLastName(prefill.lastName);
    if (prefill.phone) setPhone(prefill.phone);
    if (prefill.desiredMoveInDate) setDesiredMoveInDate(prefill.desiredMoveInDate);
    if (prefill.occupantCount != null) setOccupantCount(String(prefill.occupantCount));
    setHasPets(prefill.hasPets);
    if (prefill.petDetails) setPetDetails(prefill.petDetails);
    if (prefill.smokerStatus) setSmokerStatus(prefill.smokerStatus);
    setHouseholdIncomeRangeLabel(prefill.householdIncomeRangeLabel);
  }, []);

  useEffect(() => {
    if (step !== "application" || !lookupContextKey) return;
    const current = `${selectedPropertyId}|${selectedUnitId}|${email.trim().toLowerCase()}`;
    if (current !== lookupContextKey) {
      clearProspectMatch();
    }
  }, [step, selectedPropertyId, selectedUnitId, email, lookupContextKey, clearProspectMatch]);

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

  const onContinueLookup = useCallback(async () => {
    setLookupError(null);
    setError(null);

    if (!selectedPropertyId || !selectedUnitId) {
      setLookupError("Please select a property and unit.");
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setLookupError("Please enter your email address.");
      return;
    }

    setLookupLoading(true);
    clearProspectMatch();
    try {
      const params = new URLSearchParams({
        propertyId: selectedPropertyId,
        unitId: selectedUnitId,
        email: trimmedEmail,
      });
      const res = await fetch(`/api/leasing/prospect-prefill?${params.toString()}`);
      const body: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLookupError(apiErrorMessage(body, "Could not look up your information. Try again."));
        return;
      }

      const parsed = body as ProspectPrefillApiResponse;
      if (parsed.found) {
        setMatchedProspectId(parsed.prospectId);
        applyProspectPrefill(parsed.prefill);
      }

      setLookupContextKey(
        `${selectedPropertyId}|${selectedUnitId}|${trimmedEmail.toLowerCase()}`,
      );
      setStep("application");
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLookupLoading(false);
    }
  }, [
    applyProspectPrefill,
    clearProspectMatch,
    email,
    selectedPropertyId,
    selectedUnitId,
  ]);

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);

      if (!selectedPropertyId || !selectedUnitId) {
        setError("Please select a property and unit.");
        return;
      }

      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        setError("Please enter your email address.");
        return;
      }

      if (!consentCreditCheck) {
        setError("You must consent to a credit check to submit.");
        return;
      }

      const signature = consentSignatureName.trim();
      if (!signature) {
        setError("Please type your full name as your electronic signature.");
        return;
      }

      if (hasPets && !petDetails.trim()) {
        setError("Please describe your pets.");
        return;
      }

      setLoading(true);
      try {
        const startRes = await fetch("/api/leasing/application", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: selectedPropertyId,
            unitId: selectedUnitId,
            email: trimmedEmail,
            prospectId: matchedProspectId ?? undefined,
            firstName: firstName.trim() || undefined,
            lastName: lastName.trim() || undefined,
            phone: phone.trim() || undefined,
          }),
        });
        const startBody: unknown = await startRes.json().catch(() => ({}));
        if (!startRes.ok) {
          setError(apiErrorMessage(startBody, "Could not start your application. Please try again."));
          return;
        }

        const applicationId = parseCreatedApplicationId(startBody);
        if (!applicationId) {
          setError("Application started but reference could not be confirmed.");
          return;
        }

        const income = monthlyIncome.trim() ? Number(monthlyIncome) : NaN;
        const occupants = Number(occupantCount);

        const patchRes = await fetch(`/api/leasing/application/${applicationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: trimmedEmail,
            firstName: firstName.trim() || undefined,
            lastName: lastName.trim() || undefined,
            phone: phone.trim() || undefined,
            currentAddress: currentAddress.trim() || undefined,
            desiredMoveInDate: desiredMoveInDate || undefined,
            occupantCount: Number.isFinite(occupants) ? occupants : undefined,
            monthlyIncome: Number.isFinite(income) ? income : undefined,
            hasPets,
            petDetails: hasPets ? petDetails.trim() : undefined,
            smokerStatus: smokerStatus || undefined,
            employerName: employerName.trim() || undefined,
            jobTitle: jobTitle.trim() || undefined,
            employmentNotes: employmentNotes.trim() || undefined,
          }),
        });
        const patchBody: unknown = await patchRes.json().catch(() => ({}));
        if (!patchRes.ok) {
          setError(apiErrorMessage(patchBody, "Could not save your application details."));
          return;
        }

        const submitRes = await fetch(`/api/leasing/application/${applicationId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: trimmedEmail,
            consentCreditCheck: true,
            consentSignatureName: signature,
          }),
        });
        const submitBody: unknown = await submitRes.json().catch(() => ({}));
        if (!submitRes.ok) {
          setError(apiErrorMessage(submitBody, "Could not submit your application."));
          return;
        }

        setSubmittedApplicationId(applicationId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Submission failed");
      } finally {
        setLoading(false);
      }
    },
    [
      consentCreditCheck,
      consentSignatureName,
      currentAddress,
      desiredMoveInDate,
      email,
      employerName,
      employmentNotes,
      firstName,
      hasPets,
      jobTitle,
      lastName,
      monthlyIncome,
      occupantCount,
      petDetails,
      phone,
      matchedProspectId,
      selectedPropertyId,
      selectedUnitId,
      smokerStatus,
    ],
  );

  if (submittedApplicationId !== null) {
    return (
      <div className="pb-14 pt-1">
        <PortalBackLink />
        <PortalPageHeader
          eyebrow="Rental application"
          title="Application submitted"
          description="Our team will review your application and follow up by email. No account is required."
        />
        <div className={`mt-6 ${SURFACE_PANEL} px-3.5 py-4`}>
          <p className="text-xs text-neutral-500">Your reference</p>
          <p className="mt-1 break-all font-mono text-sm">{submittedApplicationId}</p>
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
        title="Apply for a rental"
        description={
          step === "lookup"
            ? "Select the unit and enter the email you used for a viewing request, if any. No login required."
            : "Review and complete your application. Fields may be prefilled from your viewing request."
        }
      />

      <form
        className="flex flex-col gap-8"
        onSubmit={step === "lookup" ? (e) => e.preventDefault() : onSubmit}
        noValidate
      >
        <FormSection legend="Rental">
          <FormField
            htmlFor={propertySelectId}
            label="Property"
            helper="Choose the building you are applying for."
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
            <FormField htmlFor={unitSelectId} label="Unit (required)" helper="Select the unit you want to rent.">
              <select
                id={unitSelectId}
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-sm"
                required
              >
                <option value="">Select unit…</option>
                {selectedProperty.units.map((u) => (
                  <option key={u.unitId} value={u.unitId}>
                    Unit {u.unitNumber}
                  </option>
                ))}
              </select>
            </FormField>
          ) : selectedProperty ? (
            <InlineAlert>No active units are available for this property.</InlineAlert>
          ) : null}

          <FormField
            htmlFor={emailId}
            label="Email (required)"
            helper={
              step === "lookup"
                ? "We use this to match a prior viewing request and prefill your application."
                : "Must match the email you entered in the previous step."
            }
          >
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
        </FormSection>

        {step === "lookup" ? (
          <>
            {lookupError ? <InlineAlert>{lookupError}</InlineAlert> : null}
            <StickyFormFooter>
              <PrimaryButton
                type="button"
                disabled={
                  lookupLoading || options.length === 0 || !selectedProperty?.units.length
                }
                onClick={() => void onContinueLookup()}
              >
                {lookupLoading ? "Looking up…" : "Continue to application"}
              </PrimaryButton>
            </StickyFormFooter>
          </>
        ) : null}

        {step === "application" ? (
          <>
            {matchedProspectId ? (
              <div className={`${SURFACE_PANEL} px-3.5 py-4 text-sm text-neutral-700`}>
                We found information linked to your viewing request. Review the fields below and
                update anything that has changed.
              </div>
            ) : null}

            {householdIncomeRangeLabel ? (
              <div className={`${SURFACE_PANEL} px-3.5 py-4`}>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  From your viewing request
                </p>
                <p className="mt-1 text-sm text-neutral-800">
                  Household income range (approximate): {householdIncomeRangeLabel}
                </p>
                <p className="mt-2 text-xs text-neutral-600">
                  Enter your exact monthly household income below. We do not copy a range into that
                  field.
                </p>
              </div>
            ) : null}

            <p className="text-sm">
              <button
                type="button"
                className="font-medium text-neutral-700 underline"
                onClick={() => {
                  clearProspectMatch();
                  setStep("lookup");
                  setLookupError(null);
                  setError(null);
                }}
              >
                Change property, unit, or email
              </button>
            </p>

        <FormSection legend="Contact">
          <FormField htmlFor={firstNameId} label="First name (required)">
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

          <FormField htmlFor={lastNameId} label="Last name (required)">
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

          <FormField htmlFor={phoneId} label="Phone (required)">
            <input
              id={phoneId}
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
              required
            />
          </FormField>

          <FormField htmlFor={currentAddressId} label="Current address (required)">
            <textarea
              id={currentAddressId}
              value={currentAddress}
              onChange={(e) => setCurrentAddress(e.target.value)}
              rows={3}
              className="min-h-[5rem] w-full resize-y rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
              required
            />
          </FormField>
        </FormSection>

        <FormSection legend="Household">
          <FormField htmlFor={moveInId} label="Desired move-in date (required)">
            <input
              id={moveInId}
              type="date"
              value={desiredMoveInDate}
              onChange={(e) => setDesiredMoveInDate(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
              required
            />
          </FormField>

          <FormField htmlFor={occupantCountId} label="Number of occupants (required)">
            <input
              id={occupantCountId}
              type="number"
              min={1}
              step={1}
              value={occupantCount}
              onChange={(e) => setOccupantCount(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
              required
            />
          </FormField>

          <FormField htmlFor={monthlyIncomeId} label="Monthly household income (required)">
            <input
              id={monthlyIncomeId}
              type="number"
              min={0}
              step="0.01"
              value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
              required
            />
          </FormField>

          <FormField htmlFor={smokerStatusId} label="Smoking (required)">
            <select
              id={smokerStatusId}
              value={smokerStatus}
              onChange={(e) => setSmokerStatus(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-sm"
              required
            >
              <option value="">Select…</option>
              <option value="non_smoker">Non-smoker</option>
              <option value="smoker">Smoker</option>
              <option value="occasional">Occasional smoker</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
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
            <FormField htmlFor={petDetailsId} label="Pet details (required)">
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
        </FormSection>

        <FormSection legend="Employment">
          <FormField htmlFor={employerNameId} label="Employer name (required)">
            <input
              id={employerNameId}
              type="text"
              value={employerName}
              onChange={(e) => setEmployerName(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
              required
            />
          </FormField>

          <FormField htmlFor={jobTitleId} label="Job title (required)">
            <input
              id={jobTitleId}
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
              required
            />
          </FormField>

          <FormField htmlFor={employmentNotesId} label="Employment notes (optional)">
            <textarea
              id={employmentNotesId}
              value={employmentNotes}
              onChange={(e) => setEmploymentNotes(e.target.value)}
              rows={3}
              className="min-h-[5rem] w-full resize-y rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
            />
          </FormField>
        </FormSection>

        <FormSection legend="Consent">
          <FormField htmlFor={consentCheckId} label="Credit check consent (required)">
            <label className="flex items-start gap-2 text-sm text-neutral-800">
              <input
                id={consentCheckId}
                type="checkbox"
                checked={consentCreditCheck}
                onChange={(e) => setConsentCreditCheck(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-neutral-300"
                required
              />
              <span>
                I authorize the property manager to obtain consumer reports and verify information
                provided in this application.
              </span>
            </label>
          </FormField>

          <FormField
            htmlFor={consentSignatureId}
            label="Electronic signature (required)"
            helper="Type your full legal name."
          >
            <input
              id={consentSignatureId}
              type="text"
              value={consentSignatureName}
              onChange={(e) => setConsentSignatureName(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
              required
            />
          </FormField>
        </FormSection>

        {error ? <InlineAlert>{error}</InlineAlert> : null}

        <StickyFormFooter>
          <PrimaryButton
            type="submit"
            disabled={loading || options.length === 0 || !selectedProperty?.units.length}
          >
            {loading ? "Submitting…" : "Submit application"}
          </PrimaryButton>
        </StickyFormFooter>
          </>
        ) : null}
      </form>
    </div>
  );
}
