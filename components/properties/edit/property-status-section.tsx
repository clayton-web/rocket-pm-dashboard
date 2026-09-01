"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePropertyServiceRelationshipAction } from "@/app/(dashboard)/properties/actions";
import { FormField, InlineNotice, PrimaryButton, SURFACE_CARD } from "@/components/portal/ui";
import {
  EditCancelButton,
  EditDisclosureButton,
  PROPERTY_EDIT_INPUT_CLASS,
  usePropertyEditSection,
} from "@/components/properties/edit/edit-controls";
import {
  PROPERTY_SERVICE_RELATIONSHIPS,
  PROPERTY_SERVICE_RELATIONSHIP_HELPERS,
  PROPERTY_SERVICE_RELATIONSHIP_LABELS,
  formatPropertyServiceRelationship,
  type PropertyServiceRelationshipValue,
} from "@/lib/property/service-relationship";

/** Extracted verbatim from `property-detail.tsx` so Property Health can deep link to it. */
export function PropertyStatusSection({
  propertyId,
  isActive,
  serviceRelationship,
  canEdit,
}: {
  propertyId: string;
  isActive: boolean;
  serviceRelationship: PropertyServiceRelationshipValue;
  canEdit: boolean;
}) {
  const router = useRouter();
  const serviceRelationshipId = useId();
  const { showEdit, setShowEdit, anchorId } = usePropertyEditSection("status");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(serviceRelationship);

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updatePropertyServiceRelationshipAction(propertyId, {
        serviceRelationship: value,
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
    <div id={anchorId} className={`${SURFACE_CARD} mb-4 px-4 py-4`}>
      <p className="text-sm text-neutral-700">
        <span className="text-neutral-500">Operational status · </span>
        {isActive ? "Active" : "Inactive"}
      </p>
      <p className="mt-2 text-sm text-neutral-700">
        <span className="text-neutral-500">Service relationship · </span>
        {formatPropertyServiceRelationship(serviceRelationship)}
      </p>
      <p className="mt-2 text-xs text-neutral-500">
        Active means the property record is available in the system. Service relationship describes
        Axford&apos;s engagement (managed, leasing then manage, or placement only). Public advertising
        is controlled separately by a published rental listing below — not by Active status.
      </p>
      {serviceRelationship === "PRE_MANAGEMENT" ? (
        <p className="mt-2 text-xs text-neutral-600">
          Pre-management: leasing now with the intention to begin ongoing management after placement.
          Converting an approved application to a managed tenancy sets this property to Managed in the
          same step.
        </p>
      ) : null}
      {serviceRelationship === "PLACEMENT_ONLY" ? (
        <p className="mt-2 text-xs text-neutral-600">
          Placement only: advertise and place a tenant; do not treat this as an ongoing managed
          property after placement. Leasing history is retained.
        </p>
      ) : null}
      {canEdit ? (
        <div className="mt-3">
          {!showEdit ? (
            <EditDisclosureButton
              onClick={() => {
                setValue(serviceRelationship);
                setShowEdit(true);
              }}
            >
              Edit service relationship
            </EditDisclosureButton>
          ) : (
            <form className="mt-3 flex flex-col gap-3 border-t border-neutral-200 pt-3" onSubmit={onSave}>
              {error ? <InlineNotice>{error}</InlineNotice> : null}
              <FormField
                label="Service relationship"
                htmlFor={serviceRelationshipId}
                helper={PROPERTY_SERVICE_RELATIONSHIP_HELPERS[value]}
              >
                <select
                  id={serviceRelationshipId}
                  value={value}
                  onChange={(e) => setValue(e.target.value as PropertyServiceRelationshipValue)}
                  className={PROPERTY_EDIT_INPUT_CLASS}
                >
                  {PROPERTY_SERVICE_RELATIONSHIPS.map((option) => (
                    <option key={option} value={option}>
                      {PROPERTY_SERVICE_RELATIONSHIP_LABELS[option]}
                    </option>
                  ))}
                </select>
              </FormField>
              {serviceRelationship === "PLACEMENT_ONLY" &&
              (value === "MANAGED" || value === "PRE_MANAGEMENT") ? (
                <InlineNotice>
                  Changing away from Tenant Placement Only enables managed tenancy conversion and
                  ongoing management workflows. Do not change this merely to bypass the placement
                  conversion guard. Confirm this matches the real business relationship.
                </InlineNotice>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <PrimaryButton type="submit" disabled={pending} className="!w-auto px-5">
                  {pending
                    ? "Saving…"
                    : serviceRelationship === "PLACEMENT_ONLY" &&
                        (value === "MANAGED" || value === "PRE_MANAGEMENT")
                      ? "Confirm relationship change"
                      : "Save"}
                </PrimaryButton>
                <EditCancelButton
                  disabled={pending}
                  onClick={() => {
                    setShowEdit(false);
                    setError(null);
                    setValue(serviceRelationship);
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
