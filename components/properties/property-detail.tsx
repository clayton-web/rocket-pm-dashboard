"use client";

import { createUnitAction, hardDeletePropertyAction, updatePropertyOwnerStrataAction, updatePropertyProfileAction } from "@/app/(dashboard)/properties/actions";
import { PropertyDocumentsSection } from "@/components/properties/property-documents-section";
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
import {
  PROPERTY_PROFILE_TYPES,
  PROPERTY_PROFILE_TYPE_LABELS,
  formatPropertyProfileTypeLabel,
  type PropertyProfileFields,
} from "@/lib/property/profile";
import type { PropertyDetailMarketRentResearch } from "@/lib/market-rent-research/access";
import type { PropertyDocumentsPageData } from "@/lib/property/property-documents-staff";
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
  ownerEmail: string | null;
  ownerPhone: string | null;
  strataNotes: string | null;
  profile: PropertyProfileFields;
  units: PropertyDetailUnit[];
  documents: PropertyDocumentsPageData | null;
  documentsLoadError: string | null;
};

function formatProfileSummary(profile: PropertyProfileFields): string {
  const parts: string[] = [];
  const typeLabel = formatPropertyProfileTypeLabel(profile.propertyType);
  if (typeLabel) parts.push(typeLabel);
  if (profile.bedrooms != null) parts.push(`${profile.bedrooms} bed`);
  if (profile.bathrooms != null) parts.push(`${profile.bathrooms} bath`);
  if (profile.approxSqft != null) parts.push(`${profile.approxSqft.toLocaleString("en-CA")} sqft`);
  return parts.length > 0 ? parts.join(" · ") : "No profile details saved yet";
}

function PropertyProfileSection({
  propertyId,
  profile,
  canEdit,
}: {
  propertyId: string;
  profile: PropertyProfileFields;
  canEdit: boolean;
}) {
  const router = useRouter();
  const propertyTypeId = useId();
  const bedroomsId = useId();
  const bathroomsId = useId();
  const approxSqftId = useId();
  const [showEdit, setShowEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [propertyType, setPropertyType] = useState(profile.propertyType ?? "");
  const [bedrooms, setBedrooms] = useState(
    profile.bedrooms != null ? String(profile.bedrooms) : "",
  );
  const [bathrooms, setBathrooms] = useState(
    profile.bathrooms != null ? String(profile.bathrooms) : "",
  );
  const [approxSqft, setApproxSqft] = useState(
    profile.approxSqft != null ? String(profile.approxSqft) : "",
  );

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updatePropertyProfileAction(propertyId, {
        propertyType: propertyType || null,
        bedrooms: bedrooms === "" ? null : bedrooms,
        bathrooms: bathrooms === "" ? null : bathrooms,
        approxSqft: approxSqft === "" ? null : approxSqft,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setShowEdit(false);
      router.refresh();
    });
  }

  return (
    <div className={`${SURFACE_CARD} mb-8 px-4 py-4`}>
      <p className="text-sm text-neutral-700">
        <span className="text-neutral-500">Profile · </span>
        {formatProfileSummary(profile)}
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        Rental profile for management and market research — not official rent or lease data.
      </p>
      {canEdit ? (
        <div className="mt-3">
          {!showEdit ? (
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="text-sm font-medium text-neutral-800 underline"
            >
              Edit property profile
            </button>
          ) : (
            <form className="mt-3 flex flex-col gap-4 border-t border-neutral-200 pt-4" onSubmit={onSave}>
              {error ? <InlineNotice>{error}</InlineNotice> : null}
              <FormField label="Property type (optional)" htmlFor={propertyTypeId}>
                <select
                  id={propertyTypeId}
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                >
                  <option value="">Not specified</option>
                  {PROPERTY_PROFILE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {PROPERTY_PROFILE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Bedrooms (optional)" htmlFor={bedroomsId}>
                <input
                  id={bedroomsId}
                  type="number"
                  min={0}
                  max={50}
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                />
              </FormField>
              <FormField label="Bathrooms (optional)" htmlFor={bathroomsId}>
                <input
                  id={bathroomsId}
                  type="number"
                  min={0}
                  step={0.5}
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                />
              </FormField>
              <FormField label="Approx. sqft (optional)" htmlFor={approxSqftId}>
                <input
                  id={approxSqftId}
                  type="number"
                  min={1}
                  value={approxSqft}
                  onChange={(e) => setApproxSqft(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                />
              </FormField>
              <div className="flex flex-wrap gap-3">
                <PrimaryButton type="submit" disabled={pending} className="!w-auto px-5">
                  {pending ? "Saving…" : "Save profile"}
                </PrimaryButton>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setShowEdit(false);
                    setError(null);
                    setPropertyType(profile.propertyType ?? "");
                    setBedrooms(profile.bedrooms != null ? String(profile.bedrooms) : "");
                    setBathrooms(profile.bathrooms != null ? String(profile.bathrooms) : "");
                    setApproxSqft(profile.approxSqft != null ? String(profile.approxSqft) : "");
                  }}
                  className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}

function PropertyOwnerStrataSection({
  propertyId,
  ownerEmail,
  ownerPhone,
  strataNotes,
  canEdit,
}: {
  propertyId: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  strataNotes: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const ownerEmailId = useId();
  const ownerPhoneId = useId();
  const strataNotesId = useId();
  const [showEdit, setShowEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [ownerEmailValue, setOwnerEmailValue] = useState(ownerEmail ?? "");
  const [ownerPhoneValue, setOwnerPhoneValue] = useState(ownerPhone ?? "");
  const [strataNotesValue, setStrataNotesValue] = useState(strataNotes ?? "");

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updatePropertyOwnerStrataAction(propertyId, {
        ownerEmail: ownerEmailValue || null,
        ownerPhone: ownerPhoneValue || null,
        strataNotes: strataNotesValue || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setShowEdit(false);
      router.refresh();
    });
  }

  return (
    <div className={`${SURFACE_CARD} mb-8 px-4 py-4`}>
      <p className="text-sm font-medium text-neutral-900">Owner &amp; strata</p>
      <div className={`${SURFACE_PANEL} mt-3 space-y-2 px-3.5 py-3`}>
        <p className="text-sm text-neutral-700">
          <span className="text-neutral-500">Owner Email · </span>
          {ownerEmail ?? "—"}
        </p>
        <p className="text-sm text-neutral-700">
          <span className="text-neutral-500">Owner Phone · </span>
          {ownerPhone ?? "—"}
        </p>
        <p className="text-sm text-neutral-700">
          <span className="text-neutral-500">Strata Notes · </span>
          {strataNotes ? (
            <span className="whitespace-pre-wrap">{strataNotes}</span>
          ) : (
            "—"
          )}
        </p>
      </div>
      {canEdit ? (
        <div className="mt-3">
          {!showEdit ? (
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="text-sm font-medium text-neutral-800 underline"
            >
              Edit owner &amp; strata
            </button>
          ) : (
            <form className="mt-3 flex flex-col gap-4 border-t border-neutral-200 pt-4" onSubmit={onSave}>
              {error ? <InlineNotice>{error}</InlineNotice> : null}
              <FormField label="Owner Email" htmlFor={ownerEmailId}>
                <input
                  id={ownerEmailId}
                  type="email"
                  value={ownerEmailValue}
                  onChange={(e) => setOwnerEmailValue(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                />
              </FormField>
              <FormField label="Owner Phone" htmlFor={ownerPhoneId}>
                <input
                  id={ownerPhoneId}
                  type="tel"
                  value={ownerPhoneValue}
                  onChange={(e) => setOwnerPhoneValue(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                />
              </FormField>
              <FormField label="Strata Notes" htmlFor={strataNotesId}>
                <textarea
                  id={strataNotesId}
                  rows={4}
                  value={strataNotesValue}
                  onChange={(e) => setStrataNotesValue(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                />
              </FormField>
              <div className="flex flex-wrap gap-3">
                <PrimaryButton type="submit" disabled={pending} className="!w-auto px-5">
                  {pending ? "Saving…" : "Save"}
                </PrimaryButton>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setShowEdit(false);
                    setError(null);
                    setOwnerEmailValue(ownerEmail ?? "");
                    setOwnerPhoneValue(ownerPhone ?? "");
                    setStrataNotesValue(strataNotes ?? "");
                  }}
                  className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}
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
}: {
  detail: PropertyDetailData | null;
  canAddUnit: boolean;
  canDeleteProperty: boolean;
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
      canDeleteProperty={canDeleteProperty}
      marketRentResearch={marketRentResearch}
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
}: {
  detail: PropertyDetailData;
  canAddUnit: boolean;
  canDeleteProperty: boolean;
  marketRentResearch?: PropertyDetailMarketRentResearch;
}) {
  const additionalUnits = getAdditionalUnits(detail.units);
  const onlyDefaultUnit = hasOnlyEntirePropertyUnit(detail.units);
  const entirePropertyUnit = detail.units.find((unit) => isEntirePropertyUnit(unit.unitNumber));
  const [showAddForm, setShowAddForm] = useState(false);

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

      <div className={`${SURFACE_CARD} mb-4 px-4 py-4`}>
        <p className="text-sm text-neutral-700">
          <span className="text-neutral-500">Status · </span>
          {detail.isActive ? "Active" : "Inactive"}
        </p>
      </div>

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
