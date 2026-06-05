"use client";

import {
  marketRentResearchIdleState,
  runMarketRentResearchAction,
} from "@/app/(dashboard)/properties/market-rent-research-actions";
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
import { providerStatusUiMessage } from "@/lib/market-rent-research/provider-status";
import type { MarketRentResearchResult } from "@/lib/market-rent-research/types";
import {
  MARKET_RENT_FURNISHED_VALUES,
  type MarketRentResearchInputs,
} from "@/lib/validation/market-rent-research";
import { useActionState, useId, useState } from "react";

export type MarketRentResearchPanelProps = {
  unitId: string;
  unitLabel: string;
  unitFloor: string | null;
  unitBedrooms: number | null;
  addressDisplay: string;
  cityLine: string;
  defaultCity: string;
  canEdit: boolean;
};

type FormState = {
  city: string;
  neighbourhood: string;
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
  parking: string;
  furnished: MarketRentResearchInputs["furnished"] | "";
  petPolicy: string;
  notes: string;
};

function buildInitialFormState(
  defaultCity: string,
  unitBedrooms: number | null,
): FormState {
  return {
    city: defaultCity,
    neighbourhood: "",
    propertyType: "",
    bedrooms: unitBedrooms != null ? String(unitBedrooms) : "",
    bathrooms: "",
    sqft: "",
    parking: "",
    furnished: "",
    petPolicy: "",
    notes: "",
  };
}

function formToInputs(form: FormState): MarketRentResearchInputs {
  const inputs: MarketRentResearchInputs = {
    city: form.city,
    propertyType: form.propertyType,
    bedrooms: Number(form.bedrooms),
    bathrooms: Number(form.bathrooms),
  };
  if (form.neighbourhood.trim()) inputs.neighbourhood = form.neighbourhood.trim();
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
    defaultCity,
    unitBedrooms,
    canEdit,
  } = props;

  const [form, setForm] = useState(() => buildInitialFormState(defaultCity, unitBedrooms));

  const [researchState, researchAction, researchPending] = useActionState(
    runMarketRentResearchAction,
    marketRentResearchIdleState,
  );

  const cityId = useId();
  const neighbourhoodId = useId();
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

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="City" htmlFor={cityId}>
            <input
              id={cityId}
              className={inputClassName}
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              required
            />
          </FormField>
          <FormField label="Neighbourhood (optional)" htmlFor={neighbourhoodId}>
            <input
              id={neighbourhoodId}
              className={inputClassName}
              value={form.neighbourhood}
              onChange={(e) => setForm((f) => ({ ...f, neighbourhood: e.target.value }))}
            />
          </FormField>
          <FormField label="Property type" htmlFor={propertyTypeId}>
            <input
              id={propertyTypeId}
              className={inputClassName}
              value={form.propertyType}
              onChange={(e) => setForm((f) => ({ ...f, propertyType: e.target.value }))}
              placeholder="e.g. condo, house, basement suite"
              required
            />
          </FormField>
          <FormField label="Bedrooms" htmlFor={bedroomsId}>
            <input
              id={bedroomsId}
              type="number"
              min={0}
              max={50}
              className={inputClassName}
              value={form.bedrooms}
              onChange={(e) => setForm((f) => ({ ...f, bedrooms: e.target.value }))}
              required
            />
          </FormField>
          <FormField label="Bathrooms" htmlFor={bathroomsId}>
            <input
              id={bathroomsId}
              type="number"
              min={0}
              step={0.5}
              className={inputClassName}
              value={form.bathrooms}
              onChange={(e) => setForm((f) => ({ ...f, bathrooms: e.target.value }))}
              required
            />
          </FormField>
          <FormField label="Approximate sqft (optional)" htmlFor={sqftId}>
            <input
              id={sqftId}
              type="number"
              min={1}
              className={inputClassName}
              value={form.sqft}
              onChange={(e) => setForm((f) => ({ ...f, sqft: e.target.value }))}
            />
          </FormField>
          <FormField label="Parking (optional)" htmlFor={parkingId}>
            <input
              id={parkingId}
              className={inputClassName}
              value={form.parking}
              onChange={(e) => setForm((f) => ({ ...f, parking: e.target.value }))}
            />
          </FormField>
          <FormField label="Furnished (optional)" htmlFor={furnishedId}>
            <select
              id={furnishedId}
              className={inputClassName}
              value={form.furnished}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  furnished: e.target.value as FormState["furnished"],
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
              value={form.petPolicy}
              onChange={(e) => setForm((f) => ({ ...f, petPolicy: e.target.value }))}
            />
          </FormField>
        </div>

        <FormField label="Notes (optional)" htmlFor={notesId}>
          <textarea
            id={notesId}
            rows={3}
            className={inputClassName}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </FormField>

        <form action={researchAction}>
          <input type="hidden" name="unitId" value={unitId} />
          <input type="hidden" name="inputs" value={JSON.stringify(formToInputs(form))} />
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
