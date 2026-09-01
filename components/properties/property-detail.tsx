"use client";

import {
  createUnitAction,
  hardDeletePropertyAction,
} from "@/app/(dashboard)/properties/actions";
import { PropertyAddressSection } from "@/components/properties/edit/property-address-section";
import { PropertyOwnerStrataSection } from "@/components/properties/edit/property-owner-strata-section";
import { PropertyProfileSection } from "@/components/properties/edit/property-profile-section";
import { PropertyStatusSection } from "@/components/properties/edit/property-status-section";
import { PropertyDocumentsSection } from "@/components/properties/property-documents-section";
import {
  RentalListingsSection,
  type RentalListingsPropertyStaffData,
} from "@/components/properties/rental-listings-section";
import { PropertyTenanciesSection } from "@/components/properties/property-tenancies-section";
import {
  FormField,
  FormSection,
  InlineNotice,
  PrimaryButton,
  SURFACE_CARD,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import {
  getAdditionalUnits,
  hasOnlyEntirePropertyUnit,
  isEntirePropertyUnit,
} from "@/lib/property/entire-property-unit";
import type { PropertyProfileFields } from "@/lib/property/profile";
import type { PropertyServiceRelationshipValue } from "@/lib/property/service-relationship";
import type { HealthViewState } from "@/lib/property/portfolio-health-return";
import type { PropertyDetailMarketRentResearch } from "@/lib/market-rent-research/access";
import type { PropertyDocumentsPageData } from "@/lib/property/property-documents-staff";
import type { PropertyPlacementHistoryRow } from "@/lib/property/property-placements-staff";
import type { PropertyTenanciesPageData } from "@/lib/property/property-tenancies-staff";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

const MarketRentResearchPanel = dynamic(
  () =>
    import("@/components/properties/market-rent-research-panel").then(
      (module) => module.MarketRentResearchPanel,
    ),
  { ssr: false },
);

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
  serviceRelationship: PropertyServiceRelationshipValue;
  ownerEmail: string | null;
  ownerPhone: string | null;
  strataNotes: string | null;
  profile: PropertyProfileFields;
  units: PropertyDetailUnit[];
  documents: PropertyDocumentsPageData | null;
  documentsLoadError: string | null;
  tenancies: PropertyTenanciesPageData | null;
  tenanciesLoadError: string | null;
  rentalListings: RentalListingsPropertyStaffData | null;
  rentalListingsLoadError: string | null;
  placements: PropertyPlacementHistoryRow[] | null;
  placementsLoadError: string | null;
};

function PropertyPlacementsSection({
  placements,
  loadError,
}: {
  placements: PropertyPlacementHistoryRow[] | null;
  loadError: string | null;
}) {
  if (loadError) {
    return (
      <div className={`${SURFACE_CARD} mb-4 px-4 py-4`}>
        <h2 className="text-sm font-semibold text-neutral-900">Placement history</h2>
        <InlineNotice className="mt-2">{loadError}</InlineNotice>
      </div>
    );
  }
  if (!placements || placements.length === 0) return null;

  return (
    <div className={`${SURFACE_CARD} mb-4 px-4 py-4`}>
      <h2 className="text-sm font-semibold text-neutral-900">Placement history</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Completed tenant-placement engagements (not managed tenancies).
      </p>
      <ul className="mt-3 flex list-none flex-col gap-2 p-0">
        {placements.map((row) => (
          <li key={row.id} className={`${SURFACE_PANEL} px-3.5 py-3 text-sm text-neutral-700`}>
            <p className="font-medium text-neutral-900">
              {row.applicantName} · Unit {row.unitLabel}
            </p>
            <p className="mt-1 text-xs text-neutral-600">
              Completed {new Date(row.completedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
              {" · "}Lease start {row.leaseStartDate}
              {" · "}${row.monthlyRent}/mo
              {row.listingHeadline ? ` · ${row.listingHeadline}` : ""}
              {row.listingClosed ? " · Listing closed" : ""}
            </p>
            <p className="mt-1">
              <Link
                href={`/leasing/applications/${row.applicationId}`}
                className="text-xs font-medium underline"
              >
                View application
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderMarketRentPanel(
  detail: PropertyDetailData,
  unit: PropertyDetailUnit,
  marketRentResearch: PropertyDetailMarketRentResearch,
) {
  return (
    <MarketRentResearchPanel
      unitId={unit.id}
      unitLabel={unit.unitNumber}
      unitFloor={unit.floor}
      unitBedrooms={unit.bedrooms}
      addressDisplay={formatStreetLine(detail)}
      cityLine={formatCityLine(detail)}
      defaultCity={detail.city}
      propertyProfile={detail.profile}
      canEdit={marketRentResearch.enabled}
    />
  );
}

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
  canDeleteProperty,
  loadError,
  marketRentResearch,
  healthContext = null,
}: {
  detail: PropertyDetailData | null;
  canAddUnit: boolean;
  canDeleteProperty: boolean;
  loadError: string | null;
  marketRentResearch?: PropertyDetailMarketRentResearch;
  /** Carried Property Health worklist state; non-null only when opened from that page. */
  healthContext?: HealthViewState | null;
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
      canDeleteProperty={canDeleteProperty}
      marketRentResearch={marketRentResearch}
      healthContext={healthContext}
    />
  );
}

function AddUnitForm({
  propertyId,
  onSuccess,
}: {
  propertyId: string;
  onSuccess: () => void;
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
      const result = await createUnitAction(propertyId, {
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
      onSuccess();
      router.refresh();
    });
  }

  return (
    <>
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
    </>
  );
}

function DeletePropertySection({ propertyId }: { propertyId: string }) {
  const confirmationId = useId();
  const [showDialog, setShowDialog] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onDelete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await hardDeletePropertyAction(propertyId, confirmation);
      if (result && !result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mt-12 border-t border-neutral-200 pt-8">
      {!showDialog ? (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setConfirmation("");
            setShowDialog(true);
          }}
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-800 hover:bg-red-100"
        >
          Delete Property
        </button>
      ) : (
        <div className={`${SURFACE_PANEL} border border-red-200 px-4 py-4`}>
          <p className="text-sm font-medium text-red-900">Delete property permanently?</p>
          <p className="mt-2 text-sm text-red-800">
            This permanently deletes this property and its units. This should only be used for
            dummy/test properties. This cannot be undone.
          </p>
          {error ? <InlineNotice className="mt-4">{error}</InlineNotice> : null}
          <form className="mt-4 flex flex-col gap-4" onSubmit={onDelete}>
            <FormField
              label='Type DELETE to confirm'
              htmlFor={confirmationId}
              helper="Required for permanent deletion."
            >
              <input
                id={confirmationId}
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                autoComplete="off"
                required
              />
            </FormField>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={pending || confirmation.trim() !== "DELETE"}
                className="rounded-xl border border-red-600 bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Deleting…" : "Delete permanently"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setShowDialog(false);
                  setConfirmation("");
                  setError(null);
                }}
                className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function PropertyDetailBody({
  detail,
  canAddUnit,
  canDeleteProperty,
  marketRentResearch,
  healthContext,
}: {
  detail: PropertyDetailData;
  canAddUnit: boolean;
  canDeleteProperty: boolean;
  marketRentResearch?: PropertyDetailMarketRentResearch;
  healthContext: HealthViewState | null;
}) {
  const additionalUnits = getAdditionalUnits(detail.units);
  const onlyDefaultUnit = hasOnlyEntirePropertyUnit(detail.units);
  const entirePropertyUnit = detail.units.find((unit) => isEntirePropertyUnit(unit.unitNumber));
  const [showAddForm, setShowAddForm] = useState(false);

  /**
   * Derived from the tenancies already loaded for this page rather than a fresh query, so the
   * address editor's active-tenancy warning costs nothing and cannot disagree with the tenancies
   * rendered below it.
   */
  const hasActiveTenancy = Boolean(
    detail.tenancies?.units.some((unit) => unit.occupancyStatus === "occupied"),
  );

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

      <PropertyAddressSection
        propertyId={detail.id}
        address={{
          streetLine1: detail.streetLine1,
          streetLine2: detail.streetLine2,
          city: detail.city,
          province: detail.province,
          postalCode: detail.postalCode,
          country: detail.country,
        }}
        canEdit={canAddUnit}
        hasActiveTenancy={hasActiveTenancy}
        healthContext={healthContext}
      />

      <PropertyStatusSection
        propertyId={detail.id}
        isActive={detail.isActive}
        serviceRelationship={detail.serviceRelationship}
        canEdit={canAddUnit}
      />

      <PropertyProfileSection
        propertyId={detail.id}
        profile={detail.profile}
        canEdit={canAddUnit}
      />

      <PropertyOwnerStrataSection
        propertyId={detail.id}
        ownerEmail={detail.ownerEmail}
        ownerPhone={detail.ownerPhone}
        strataNotes={detail.strataNotes}
        canEdit={canAddUnit}
        healthContext={healthContext}
      />

      <RentalListingsSection
        propertyId={detail.id}
        data={detail.rentalListings}
        canManage={canAddUnit}
        loadError={detail.rentalListingsLoadError}
      />

      <PropertyTenanciesSection
        data={detail.tenancies}
        loadError={detail.tenanciesLoadError}
      />

      <PropertyPlacementsSection
        placements={detail.placements}
        loadError={detail.placementsLoadError}
      />

      <PropertyDocumentsSection
        propertyId={detail.id}
        data={detail.documents}
        canEdit={canAddUnit}
        loadError={detail.documentsLoadError}
      />

      {marketRentResearch && onlyDefaultUnit && entirePropertyUnit
        ? renderMarketRentPanel(detail, entirePropertyUnit, marketRentResearch)
        : null}

      {additionalUnits.length > 0 ? (
        <FormSection legend="Units">
          <ul className="flex list-none flex-col gap-2 p-0">
            {additionalUnits.map((unit) => (
              <li key={unit.id} className={`${SURFACE_PANEL} px-3.5 py-3 text-sm text-neutral-700`}>
                <span className="font-semibold text-neutral-900">{unit.unitNumber}</span>
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
                {marketRentResearch ? renderMarketRentPanel(detail, unit, marketRentResearch) : null}
              </li>
            ))}
          </ul>
        </FormSection>
      ) : null}

      {canAddUnit ? (
        <div className={additionalUnits.length > 0 ? "mt-6" : ""}>
          {showAddForm ? (
            <div className="mt-2">
              <AddUnitForm propertyId={detail.id} onSuccess={() => setShowAddForm(false)} />
            </div>
          ) : (
            <div className={onlyDefaultUnit ? "" : "mt-2"}>
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="text-sm font-medium text-neutral-800 underline"
              >
                + Add Unit
              </button>
              <p className="mt-1 text-sm text-neutral-600">
                Add a basement suite, upper floor, numbered unit, or other rentable space.
              </p>
            </div>
          )}
        </div>
      ) : onlyDefaultUnit ? null : (
        <InlineNotice className="mt-6">
          Property manager or organization admin access is required to add units.
        </InlineNotice>
      )}

      {canDeleteProperty ? <DeletePropertySection propertyId={detail.id} /> : null}
    </div>
  );
}
