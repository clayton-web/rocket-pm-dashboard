"use client";

import {
  closeRentalListingAction,
  createRentalListingDraftAction,
  pauseRentalListingAction,
  publishRentalListingAction,
  republishRentalListingAction,
  returnRentalListingToDraftAction,
  updateRentalListingAction,
} from "@/app/(dashboard)/properties/rental-listing-actions";
import {
  FormField,
  InlineNotice,
  PrimaryButton,
  SURFACE_CARD,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import type {
  RentalListingStaffRow,
  RentalListingUnitStaffRow,
  RentalListingsPropertyStaffData,
} from "@/lib/leasing/rental-listing-staff";
import { rentalListingUnitStatusLabel } from "@/lib/leasing/rental-listing-status";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

export type { RentalListingsPropertyStaffData };

function ListingEditorForm({
  propertyId,
  listing,
  onCancel,
  onSaved,
}: {
  propertyId: string;
  listing: RentalListingStaffRow;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const monthlyRentId = useId();
  const availableDateId = useId();
  const bedroomsId = useId();
  const bathroomsId = useId();
  const approxSqftId = useId();
  const headlineId = useId();
  const descriptionId = useId();
  const petPolicyId = useId();
  const parkingId = useId();
  const utilitiesId = useId();
  const viewingId = useId();

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [monthlyRent, setMonthlyRent] = useState(listing.monthlyRent ?? "");
  const [availableDate, setAvailableDate] = useState(listing.availableDate ?? "");
  const [bedrooms, setBedrooms] = useState(listing.bedrooms != null ? String(listing.bedrooms) : "");
  const [bathrooms, setBathrooms] = useState(listing.bathrooms ?? "");
  const [approxSqft, setApproxSqft] = useState(
    listing.approxSqft != null ? String(listing.approxSqft) : "",
  );
  const [headline, setHeadline] = useState(listing.headline ?? "");
  const [description, setDescription] = useState(listing.description ?? "");
  const [petPolicy, setPetPolicy] = useState(listing.petPolicy ?? "");
  const [parkingDetails, setParkingDetails] = useState(listing.parkingDetails ?? "");
  const [utilitiesDetails, setUtilitiesDetails] = useState(listing.utilitiesDetails ?? "");
  const [viewingInstructions, setViewingInstructions] = useState(
    listing.viewingInstructions ?? "",
  );

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateRentalListingAction(listing.id, propertyId, {
        monthlyRent: monthlyRent === "" ? null : monthlyRent,
        availableDate: availableDate === "" ? null : availableDate,
        bedrooms: bedrooms === "" ? null : bedrooms,
        bathrooms: bathrooms === "" ? null : bathrooms,
        approxSqft: approxSqft === "" ? null : approxSqft,
        headline: headline || null,
        description: description || null,
        petPolicy: petPolicy || null,
        parkingDetails: parkingDetails || null,
        utilitiesDetails: utilitiesDetails || null,
        viewingInstructions: viewingInstructions || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <form className="mt-3 flex flex-col gap-3 border-t border-neutral-200 pt-3" onSubmit={onSave}>
      {error ? <InlineNotice>{error}</InlineNotice> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Monthly rent" htmlFor={monthlyRentId}>
          <input
            id={monthlyRentId}
            type="number"
            min={0}
            step="0.01"
            value={monthlyRent}
            onChange={(e) => setMonthlyRent(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
          />
        </FormField>
        <FormField label="Available date" htmlFor={availableDateId}>
          <input
            id={availableDateId}
            type="date"
            value={availableDate}
            onChange={(e) => setAvailableDate(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
          />
        </FormField>
        <FormField label="Bedrooms" htmlFor={bedroomsId}>
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
        <FormField label="Bathrooms" htmlFor={bathroomsId}>
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
        <FormField label="Approx. sqft" htmlFor={approxSqftId}>
          <input
            id={approxSqftId}
            type="number"
            min={1}
            value={approxSqft}
            onChange={(e) => setApproxSqft(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
          />
        </FormField>
      </div>
      <FormField label="Headline" htmlFor={headlineId}>
        <input
          id={headlineId}
          type="text"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
        />
      </FormField>
      <FormField label="Description" htmlFor={descriptionId}>
        <textarea
          id={descriptionId}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
        />
      </FormField>
      <FormField label="Pet policy" htmlFor={petPolicyId}>
        <textarea
          id={petPolicyId}
          value={petPolicy}
          onChange={(e) => setPetPolicy(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
        />
      </FormField>
      <FormField label="Parking" htmlFor={parkingId}>
        <textarea
          id={parkingId}
          value={parkingDetails}
          onChange={(e) => setParkingDetails(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
        />
      </FormField>
      <FormField label="Utilities" htmlFor={utilitiesId}>
        <textarea
          id={utilitiesId}
          value={utilitiesDetails}
          onChange={(e) => setUtilitiesDetails(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
        />
      </FormField>
      <FormField label="Viewing instructions" htmlFor={viewingId}>
        <textarea
          id={viewingId}
          value={viewingInstructions}
          onChange={(e) => setViewingInstructions(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
        />
      </FormField>
      <div className="flex flex-wrap gap-3">
        <PrimaryButton type="submit" disabled={pending} className="!w-auto px-5">
          {pending ? "Saving…" : "Save listing"}
        </PrimaryButton>
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function UnitListingCard({
  propertyId,
  unit,
  canManage,
}: {
  propertyId: string;
  unit: RentalListingUnitStaffRow;
  canManage: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const open = unit.openListing;
  const statusLabel = rentalListingUnitStatusLabel(open?.status);

  function runAction(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Action failed");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <li className={`${SURFACE_PANEL} px-3.5 py-3 text-sm text-neutral-700`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="font-semibold text-neutral-900">{unit.unitLabel}</span>
          {!unit.isActive ? <span className="text-neutral-500"> · Inactive unit</span> : null}
        </div>
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {statusLabel}
        </span>
      </div>

      {open ? (
        <div className="mt-2 space-y-1 text-sm text-neutral-600">
          {open.headline ? <p>{open.headline}</p> : null}
          <p>
            {open.monthlyRent != null ? `$${open.monthlyRent}/mo` : "Rent not set"}
            {open.availableDate ? ` · Available ${open.availableDate}` : ""}
            {open.bedrooms != null ? ` · ${open.bedrooms} bed` : ""}
            {open.bathrooms != null ? ` · ${open.bathrooms} bath` : ""}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-neutral-600">No open listing for this unit.</p>
      )}

      {unit.closedListings.length > 0 ? (
        <p className="mt-2 text-xs text-neutral-500">
          {unit.closedListings.length} closed listing
          {unit.closedListings.length === 1 ? "" : "s"} retained in history.
        </p>
      ) : null}

      {error ? <InlineNotice className="mt-3">{error}</InlineNotice> : null}

      {canManage ? (
        <div className="mt-3 flex flex-wrap gap-3">
          {!open ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                runAction(() => createRentalListingDraftAction(propertyId, unit.unitId, {}))
              }
              className="text-sm font-medium text-neutral-800 underline"
            >
              List for rent
            </button>
          ) : null}

          {open && (open.status === "DRAFT" || open.status === "PAUSED") ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => setEditing((v) => !v)}
              className="text-sm font-medium text-neutral-800 underline"
            >
              {editing ? "Hide editor" : "Edit listing"}
            </button>
          ) : null}

          {open && (open.status === "DRAFT" || open.status === "PAUSED") ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                runAction(() =>
                  open.status === "PAUSED"
                    ? republishRentalListingAction(open.id, propertyId)
                    : publishRentalListingAction(open.id, propertyId),
                )
              }
              className="text-sm font-medium text-neutral-800 underline"
            >
              {open.status === "PAUSED" ? "Republish" : "Publish"}
            </button>
          ) : null}

          {open?.status === "PUBLISHED" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => runAction(() => pauseRentalListingAction(open.id, propertyId))}
              className="text-sm font-medium text-neutral-800 underline"
            >
              Pause
            </button>
          ) : null}

          {open?.status === "PAUSED" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                runAction(() => returnRentalListingToDraftAction(open.id, propertyId))
              }
              className="text-sm font-medium text-neutral-800 underline"
            >
              Return to draft
            </button>
          ) : null}

          {open ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => runAction(() => closeRentalListingAction(open.id, propertyId))}
              className="text-sm font-medium text-neutral-800 underline"
            >
              Close listing
            </button>
          ) : null}
        </div>
      ) : null}

      {canManage && editing && open && (open.status === "DRAFT" || open.status === "PAUSED") ? (
        <ListingEditorForm
          propertyId={propertyId}
          listing={open}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      ) : null}
    </li>
  );
}

export function RentalListingsSection({
  propertyId,
  data,
  canManage,
  loadError,
}: {
  propertyId: string;
  data: RentalListingsPropertyStaffData | null;
  canManage: boolean;
  loadError: string | null;
}) {
  return (
    <div className={`${SURFACE_CARD} mb-8 px-4 py-4`}>
      <p className="text-sm font-medium text-neutral-900">Rental listings</p>
      <p className="mt-1 text-xs text-neutral-500">
        A published listing is what can appear on the public viewing page. Operationally active
        properties and units stay in your portfolio whether or not they are listed.
      </p>

      {loadError ? <InlineNotice className="mt-3">{loadError}</InlineNotice> : null}

      {!loadError && data ? (
        <ul className="mt-4 flex list-none flex-col gap-2 p-0">
          {data.units.map((unit) => (
            <UnitListingCard
              key={unit.unitId}
              propertyId={propertyId}
              unit={unit}
              canManage={canManage}
            />
          ))}
        </ul>
      ) : null}

      {!canManage && !loadError ? (
        <p className="mt-3 text-xs text-neutral-500">
          Property manager or organization admin access is required to create or publish listings.
        </p>
      ) : null}
    </div>
  );
}
