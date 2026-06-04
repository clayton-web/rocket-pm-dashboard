"use client";

import { updateOrganizationLandlordProfileAction } from "@/app/(dashboard)/organization/actions";
import {
  FormField,
  FormSection,
  InlineNotice,
  PrimaryButton,
} from "@/components/portal/ui";
import type { OrganizationLandlordDetail } from "@/lib/org/organization-landlord-profile";
import { organizationLandlordFormDefaults } from "@/lib/validation/organization-landlord";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function OrganizationLandlordProfileForm({
  initialProfile,
  canEdit,
}: {
  initialProfile: OrganizationLandlordDetail;
  canEdit: boolean;
}) {
  const router = useRouter();
  const defaults = organizationLandlordFormDefaults(initialProfile);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [landlordLegalName, setLandlordLegalName] = useState(defaults.landlordLegalName);
  const [landlordServiceStreetLine1, setLandlordServiceStreetLine1] = useState(
    defaults.landlordServiceStreetLine1,
  );
  const [landlordServiceStreetLine2, setLandlordServiceStreetLine2] = useState(
    defaults.landlordServiceStreetLine2 ?? "",
  );
  const [landlordServiceCity, setLandlordServiceCity] = useState(defaults.landlordServiceCity);
  const [landlordServiceProvince, setLandlordServiceProvince] = useState(
    defaults.landlordServiceProvince,
  );
  const [landlordServicePostalCode, setLandlordServicePostalCode] = useState(
    defaults.landlordServicePostalCode,
  );
  const [landlordServicePhone, setLandlordServicePhone] = useState(defaults.landlordServicePhone);
  const [landlordServiceEmail, setLandlordServiceEmail] = useState(
    defaults.landlordServiceEmail ?? "",
  );
  const [landlordIsAgent, setLandlordIsAgent] = useState(defaults.landlordIsAgent);

  function onSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await updateOrganizationLandlordProfileAction({
        landlordLegalName,
        landlordServiceStreetLine1,
        landlordServiceStreetLine2: landlordServiceStreetLine2 || null,
        landlordServiceCity,
        landlordServiceProvince,
        landlordServicePostalCode,
        landlordServicePhone,
        landlordServiceEmail: landlordServiceEmail || null,
        landlordIsAgent,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <FormSection legend="Landlord / service profile (RTB-1)">
      <p className="text-sm text-neutral-600">
        Legal landlord name and service-of-documents address used on BC RTB-1 agreements for all
        properties in {initialProfile.organizationName}.
      </p>

      {error ? <InlineNotice className="mt-4">{error}</InlineNotice> : null}

      {!canEdit ? (
        <InlineNotice className="mt-4">
          Organization admin access is required to edit the landlord profile.
        </InlineNotice>
      ) : null}

      <div className="mt-4 flex flex-col gap-4">
        <FormField label="Legal landlord name" htmlFor="landlord-legal-name">
          <input
            id="landlord-legal-name"
            type="text"
            value={landlordLegalName}
            onChange={(e) => setLandlordLegalName(e.target.value)}
            disabled={!canEdit || pending}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </FormField>

        <FormField label="Service address line 1" htmlFor="landlord-service-line1">
          <input
            id="landlord-service-line1"
            type="text"
            value={landlordServiceStreetLine1}
            onChange={(e) => setLandlordServiceStreetLine1(e.target.value)}
            disabled={!canEdit || pending}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </FormField>

        <FormField label="Service address line 2 (optional)" htmlFor="landlord-service-line2">
          <input
            id="landlord-service-line2"
            type="text"
            value={landlordServiceStreetLine2}
            onChange={(e) => setLandlordServiceStreetLine2(e.target.value)}
            disabled={!canEdit || pending}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="City" htmlFor="landlord-service-city">
            <input
              id="landlord-service-city"
              type="text"
              value={landlordServiceCity}
              onChange={(e) => setLandlordServiceCity(e.target.value)}
              disabled={!canEdit || pending}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </FormField>
          <FormField label="Province" htmlFor="landlord-service-province">
            <input
              id="landlord-service-province"
              type="text"
              value={landlordServiceProvince}
              onChange={(e) => setLandlordServiceProvince(e.target.value)}
              disabled={!canEdit || pending}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </FormField>
          <FormField label="Postal code" htmlFor="landlord-service-postal">
            <input
              id="landlord-service-postal"
              type="text"
              value={landlordServicePostalCode}
              onChange={(e) => setLandlordServicePostalCode(e.target.value)}
              disabled={!canEdit || pending}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </FormField>
        </div>

        <FormField label="Service phone" htmlFor="landlord-service-phone">
          <input
            id="landlord-service-phone"
            type="tel"
            value={landlordServicePhone}
            onChange={(e) => setLandlordServicePhone(e.target.value)}
            disabled={!canEdit || pending}
            className="w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </FormField>

        <FormField label="Service email (optional)" htmlFor="landlord-service-email">
          <input
            id="landlord-service-email"
            type="email"
            value={landlordServiceEmail}
            onChange={(e) => setLandlordServiceEmail(e.target.value)}
            disabled={!canEdit || pending}
            className="w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </FormField>

        <FormField label="Landlord designation" htmlFor="landlord-is-agent">
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              id="landlord-is-agent"
              type="checkbox"
              checked={landlordIsAgent}
              onChange={(e) => setLandlordIsAgent(e.target.checked)}
              disabled={!canEdit || pending}
            />
            Landlord is an agent (not the property owner)
          </label>
        </FormField>

        {canEdit ? (
          <PrimaryButton
            type="button"
            className="!w-auto px-6"
            disabled={pending}
            onClick={onSubmit}
          >
            {pending ? "Saving…" : "Save landlord profile"}
          </PrimaryButton>
        ) : null}
      </div>
    </FormSection>
  );
}
