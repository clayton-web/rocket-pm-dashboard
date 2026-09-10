"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePropertyProfileAction } from "@/app/(dashboard)/properties/actions";
import { FormField, InlineNotice, PrimaryButton, SURFACE_CARD } from "@/components/portal/ui";
import {
  EditCancelButton,
  EditDisclosureButton,
  PROPERTY_EDIT_INPUT_CLASS,
  usePropertyEditSection,
} from "@/components/properties/edit/edit-controls";
import {
  PROPERTY_PROFILE_TYPES,
  PROPERTY_PROFILE_TYPE_LABELS,
  formatPropertyProfileTypeLabel,
  type PropertyProfileFields,
} from "@/lib/property/profile";

export function formatProfileSummary(profile: PropertyProfileFields): string {
  const parts: string[] = [];
  const typeLabel = formatPropertyProfileTypeLabel(profile.propertyType);
  if (typeLabel) parts.push(typeLabel);
  if (profile.bedrooms != null) parts.push(`${profile.bedrooms} bed`);
  if (profile.bathrooms != null) parts.push(`${profile.bathrooms} bath`);
  if (profile.approxSqft != null) parts.push(`${profile.approxSqft.toLocaleString("en-CA")} sqft`);
  return parts.length > 0 ? parts.join(" · ") : "No profile details saved yet";
}

/** Extracted verbatim from `property-detail.tsx` so Property Health can deep link to it. */
export function PropertyProfileSection({
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
  const { showEdit, setShowEdit, anchorId } = usePropertyEditSection("profile");
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
    <div id={anchorId} className={`${SURFACE_CARD} mb-8 px-4 py-4`}>
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
            <EditDisclosureButton onClick={() => setShowEdit(true)}>
              Edit property profile
            </EditDisclosureButton>
          ) : (
            <form className="mt-3 flex flex-col gap-4 border-t border-neutral-200 pt-4" onSubmit={onSave}>
              {error ? <InlineNotice>{error}</InlineNotice> : null}
              <FormField label="Property type (optional)" htmlFor={propertyTypeId}>
                <select
                  id={propertyTypeId}
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className={PROPERTY_EDIT_INPUT_CLASS}
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
                  className={PROPERTY_EDIT_INPUT_CLASS}
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
                  className={PROPERTY_EDIT_INPUT_CLASS}
                />
              </FormField>
              <FormField label="Approx. sqft (optional)" htmlFor={approxSqftId}>
                <input
                  id={approxSqftId}
                  type="number"
                  min={1}
                  value={approxSqft}
                  onChange={(e) => setApproxSqft(e.target.value)}
                  className={PROPERTY_EDIT_INPUT_CLASS}
                />
              </FormField>
              <div className="flex flex-wrap gap-3">
                <PrimaryButton type="submit" disabled={pending} className="!w-auto px-5">
                  {pending ? "Saving…" : "Save profile"}
                </PrimaryButton>
                <EditCancelButton
                  disabled={pending}
                  onClick={() => {
                    setShowEdit(false);
                    setError(null);
                    setPropertyType(profile.propertyType ?? "");
                    setBedrooms(profile.bedrooms != null ? String(profile.bedrooms) : "");
                    setBathrooms(profile.bathrooms != null ? String(profile.bathrooms) : "");
                    setApproxSqft(profile.approxSqft != null ? String(profile.approxSqft) : "");
                  }}
                />
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
