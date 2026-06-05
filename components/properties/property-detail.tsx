"use client";

import { createUnitAction } from "@/app/(dashboard)/properties/actions";
import { MarketRentResearchPanel } from "@/components/properties/market-rent-research-panel";
import {
  FormField,
  FormSection,
  InlineNotice,
  PrimaryButton,
  SURFACE_CARD,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import type { PropertyDetailMarketRentResearch } from "@/lib/market-rent-research/access";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

export type PropertyDetailUnit = {
  id: string;
  unitNumber: string;
  floor: string | null;
  bedrooms: number | null;
  isActive: boolean;
};

export type PropertyDetailData = {
  id: string;
  name: string;
  streetLine1: string;
  streetLine2: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  isActive: boolean;
  units: PropertyDetailUnit[];
};

function formatStreetLine(detail: Pick<PropertyDetailData, "streetLine1" | "streetLine2">) {
  return detail.streetLine2 ? `${detail.streetLine1}, ${detail.streetLine2}` : detail.streetLine1;
}

function formatCityLine(
  detail: Pick<PropertyDetailData, "city" | "province" | "postalCode" | "country">,
) {
  return `${detail.city}, ${detail.province} ${detail.postalCode}, ${detail.country}`;
}

export function PropertyDetail({
  detail,
  canAddUnit,
  loadError,
  marketRentResearch,
}: {
  detail: PropertyDetailData | null;
  canAddUnit: boolean;
  loadError: string | null;
  marketRentResearch?: PropertyDetailMarketRentResearch;
}) {
  if (loadError || !detail) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="mb-4">
          <Link href="/properties" className="text-sm font-medium text-neutral-700 underline">
            ← Back to properties
          </Link>
        </p>
        <InlineNotice>{loadError ?? "Property not found."}</InlineNotice>
      </div>
    );
  }

  return (
    <PropertyDetailBody
      detail={detail}
      canAddUnit={canAddUnit}
      marketRentResearch={marketRentResearch}
    />
  );
}

function PropertyDetailBody({
  detail,
  canAddUnit,
  marketRentResearch,
}: {
  detail: PropertyDetailData;
  canAddUnit: boolean;
  marketRentResearch?: PropertyDetailMarketRentResearch;
}) {
  const router = useRouter();
  const unitNumberId = useId();
  const floorId = useId();
  const bedroomsId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [unitNumber, setUnitNumber] = useState("");
  const [floor, setFloor] = useState("");
  const [bedrooms, setBedrooms] = useState("");

  function onAddUnit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createUnitAction(detail.id, {
        unitNumber,
        floor: floor || null,
        bedrooms: bedrooms === "" ? null : Number(bedrooms),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUnitNumber("");
      setFloor("");
      setBedrooms("");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-4">
        <Link href="/properties" className="text-sm font-medium text-neutral-700 underline">
          ← Back to properties
        </Link>
      </p>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">{formatStreetLine(detail)}</h1>
        <p className="mt-1 text-sm text-neutral-600">{formatCityLine(detail)}</p>
      </div>

      <div className={`${SURFACE_CARD} mb-8 px-4 py-4`}>
        <p className="text-sm text-neutral-700">
          <span className="text-neutral-500">Status · </span>
          {detail.isActive ? "Active" : "Inactive"}
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          Whole-property rentals include an active{" "}
          <span className="font-medium text-neutral-800">Entire Property</span> unit automatically.
          Add more unit labels below for basement, upper, suite, or numbered units.
        </p>
      </div>

      <FormSection legend="Units">
        {detail.units.length === 0 ? (
          <p className={`${SURFACE_PANEL} px-3.5 py-3 text-sm text-neutral-600`}>
            No units listed yet. New properties should include Entire Property automatically — refresh
            if you expected it.
          </p>
        ) : (
          <ul className="flex list-none flex-col gap-2 p-0">
            {detail.units.map((unit) => (
              <li key={unit.id} className={`${SURFACE_PANEL} px-3.5 py-3 text-sm text-neutral-700`}>
                <span className="font-semibold text-neutral-900">Unit {unit.unitNumber}</span>
                {unit.floor ? (
                  <span className="text-neutral-600">
                    {" "}
                    · Floor {unit.floor}
                  </span>
                ) : null}
                {unit.bedrooms != null ? (
                  <span className="text-neutral-600"> · {unit.bedrooms} bed</span>
                ) : null}
                {!unit.isActive ? (
                  <span className="text-neutral-500"> · Inactive</span>
                ) : null}
                {marketRentResearch ? (
                  <MarketRentResearchPanel
                    unitId={unit.id}
                    unitLabel={unit.unitNumber}
                    unitFloor={unit.floor}
                    unitBedrooms={unit.bedrooms}
                    addressDisplay={formatStreetLine(detail)}
                    cityLine={formatCityLine(detail)}
                    defaultCity={detail.city}
                    canEdit={marketRentResearch.enabled}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      {canAddUnit ? (
        <div className="mt-8">
          <FormSection
            legend="Add unit"
            helper="For duplexes and multi-suite buildings, add labels like Basement, Upper, Suite A, or 101."
          >
            {error ? <InlineNotice className="mb-4">{error}</InlineNotice> : null}
            <form className={`flex flex-col gap-4 ${SURFACE_PANEL} px-4 py-4`} onSubmit={onAddUnit}>
              <FormField
                label="Unit label (required)"
                htmlFor={unitNumberId}
                helper="e.g. Basement, Upper, Suite A, 101"
              >
                <input
                  id={unitNumberId}
                  type="text"
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                  placeholder="Basement"
                  required
                />
              </FormField>
              <FormField label="Floor (optional)" htmlFor={floorId}>
                <input
                  id={floorId}
                  type="text"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                />
              </FormField>
              <FormField label="Bedrooms (optional)" htmlFor={bedroomsId}>
                <input
                  id={bedroomsId}
                  type="number"
                  min={0}
                  max={50}
                  step={1}
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                />
              </FormField>
              <PrimaryButton type="submit" disabled={pending} className="!w-auto px-6">
                {pending ? "Adding…" : "Add unit"}
              </PrimaryButton>
            </form>
          </FormSection>
        </div>
      ) : (
        <InlineNotice className="mt-8">
          Property manager or organization admin access is required to add units.
        </InlineNotice>
      )}
    </div>
  );
}
