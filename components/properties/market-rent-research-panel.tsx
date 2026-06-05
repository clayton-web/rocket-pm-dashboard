"use client";

import { runMarketRentResearchAction } from "@/app/(dashboard)/properties/market-rent-research-actions";
import {
  FormField,
  InlineNotice,
  PrimaryButton,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import {
  MARKET_RENT_FIXTURE_SAMPLE_NOTE,
  MARKET_RENT_RESEARCH_DISCLAIMER,
  MARKET_RENT_RESEARCH_PANEL_TITLE,
} from "@/lib/market-rent-research/constants";
import { marketRentResearchIdleState } from "@/lib/market-rent-research/idle-action-state";
import {
  buildMarketRentResearchFormPrefill,
  formatPropertyProfileSummary,
} from "@/lib/market-rent-research/prefill-from-property-profile";
import { providerStatusUiMessage } from "@/lib/market-rent-research/provider-status-ui";
import type { MarketRentResearchResult } from "@/lib/market-rent-research/types";
import type { PropertyProfileFields } from "@/lib/property/profile";
import {
  MARKET_RENT_FURNISHED_VALUES,
  type MarketRentResearchInputs,
} from "@/lib/validation/market-rent-research";
import { useActionState, useId, useMemo, useState } from "react";

export type MarketRentResearchPanelProps = {
  unitId: string;
  unitLabel: string;
  unitFloor: string | null;
  unitBedrooms: number | null;
  addressDisplay: string;
  cityLine: string;
  propertyCity: string;
  propertyPostalCode: string;
  propertyProfile: PropertyProfileFields;
  canEdit: boolean;
};

type ResearchCriteriaForm = {
  neighbourhood: string;
  postalCode: string;
  nearbyAreas: string;
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
  parking: string;
  furnished: MarketRentResearchInputs["furnished"] | "";
  petPolicy: string;
  notes: string;
};

function buildInitialCriteria(
  propertyCity: string,
  propertyPostalCode: string,
  propertyProfile: PropertyProfileFields,
  unitBedrooms: number | null,
): ResearchCriteriaForm {
  const prefill = buildMarketRentResearchFormPrefill({
    city: propertyCity,
    postalCode: propertyPostalCode,
    profile: propertyProfile,
    unitBedrooms,
  });
  return {
    neighbourhood: "",
    postalCode: prefill.postalCode,
    nearbyAreas: "",
    propertyType: prefill.propertyType,
    bedrooms: prefill.bedrooms,
    bathrooms: prefill.bathrooms,
    sqft: prefill.sqft,
    parking: "",
    furnished: "",
    petPolicy: "",
    notes: "",
  };
}

function criteriaToInputs(
  propertyCity: string,
  form: ResearchCriteriaForm,
): MarketRentResearchInputs {
  const inputs: MarketRentResearchInputs = {
    city: propertyCity,
    propertyType: form.propertyType,
    bedrooms: Number(form.bedrooms),
    bathrooms: Number(form.bathrooms),
  };
  if (form.neighbourhood.trim()) inputs.neighbourhood = form.neighbourhood.trim();
  if (form.postalCode.trim()) inputs.postalCode = form.postalCode.trim();
  if (form.nearbyAreas.trim()) inputs.nearbyAreas = form.nearbyAreas.trim();
  if (form.sqft.trim()) inputs.sqft = Number(form.sqft);
  if (form.parking.trim()) inputs.parking = form.parking.trim();
  if (form.furnished) inputs.furnished = form.furnished;
  if (form.petPolicy.trim()) inputs.petPolicy = form.petPolicy.trim();
  if (form.notes.trim()) inputs.notes = form.notes.trim();
  return inputs;
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-CA")} CAD`;
}

function ProfileFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-neutral-900">{value}</dd>
    </div>
  );
}

function ResearchResults({ result }: { result: MarketRentResearchResult }) {
  const stats = result.statistics;
  return (
    <div className="flex flex-col gap-4 border-t border-neutral-200 pt-4">
      {result.usedFixtureComps ? (
        <InlineNotice>{MARKET_RENT_FIXTURE_SAMPLE_NOTE}</InlineNotice>
      ) : null}

      {result.providerStatuses.length > 0 ? (
        <section className="text-xs text-neutral-600">
          <h3 className="font-semibold text-neutral-800">Listing sources</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {result.providerStatuses.map((status) => (
              <li key={status.source}>{providerStatusUiMessage(status)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3 className="text-sm font-semibold text-neutral-900">Suggested advertising rent</h3>
        <ul className="mt-2 space-y-1 text-sm text-neutral-700">
          <li>Conservative · {formatCurrency(result.suggestedRent.conservative)}</li>
          <li>Recommended · {formatCurrency(result.suggestedRent.recommended)}</li>
          <li>Aggressive · {formatCurrency(result.suggestedRent.aggressive)}</li>
        </ul>
        <p className="mt-2 text-sm text-neutral-600">
          Confidence · {result.confidence} — {result.confidenceReason}
        </p>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-neutral-900">Explanation</h3>
        {result.explanationSource === "deterministic" ? (
          <p className="mt-1 text-xs text-neutral-500">Deterministic summary</p>
        ) : null}
        <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{result.explanation}</p>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-sm text-neutral-700">
        <h3 className="font-semibold text-neutral-900">Statistics</h3>
        <p className="mt-2">
          Count {stats.count}
          {stats.median != null ? ` · Median ${formatCurrency(stats.median)}` : ""}
          {stats.mean != null ? ` · Mean ${formatCurrency(Math.round(stats.mean))}` : ""}
          {stats.p25 != null && stats.p75 != null
            ? ` · Range ${formatCurrency(stats.p25)}–${formatCurrency(stats.p75)}`
            : ""}
        </p>
        <p className="mt-1 text-xs text-neutral-600">
          Sources · Craigslist {result.sourceBreakdown.craigslist}
          {result.sourceBreakdown.rew > 0 ? ` · REW ${result.sourceBreakdown.rew}` : ""}
          {result.excludedCount > 0 ? ` · ${result.excludedCount} excluded` : ""}
        </p>
      </section>

      {result.dataQualityNotes.length > 0 ? (
        <section className="text-xs text-neutral-600">
          <h3 className="font-semibold text-neutral-800">Data quality notes</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {result.dataQualityNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.comparableListingsUsed.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold text-neutral-900">Comparable listings used</h3>
          <ul className="mt-2 space-y-2 text-sm text-neutral-700">
            {result.comparableListingsUsed.map((listing) => (
              <li key={`${listing.source}-${listing.sourceUrl}`} className="rounded-lg border border-neutral-200 px-3 py-2">
                <a
                  href={listing.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-neutral-900 underline"
                >
                  {listing.title}
                </a>
                <p className="mt-1 text-neutral-600">
                  {formatCurrency(listing.monthlyRent)}
                  {listing.bedrooms != null ? ` · ${listing.bedrooms} bed` : ""}
                  {listing.bathrooms != null ? ` · ${listing.bathrooms} bath` : ""}
                  {listing.sqft != null ? ` · ${listing.sqft} sqft` : ""}
                  {` · ${listing.source}`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

const inputClassName = "w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm";

export function MarketRentResearchPanel(props: MarketRentResearchPanelProps) {
  const {
    unitId,
    unitLabel,
    unitFloor,
    addressDisplay,
    cityLine,
    propertyCity,
    propertyPostalCode,
    unitBedrooms,
    propertyProfile,
    canEdit,
  } = props;

  const profileSummary = useMemo(
    () =>
      formatPropertyProfileSummary({
        city: propertyCity,
        postalCode: propertyPostalCode,
        profile: propertyProfile,
      }),
    [propertyCity, propertyPostalCode, propertyProfile],
  );

  const [criteria, setCriteria] = useState(() =>
    buildInitialCriteria(propertyCity, propertyPostalCode, propertyProfile, unitBedrooms),
  );

  const [researchState, researchAction, researchPending] = useActionState(
    runMarketRentResearchAction,
    marketRentResearchIdleState,
  );

  const neighbourhoodId = useId();
  const postalCodeId = useId();
  const nearbyAreasId = useId();
  const propertyTypeId = useId();
  const bedroomsId = useId();
  const bathroomsId = useId();
  const sqftId = useId();
  const parkingId = useId();
  const furnishedId = useId();
  const petPolicyId = useId();
  const notesId = useId();

  const actionMessage =
    researchState.completedAt > 0
      ? !researchState.ok
        ? researchState.error
        : researchState.status === "no_providers"
          ? researchState.message
          : null
      : null;

  const successResult =
    researchState.completedAt > 0 &&
    researchState.ok &&
    researchState.status === "success"
      ? researchState.result
      : null;

  if (!canEdit) {
    return null;
  }

  return (
    <details className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50/60">
      <summary className="cursor-pointer list-none px-3.5 py-3 text-sm font-semibold text-neutral-900 [&::-webkit-details-marker]:hidden">
        {MARKET_RENT_RESEARCH_PANEL_TITLE}
      </summary>

      <div className={`${SURFACE_PANEL} m-3 mt-0 flex flex-col gap-4 border-neutral-200 px-4 py-4`}>
        <InlineNotice>{MARKET_RENT_RESEARCH_DISCLAIMER}</InlineNotice>

        <p className="text-sm text-neutral-600">
          <span className="text-neutral-500">Property · </span>
          {addressDisplay}
          <span className="text-neutral-500"> · Unit · </span>
          {unitLabel}
          {unitFloor ? ` · Floor ${unitFloor}` : ""}
          <span className="block text-neutral-500">{cityLine}</span>
        </p>

        <section>
          <h3 className="text-sm font-semibold text-neutral-900">Property profile</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Saved property facts — not changed by research runs.
          </p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ProfileFact label="City" value={profileSummary.city} />
            <ProfileFact label="Postal code" value={profileSummary.postalCode} />
            <ProfileFact label="Property type" value={profileSummary.propertyType} />
            <ProfileFact label="Bedrooms" value={profileSummary.bedrooms} />
            <ProfileFact label="Bathrooms" value={profileSummary.bathrooms} />
            <ProfileFact label="Approx sqft" value={profileSummary.sqft} />
          </dl>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-neutral-900">Research criteria</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Adjust before each run — prefilled from the property profile, not saved back to the
            property.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <FormField label="Sub-area / neighbourhood" htmlFor={neighbourhoodId}>
              <input
                id={neighbourhoodId}
                className={inputClassName}
                value={criteria.neighbourhood}
                onChange={(e) => setCriteria((f) => ({ ...f, neighbourhood: e.target.value }))}
                placeholder="e.g. Glenayre, Moody Centre"
              />
            </FormField>
            <FormField label="Postal code" htmlFor={postalCodeId}>
              <input
                id={postalCodeId}
                className={inputClassName}
                value={criteria.postalCode}
                onChange={(e) => setCriteria((f) => ({ ...f, postalCode: e.target.value }))}
                placeholder="e.g. V3H 0C3"
              />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Nearby areas (optional)" htmlFor={nearbyAreasId}>
                <input
                  id={nearbyAreasId}
                  className={inputClassName}
                  value={criteria.nearbyAreas}
                  onChange={(e) => setCriteria((f) => ({ ...f, nearbyAreas: e.target.value }))}
                  placeholder="Comma-separated, e.g. Coquitlam, Burnaby"
                />
              </FormField>
            </div>
            <FormField label="Property type filter" htmlFor={propertyTypeId}>
              <input
                id={propertyTypeId}
                className={inputClassName}
                value={criteria.propertyType}
                onChange={(e) => setCriteria((f) => ({ ...f, propertyType: e.target.value }))}
                placeholder="e.g. condo, townhouse, detached"
                required
              />
            </FormField>
            <FormField label="Bedrooms filter" htmlFor={bedroomsId}>
              <input
                id={bedroomsId}
                type="number"
                min={0}
                max={50}
                className={inputClassName}
                value={criteria.bedrooms}
                onChange={(e) => setCriteria((f) => ({ ...f, bedrooms: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Bathrooms filter" htmlFor={bathroomsId}>
              <input
                id={bathroomsId}
                type="number"
                min={0}
                step={0.5}
                className={inputClassName}
                value={criteria.bathrooms}
                onChange={(e) => setCriteria((f) => ({ ...f, bathrooms: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Sqft filter (optional)" htmlFor={sqftId}>
              <input
                id={sqftId}
                type="number"
                min={1}
                className={inputClassName}
                value={criteria.sqft}
                onChange={(e) => setCriteria((f) => ({ ...f, sqft: e.target.value }))}
              />
            </FormField>
            <FormField label="Parking (optional)" htmlFor={parkingId}>
              <input
                id={parkingId}
                className={inputClassName}
                value={criteria.parking}
                onChange={(e) => setCriteria((f) => ({ ...f, parking: e.target.value }))}
              />
            </FormField>
            <FormField label="Furnished (optional)" htmlFor={furnishedId}>
              <select
                id={furnishedId}
                className={inputClassName}
                value={criteria.furnished}
                onChange={(e) =>
                  setCriteria((f) => ({
                    ...f,
                    furnished: e.target.value as ResearchCriteriaForm["furnished"],
                  }))
                }
              >
                <option value="">Not specified</option>
                {MARKET_RENT_FURNISHED_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Pet policy (optional)" htmlFor={petPolicyId}>
              <input
                id={petPolicyId}
                className={inputClassName}
                value={criteria.petPolicy}
                onChange={(e) => setCriteria((f) => ({ ...f, petPolicy: e.target.value }))}
              />
            </FormField>
          </div>

          <div className="mt-4">
            <FormField label="Notes (optional)" htmlFor={notesId}>
              <textarea
                id={notesId}
                rows={3}
                className={inputClassName}
                value={criteria.notes}
                onChange={(e) => setCriteria((f) => ({ ...f, notes: e.target.value }))}
              />
            </FormField>
          </div>
        </section>

        <form action={researchAction}>
          <input type="hidden" name="unitId" value={unitId} />
          <input
            type="hidden"
            name="inputs"
            value={JSON.stringify(criteriaToInputs(propertyCity, criteria))}
          />
          <PrimaryButton type="submit" disabled={researchPending} className="!w-auto px-5">
            {researchPending ? "Running…" : "Run research"}
          </PrimaryButton>
        </form>

        {actionMessage ? <InlineNotice>{actionMessage}</InlineNotice> : null}
        {successResult ? <ResearchResults result={successResult} /> : null}
      </div>
    </details>
  );
}
