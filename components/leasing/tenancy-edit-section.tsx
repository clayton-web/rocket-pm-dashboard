"use client";

import {
  resolveNextHealthCleanupTenancyAction,
  updateTenancyDetailsAction,
} from "@/app/(dashboard)/leasing/tenancies/actions";
import {
  FormField,
  FormSection,
  InlineNotice,
  PrimaryButton,
  SURFACE_CARD,
} from "@/components/portal/ui";
import { formatTenancyStatus } from "@/lib/leasing/application-staff-detail";
import {
  buildHealthEditTenancyHref,
  buildHealthReturnUrl,
  type HealthCleanupContext,
} from "@/lib/property/portfolio-health-return";
import { serializeCleanupFiltersParam } from "@/lib/property/portfolio-health-cleanup-filters";
import type { TenancyStaffDetail } from "@/lib/leasing/tenancy-staff-detail-types";
import type { TenancyStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";

const STATUS_OPTIONS: TenancyStatus[] = [
  "pending_move_in",
  "active",
  "notice_received",
  "move_out_scheduled",
  "inspection_scheduled",
  "inspection_completed",
  "ended",
  "archived",
];

function formatStatusLabel(status: TenancyStatus): string {
  return formatTenancyStatus(status);
}

export function TenancyEditSection({
  detail,
  healthCleanupContext = null,
}: {
  detail: TenancyStaffDetail;
  healthCleanupContext?: HealthCleanupContext | null;
}) {
  const router = useRouter();
  const primaryContact =
    detail.contacts.find((contact) => contact.contactType === "tenant") ?? detail.contacts[0];

  const [showEdit, setShowEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const firstNameId = useId();
  const lastNameId = useId();
  const emailId = useId();
  const phoneId = useId();
  const portalAccessId = useId();
  const monthlyRentId = useId();
  const securityDepositId = useId();
  const leaseStartDateId = useId();
  const moveInDateId = useId();
  const leaseEndDateId = useId();
  const statusId = useId();
  const parkingNotesId = useId();
  const storageNotesId = useId();
  const petNotesId = useId();

  const [firstName, setFirstName] = useState(primaryContact?.firstName ?? "");
  const [lastName, setLastName] = useState(primaryContact?.lastName ?? "");
  const [email, setEmail] = useState(primaryContact?.email ?? "");
  const [phone, setPhone] = useState(primaryContact?.phone ?? "");
  const [portalAccessEnabled, setPortalAccessEnabled] = useState(
    primaryContact?.portalAccessEnabled ?? false,
  );
  const [monthlyRent, setMonthlyRent] = useState(detail.monthlyRent);
  const [securityDeposit, setSecurityDeposit] = useState(detail.securityDeposit);
  const [leaseStartDate, setLeaseStartDate] = useState(detail.leaseStartDate);
  const [moveInDate, setMoveInDate] = useState(detail.moveInDate);
  const [leaseEndDate, setLeaseEndDate] = useState(detail.leaseEndDate ?? "");
  const [status, setStatus] = useState(detail.status as TenancyStatus);
  const [parkingDescription, setParkingDescription] = useState(
    detail.leaseSetup.parkingDescription ?? "",
  );
  const [storageDescription, setStorageDescription] = useState(
    detail.leaseSetup.storageDescription ?? "",
  );
  const [petDetails, setPetDetails] = useState(detail.leaseSetup.petDetails ?? "");

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.startsWith("#edit-tenancy")) {
      setShowEdit(true);
    }
  }, []);

  const hasHealthCleanupContext = healthCleanupContext != null;

  async function saveTenancyDetails(): Promise<boolean> {
    const result = await updateTenancyDetailsAction(detail.id, {
      contactId: primaryContact!.id,
      firstName,
      lastName,
      email,
      phone,
      portalAccessEnabled,
      monthlyRent,
      securityDeposit,
      leaseStartDate,
      moveInDate,
      leaseEndDate,
      status,
      parkingDescription,
      storageDescription,
      petDetails,
    });
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const saved = await saveTenancyDetails();
      if (!saved) return;
      setShowEdit(false);
      router.refresh();
    });
  }

  function onSaveAndReturn() {
    if (!healthCleanupContext) return;
    setError(null);
    startTransition(async () => {
      const saved = await saveTenancyDetails();
      if (!saved) return;
      router.push(buildHealthReturnUrl(healthCleanupContext.filters));
    });
  }

  function onSaveAndNext() {
    if (!healthCleanupContext) return;
    setError(null);
    startTransition(async () => {
      const saved = await saveTenancyDetails();
      if (!saved) return;
      const filtersParam = serializeCleanupFiltersParam(healthCleanupContext.filters);
      const next = await resolveNextHealthCleanupTenancyAction(detail.id, filtersParam);
      if (!next.ok) {
        setError(next.error);
        return;
      }
      if (next.nextTenancyId) {
        router.push(buildHealthEditTenancyHref(next.nextTenancyId, healthCleanupContext.filters));
        return;
      }
      router.push(buildHealthReturnUrl(healthCleanupContext.filters, { cleanupDone: "1" }));
    });
  }

  if (!primaryContact) {
    return (
      <div id="edit-tenancy" className={`${SURFACE_CARD} mb-8 px-4 py-4`}>
        <FormSection legend="Edit tenancy">
          <InlineNotice>
            No tenant contact is on this tenancy yet. Add a contact before editing imported tenant
            details.
          </InlineNotice>
        </FormSection>
      </div>
    );
  }

  return (
    <div id="edit-tenancy" className={`${SURFACE_CARD} mb-8 px-4 py-4`}>
      <FormSection legend="Edit tenancy">
        <p className="text-sm text-neutral-600">
          Correct imported tenant and lease details. New tenancies should still follow the normal
          application and onboarding workflow.
        </p>
        {hasHealthCleanupContext ? (
          <p className="mt-2 text-sm text-neutral-600">
            Opened from Property Health cleanup. You can save and return to the filtered queue or
            continue to the next matching tenancy.
          </p>
        ) : null}
        {!showEdit ? (
          <button
            type="button"
            onClick={() => setShowEdit(true)}
            className="mt-3 text-sm font-medium text-neutral-800 underline"
          >
            Edit tenancy
          </button>
        ) : (
          <form className="mt-4 flex flex-col gap-6 border-t border-neutral-200 pt-4" onSubmit={onSave}>
            {error ? <InlineNotice>{error}</InlineNotice> : null}

            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Tenant contact</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <FormField label="First name" htmlFor={firstNameId}>
                  <input
                    id={firstNameId}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                    required
                  />
                </FormField>
                <FormField label="Last name" htmlFor={lastNameId}>
                  <input
                    id={lastNameId}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                    required
                  />
                </FormField>
                <FormField label="Email (optional)" htmlFor={emailId}>
                  <input
                    id={emailId}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </FormField>
                <FormField label="Phone (optional)" htmlFor={phoneId}>
                  <input
                    id={phoneId}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </FormField>
              </div>
              <div className="mt-4">
                <label className="flex items-center gap-2 text-sm text-neutral-800">
                  <input
                    id={portalAccessId}
                    type="checkbox"
                    checked={portalAccessEnabled}
                    onChange={(e) => setPortalAccessEnabled(e.target.checked)}
                  />
                  Portal access enabled
                </label>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Lease</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <FormField label="Monthly rent" htmlFor={monthlyRentId}>
                  <input
                    id={monthlyRentId}
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                    required
                  />
                </FormField>
                <FormField label="Security deposit" htmlFor={securityDepositId}>
                  <input
                    id={securityDepositId}
                    type="number"
                    min="0"
                    step="0.01"
                    value={securityDeposit}
                    onChange={(e) => setSecurityDeposit(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                    required
                  />
                </FormField>
                <FormField label="Lease start date" htmlFor={leaseStartDateId}>
                  <input
                    id={leaseStartDateId}
                    type="date"
                    value={leaseStartDate}
                    onChange={(e) => setLeaseStartDate(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                    required
                  />
                </FormField>
                <FormField label="Move-in date" htmlFor={moveInDateId}>
                  <input
                    id={moveInDateId}
                    type="date"
                    value={moveInDate}
                    onChange={(e) => setMoveInDate(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                    required
                  />
                </FormField>
                <FormField label="Lease end date (optional)" htmlFor={leaseEndDateId}>
                  <input
                    id={leaseEndDateId}
                    type="date"
                    value={leaseEndDate}
                    onChange={(e) => setLeaseEndDate(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </FormField>
                <FormField label="Status" htmlFor={statusId}>
                  <select
                    id={statusId}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TenancyStatus)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {formatStatusLabel(option)}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                Move-out scheduling and inspections still use the dedicated offboarding actions
                when available.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Notes</h3>
              <div className="mt-3 grid gap-4">
                <FormField label="Parking notes (optional)" htmlFor={parkingNotesId}>
                  <textarea
                    id={parkingNotesId}
                    rows={2}
                    value={parkingDescription}
                    onChange={(e) => setParkingDescription(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </FormField>
                <FormField label="Storage notes (optional)" htmlFor={storageNotesId}>
                  <textarea
                    id={storageNotesId}
                    rows={2}
                    value={storageDescription}
                    onChange={(e) => setStorageDescription(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </FormField>
                <FormField label="Pet notes (optional)" htmlFor={petNotesId}>
                  <textarea
                    id={petNotesId}
                    rows={2}
                    value={petDetails}
                    onChange={(e) => setPetDetails(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </FormField>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <PrimaryButton type="submit" className="!w-auto px-6" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </PrimaryButton>
              {hasHealthCleanupContext ? (
                <>
                  <PrimaryButton
                    type="button"
                    className="!w-auto px-6"
                    disabled={pending}
                    onClick={onSaveAndReturn}
                  >
                    {pending ? "Saving…" : "Save & return to Health"}
                  </PrimaryButton>
                  <PrimaryButton
                    type="button"
                    className="!w-auto px-6"
                    disabled={pending}
                    onClick={onSaveAndNext}
                  >
                    {pending ? "Saving…" : "Save & next issue"}
                  </PrimaryButton>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                className="text-sm font-medium text-neutral-700 underline"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </FormSection>
    </div>
  );
}
