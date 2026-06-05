"use client";

import { createPropertyAction } from "@/app/(dashboard)/properties/actions";
import {
  FormField,
  FormSection,
  InlineNotice,
  PrimaryButton,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

export function AddPropertyForm() {
  const router = useRouter();
  const streetLine1Id = useId();
  const streetLine2Id = useId();
  const cityId = useId();
  const provinceId = useId();
  const postalCodeId = useId();

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [streetLine1, setStreetLine1] = useState("");
  const [streetLine2, setStreetLine2] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("BC");
  const [postalCode, setPostalCode] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createPropertyAction({
        streetLine1,
        streetLine2: streetLine2 || null,
        city,
        province,
        postalCode,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.propertyId) {
        router.push(`/properties/${result.propertyId}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <FormSection legend="Add property">
      <p className="text-sm text-neutral-600">
        Enter the street address — that becomes the property label on public viewing and application
        forms when this organization matches the public portal org.
      </p>
      {error ? <InlineNotice className="mt-4">{error}</InlineNotice> : null}
      <form className={`mt-4 flex flex-col gap-4 ${SURFACE_PANEL} px-4 py-4`} onSubmit={onSubmit}>
        <FormField label="Street address (required)" htmlFor={streetLine1Id}>
          <input
            id={streetLine1Id}
            type="text"
            value={streetLine1}
            onChange={(e) => setStreetLine1(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
            placeholder="123 Main Street"
            required
          />
        </FormField>
        <FormField label="Street line 2 (optional)" htmlFor={streetLine2Id}>
          <input
            id={streetLine2Id}
            type="text"
            value={streetLine2}
            onChange={(e) => setStreetLine2(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
          />
        </FormField>
        <FormField label="City (required)" htmlFor={cityId}>
          <input
            id={cityId}
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
            required
          />
        </FormField>
        <FormField label="Province (required)" htmlFor={provinceId}>
          <input
            id={provinceId}
            type="text"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
            required
          />
        </FormField>
        <FormField label="Postal code (required)" htmlFor={postalCodeId}>
          <input
            id={postalCodeId}
            type="text"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
            required
          />
        </FormField>
        <PrimaryButton type="submit" disabled={pending} className="!w-auto px-6">
          {pending ? "Creating…" : "Create property"}
        </PrimaryButton>
      </form>
    </FormSection>
  );
}
