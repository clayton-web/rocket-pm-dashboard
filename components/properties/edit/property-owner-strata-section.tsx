"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePropertyOwnerStrataAction } from "@/app/(dashboard)/properties/actions";
import {
  FormField,
  InlineNotice,
  PrimaryButton,
  SURFACE_CARD,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import {
  EditCancelButton,
  EditDisclosureButton,
  PROPERTY_EDIT_INPUT_CLASS,
  usePropertyEditSection,
} from "@/components/properties/edit/edit-controls";
import { HealthCleanupActions } from "@/components/properties/edit/health-cleanup-actions";
import { PROPERTY_EDIT_FIELDS } from "@/lib/property/portfolio-health-edit-targets";
import type { HealthViewState } from "@/lib/property/portfolio-health-return";

/**
 * Extracted verbatim from `property-detail.tsx`, with two additions: the control ids are now the
 * canonical field names from the edit-target contract, which is what lets an `owner_contact` or
 * `strata_notes` Fix action land on the right input, and the cleanup-loop controls appear when the
 * staff member arrived from Property Health.
 */
export function PropertyOwnerStrataSection({
  propertyId,
  ownerEmail,
  ownerPhone,
  strataNotes,
  canEdit,
  healthContext = null,
}: {
  propertyId: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  strataNotes: string | null;
  canEdit: boolean;
  healthContext?: HealthViewState | null;
}) {
  const router = useRouter();
  const { showEdit, setShowEdit, anchorId } = usePropertyEditSection("owner-strata");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [ownerEmailValue, setOwnerEmailValue] = useState(ownerEmail ?? "");
  const [ownerPhoneValue, setOwnerPhoneValue] = useState(ownerPhone ?? "");
  const [strataNotesValue, setStrataNotesValue] = useState(strataNotes ?? "");

  async function saveOwnerStrata(): Promise<boolean> {
    setError(null);
    const result = await updatePropertyOwnerStrataAction(propertyId, {
      ownerEmail: ownerEmailValue || null,
      ownerPhone: ownerPhoneValue || null,
      strataNotes: strataNotesValue || null,
    });
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      if (!(await saveOwnerStrata())) return;
      setShowEdit(false);
      router.refresh();
    });
  }

  return (
    <div id={anchorId} className={`${SURFACE_CARD} mb-8 px-4 py-4`}>
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
          {strataNotes ? <span className="whitespace-pre-wrap">{strataNotes}</span> : "—"}
        </p>
      </div>
      {canEdit ? (
        <div className="mt-3">
          {!showEdit ? (
            <EditDisclosureButton onClick={() => setShowEdit(true)}>
              Edit owner &amp; strata
            </EditDisclosureButton>
          ) : (
            <form className="mt-3 flex flex-col gap-4 border-t border-neutral-200 pt-4" onSubmit={onSave}>
              {error ? <InlineNotice>{error}</InlineNotice> : null}
              <FormField label="Owner Email" htmlFor={PROPERTY_EDIT_FIELDS.ownerEmail}>
                <input
                  id={PROPERTY_EDIT_FIELDS.ownerEmail}
                  name={PROPERTY_EDIT_FIELDS.ownerEmail}
                  type="email"
                  value={ownerEmailValue}
                  onChange={(e) => setOwnerEmailValue(e.target.value)}
                  className={PROPERTY_EDIT_INPUT_CLASS}
                />
              </FormField>
              <FormField label="Owner Phone" htmlFor={PROPERTY_EDIT_FIELDS.ownerPhone}>
                <input
                  id={PROPERTY_EDIT_FIELDS.ownerPhone}
                  name={PROPERTY_EDIT_FIELDS.ownerPhone}
                  type="tel"
                  value={ownerPhoneValue}
                  onChange={(e) => setOwnerPhoneValue(e.target.value)}
                  className={PROPERTY_EDIT_INPUT_CLASS}
                />
              </FormField>
              <FormField label="Strata Notes" htmlFor={PROPERTY_EDIT_FIELDS.strataNotes}>
                <textarea
                  id={PROPERTY_EDIT_FIELDS.strataNotes}
                  name={PROPERTY_EDIT_FIELDS.strataNotes}
                  rows={4}
                  value={strataNotesValue}
                  onChange={(e) => setStrataNotesValue(e.target.value)}
                  className={PROPERTY_EDIT_INPUT_CLASS}
                />
              </FormField>
              <div className="flex flex-wrap gap-3">
                <PrimaryButton type="submit" disabled={pending} className="!w-auto px-5">
                  {pending ? "Saving…" : "Save"}
                </PrimaryButton>
                {healthContext ? (
                  <HealthCleanupActions
                    propertyId={propertyId}
                    context={healthContext}
                    disabled={pending}
                    save={saveOwnerStrata}
                    onError={setError}
                  />
                ) : null}
                <EditCancelButton
                  disabled={pending}
                  onClick={() => {
                    setShowEdit(false);
                    setError(null);
                    setOwnerEmailValue(ownerEmail ?? "");
                    setOwnerPhoneValue(ownerPhone ?? "");
                    setStrataNotesValue(strataNotes ?? "");
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
