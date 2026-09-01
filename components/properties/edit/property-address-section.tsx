"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  checkPropertyAddressDuplicatesAction,
  updatePropertyAddressAction,
} from "@/app/(dashboard)/properties/actions";
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
import {
  PROPERTY_ADDRESS_DUPLICATE_WARNING,
  type PropertyAddressDuplicateMatch,
} from "@/lib/property/property-address-duplicates";
import {
  PROPERTY_PROVINCE_CODES,
  DEFAULT_PROPERTY_COUNTRY,
  DEFAULT_PROPERTY_PROVINCE,
} from "@/lib/validation/property-address";

export type PropertyAddressFields = {
  streetLine1: string;
  streetLine2: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
};

const DUPLICATE_CHECK_DEBOUNCE_MS = 600;

function formatMatch(match: PropertyAddressDuplicateMatch): string {
  const street = match.streetLine2
    ? `${match.streetLine1}, ${match.streetLine2}`
    : match.streetLine1;
  return `${street} · ${match.city} ${match.postalCode}`;
}

/**
 * The canonical manual property-address editor.
 *
 * This is the only place the six structured address fields are edited. Property Health does not
 * carry its own copy — a Fix action deep links here, which is what keeps the two surfaces from
 * drifting apart.
 *
 * Warnings never block. An active tenancy or a likely duplicate is reported and the save proceeds,
 * because the data being corrected is frequently wrong precisely on occupied properties.
 */
export function PropertyAddressSection({
  propertyId,
  address,
  canEdit,
  hasActiveTenancy,
  healthContext,
}: {
  propertyId: string;
  address: PropertyAddressFields;
  canEdit: boolean;
  hasActiveTenancy: boolean;
  healthContext: HealthViewState | null;
}) {
  const router = useRouter();
  const { showEdit, setShowEdit, anchorId } = usePropertyEditSection("address");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [streetLine1, setStreetLine1] = useState(address.streetLine1);
  const [streetLine2, setStreetLine2] = useState(address.streetLine2 ?? "");
  const [city, setCity] = useState(address.city);
  const [province, setProvince] = useState(address.province || DEFAULT_PROPERTY_PROVINCE);
  const [postalCode, setPostalCode] = useState(address.postalCode);
  const [country, setCountry] = useState(address.country || DEFAULT_PROPERTY_COUNTRY);

  const [duplicates, setDuplicates] = useState<PropertyAddressDuplicateMatch[]>([]);

  function currentValues() {
    return {
      streetLine1,
      streetLine2: streetLine2 || null,
      city,
      province,
      postalCode,
      country,
    };
  }

  function resetFields() {
    setStreetLine1(address.streetLine1);
    setStreetLine2(address.streetLine2 ?? "");
    setCity(address.city);
    setProvince(address.province || DEFAULT_PROPERTY_PROVINCE);
    setPostalCode(address.postalCode);
    setCountry(address.country || DEFAULT_PROPERTY_COUNTRY);
    setDuplicates([]);
    setError(null);
  }

  /**
   * Advisory duplicate lookup while the form is open.
   *
   * Debounced, and stale responses are discarded by sequence number so a slow reply for an older
   * keystroke cannot overwrite the warning for what is currently typed. A failed or incomplete
   * check simply shows nothing — it must never stand between the staff member and a save.
   */
  const checkSequence = useRef(0);
  useEffect(() => {
    if (!showEdit) return;

    const sequence = ++checkSequence.current;
    const timer = setTimeout(() => {
      void checkPropertyAddressDuplicatesAction(propertyId, {
        streetLine1,
        streetLine2: streetLine2 || null,
        city,
        province,
        postalCode,
        country,
      }).then((result) => {
        if (sequence !== checkSequence.current) return;
        setDuplicates(result.ok ? result.duplicates : []);
      });
    }, DUPLICATE_CHECK_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [showEdit, propertyId, streetLine1, streetLine2, city, province, postalCode, country]);

  async function saveAddress(): Promise<boolean> {
    setError(null);
    const result = await updatePropertyAddressAction(propertyId, currentValues());
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      if (!(await saveAddress())) return;
      setShowEdit(false);
      router.refresh();
    });
  }

  return (
    <div id={anchorId} className={`${SURFACE_CARD} mb-4 px-4 py-4`}>
      <p className="text-sm font-medium text-neutral-900">Address</p>
      <div className={`${SURFACE_PANEL} mt-3 space-y-2 px-3.5 py-3`}>
        <p className="text-sm text-neutral-700">
          <span className="text-neutral-500">Street · </span>
          {address.streetLine1}
        </p>
        <p className="text-sm text-neutral-700">
          <span className="text-neutral-500">Street line 2 · </span>
          {address.streetLine2 ?? "—"}
        </p>
        <p className="text-sm text-neutral-700">
          <span className="text-neutral-500">City · </span>
          {address.city}
        </p>
        <p className="text-sm text-neutral-700">
          <span className="text-neutral-500">Province · </span>
          {address.province}
        </p>
        <p className="text-sm text-neutral-700">
          <span className="text-neutral-500">Postal code · </span>
          {address.postalCode}
        </p>
        <p className="text-sm text-neutral-700">
          <span className="text-neutral-500">Country · </span>
          {address.country}
        </p>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        The street address is also this property&apos;s name everywhere it is listed, so correcting it
        here updates both.
      </p>

      {canEdit ? (
        <div className="mt-3">
          {!showEdit ? (
            <EditDisclosureButton onClick={() => setShowEdit(true)}>
              Edit address
            </EditDisclosureButton>
          ) : (
            <form
              className="mt-3 flex flex-col gap-4 border-t border-neutral-200 pt-4"
              onSubmit={onSave}
            >
              {error ? <InlineNotice tone="danger" role="alert">{error}</InlineNotice> : null}

              {hasActiveTenancy ? (
                <InlineNotice tone="warning">
                  This property has an active tenancy. Tenancies, documents and history stay linked to
                  the property record itself, so nothing is detached by fixing the address. Documents
                  already generated keep the address they were produced with; documents generated from
                  now on use the corrected address.
                </InlineNotice>
              ) : null}

              {duplicates.length > 0 ? (
                <InlineNotice tone="warning">
                  {PROPERTY_ADDRESS_DUPLICATE_WARNING} Saving is still allowed — check whether these
                  are genuinely separate units.{" "}
                  {duplicates.map((match, index) => (
                    <span key={match.propertyId}>
                      {index > 0 ? "; " : ""}
                      <Link href={`/properties/${match.propertyId}`} className="underline">
                        {formatMatch(match)}
                      </Link>
                      {match.postalCodeMismatch ? " (different postal code)" : ""}
                    </span>
                  ))}
                </InlineNotice>
              ) : null}

              <FormField
                label="Street address (required)"
                htmlFor={PROPERTY_EDIT_FIELDS.streetLine1}
                helper="Also used as the property name."
              >
                <input
                  id={PROPERTY_EDIT_FIELDS.streetLine1}
                  name={PROPERTY_EDIT_FIELDS.streetLine1}
                  type="text"
                  value={streetLine1}
                  onChange={(e) => setStreetLine1(e.target.value)}
                  className={PROPERTY_EDIT_INPUT_CLASS}
                  required
                />
              </FormField>

              <FormField
                label="Street line 2 (optional)"
                htmlFor={PROPERTY_EDIT_FIELDS.streetLine2}
                helper="Suite, unit or secondary designator that distinguishes this record."
              >
                <input
                  id={PROPERTY_EDIT_FIELDS.streetLine2}
                  name={PROPERTY_EDIT_FIELDS.streetLine2}
                  type="text"
                  value={streetLine2}
                  onChange={(e) => setStreetLine2(e.target.value)}
                  className={PROPERTY_EDIT_INPUT_CLASS}
                />
              </FormField>

              <FormField label="City (required)" htmlFor={PROPERTY_EDIT_FIELDS.city}>
                <input
                  id={PROPERTY_EDIT_FIELDS.city}
                  name={PROPERTY_EDIT_FIELDS.city}
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={PROPERTY_EDIT_INPUT_CLASS}
                  required
                />
              </FormField>

              <FormField label="Province (required)" htmlFor={PROPERTY_EDIT_FIELDS.province}>
                <select
                  id={PROPERTY_EDIT_FIELDS.province}
                  name={PROPERTY_EDIT_FIELDS.province}
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className={PROPERTY_EDIT_INPUT_CLASS}
                >
                  {PROPERTY_PROVINCE_CODES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField
                label="Postal code (required)"
                htmlFor={PROPERTY_EDIT_FIELDS.postalCode}
                helper="Canadian format, for example V6B 1A1."
              >
                <input
                  id={PROPERTY_EDIT_FIELDS.postalCode}
                  name={PROPERTY_EDIT_FIELDS.postalCode}
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className={PROPERTY_EDIT_INPUT_CLASS}
                  required
                />
              </FormField>

              <FormField
                label="Country (required)"
                htmlFor={PROPERTY_EDIT_FIELDS.country}
                helper="Canadian addresses only."
              >
                <select
                  id={PROPERTY_EDIT_FIELDS.country}
                  name={PROPERTY_EDIT_FIELDS.country}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className={PROPERTY_EDIT_INPUT_CLASS}
                >
                  <option value={DEFAULT_PROPERTY_COUNTRY}>{DEFAULT_PROPERTY_COUNTRY}</option>
                </select>
              </FormField>

              <div className="flex flex-wrap gap-3">
                <PrimaryButton type="submit" disabled={pending} className="!w-auto px-5">
                  {pending ? "Saving…" : "Save address"}
                </PrimaryButton>
                {healthContext ? (
                  <HealthCleanupActions
                    propertyId={propertyId}
                    context={healthContext}
                    disabled={pending}
                    save={saveAddress}
                    onError={setError}
                  />
                ) : null}
                <EditCancelButton
                  disabled={pending}
                  onClick={() => {
                    setShowEdit(false);
                    resetFields();
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
