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
  MARKET_RENT_RESEARCH_DISCLAIMER,
  MARKET_RENT_RESEARCH_PANEL_TITLE,
} from "@/lib/market-rent-research/constants";
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
      ? researchState.ok
        ? researchState.message
        : researchState.error
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
      </div>
    </details>
  );
}
