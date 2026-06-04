"use client";

import { updateLeaseSetupAction } from "@/app/(dashboard)/leasing/tenancies/actions";
import {
  FormField,
  FormSection,
  InlineNotice,
  PrimaryButton,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import {
  emptyServicesIncluded,
  RTB_SERVICE_KEYS,
  RTB_SERVICE_LABELS,
  type RtbServiceKey,
  type TenancyType,
  type RentPeriod,
} from "@/lib/leasing/lease-setup";
import type { LeaseSetupReadinessStatus } from "@/lib/leasing/lease-setup-readiness";
import type { TenancyStaffDetail } from "@/lib/leasing/tenancy-staff-detail";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

function statusNoticeClass(status: LeaseSetupReadinessStatus): string {
  if (status === "ready_for_rtb1") {
    return "border-emerald-300 bg-emerald-50 text-emerald-950";
  }
  if (status === "lease_setup_complete") {
    return "border-sky-300 bg-sky-50 text-sky-950";
  }
  return "border-amber-300 bg-amber-50 text-amber-950";
}

export function LeaseSetupSection({ detail }: { detail: TenancyStaffDetail }) {
  const router = useRouter();
  const setup = detail.leaseSetup;
  const initialServices = useMemo(() => {
    const base = emptyServicesIncluded();
    if (setup.servicesIncluded) {
      for (const key of RTB_SERVICE_KEYS) {
        if (setup.servicesIncluded[key] != null) {
          base[key] = setup.servicesIncluded[key]!;
        }
      }
    }
    return base;
  }, [setup.servicesIncluded]);

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [tenancyType, setTenancyType] = useState(setup.tenancyType ?? "month_to_month");
  const [rentPeriod, setRentPeriod] = useState(setup.rentPeriod ?? "month");
  const [leaseEndDate, setLeaseEndDate] = useState(detail.leaseEndDate ?? "");
  const [fixedTermEndBehavior, setFixedTermEndBehavior] = useState(
    setup.fixedTermEndBehavior ?? "",
  );
  const [vacateReason, setVacateReason] = useState(setup.vacateReason ?? "");
  const [vacateRtrSection, setVacateRtrSection] = useState(setup.vacateRtrSection ?? "");
  const [vacateClauseAttested, setVacateClauseAttested] = useState(
    setup.vacateClauseAttested ?? false,
  );
  const [securityDepositDueDate, setSecurityDepositDueDate] = useState(
    setup.securityDepositDueDate ?? "",
  );
  const [petDepositDueDate, setPetDepositDueDate] = useState(setup.petDepositDueDate ?? "");
  const [petDepositNotApplicable, setPetDepositNotApplicable] = useState(
    setup.petDepositNotApplicable ?? false,
  );
  const [petDeposit, setPetDeposit] = useState(detail.petDeposit ?? "");
  const [servicesIncluded, setServicesIncluded] =
    useState<Record<RtbServiceKey, boolean>>(initialServices);
  const [parkingDescription, setParkingDescription] = useState(setup.parkingDescription ?? "");
  const [storageDescription, setStorageDescription] = useState(setup.storageDescription ?? "");
  const [addendumAttached, setAddendumAttached] = useState(setup.addendumAttached ?? false);
  const [addendumPageCount, setAddendumPageCount] = useState(
    setup.addendumPageCount != null ? String(setup.addendumPageCount) : "",
  );
  const [addendumTermCount, setAddendumTermCount] = useState(
    setup.addendumTermCount != null ? String(setup.addendumTermCount) : "",
  );

  function toggleService(key: RtbServiceKey) {
    setServicesIncluded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function onSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateLeaseSetupAction(detail.id, {
        tenancyType,
        rentPeriod,
        leaseEndDate: tenancyType === "fixed_term" ? leaseEndDate : undefined,
        fixedTermEndBehavior: tenancyType === "fixed_term" ? fixedTermEndBehavior : undefined,
        vacateReason: fixedTermEndBehavior === "vacate" ? vacateReason : undefined,
        vacateRtrSection: fixedTermEndBehavior === "vacate" ? vacateRtrSection : undefined,
        vacateClauseAttested: fixedTermEndBehavior === "vacate" ? vacateClauseAttested : undefined,
        securityDepositDueDate,
        petDepositDueDate: petDepositNotApplicable ? undefined : petDepositDueDate,
        petDepositNotApplicable,
        petDeposit: petDepositNotApplicable ? undefined : petDeposit,
        servicesIncluded,
        parkingDescription: servicesIncluded.parking ? parkingDescription : undefined,
        storageDescription: servicesIncluded.storage ? storageDescription : undefined,
        addendumAttached,
        addendumPageCount: addendumAttached ? addendumPageCount : undefined,
        addendumTermCount: addendumAttached ? addendumTermCount : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const portedFromApplication =
    setup.occupantCount != null || setup.hasPets != null || setup.petDetails;

  return (
    <div id="lease-setup">
      <FormSection legend="Lease setup">
        <InlineNotice className={statusNoticeClass(detail.leaseSetupStatus)}>
          <span className="font-medium">{detail.leaseSetupStatusLabel}</span>
          {detail.leaseSetupStatus === "ready_for_rtb1" ? (
            <span className="mt-1 block text-sm">
              All required fields are complete. RTB-1 PDF generation will be available in a future
              release.
            </span>
          ) : detail.leaseSetupStatus === "lease_setup_complete" ? (
            <span className="mt-1 block text-sm">
              Tenancy lease setup is complete. Finish the organization landlord profile under
              Organization settings to become ready for RTB-1 generation.
            </span>
          ) : (
            <span className="mt-1 block text-sm">
              Complete the fields below before RTB-1 generation.
            </span>
          )}
        </InlineNotice>

        {error ? <InlineNotice className="mt-4">{error}</InlineNotice> : null}

        {portedFromApplication ? (
          <div className={`${SURFACE_PANEL} mt-4 px-3.5 py-3 text-sm text-neutral-700`}>
            <p className="font-medium text-neutral-900">From approved application</p>
            {setup.occupantCount != null ? (
              <p className="mt-1">Occupants · {setup.occupantCount}</p>
            ) : null}
            {setup.hasPets != null ? (
              <p className="mt-1">
                Pets · {setup.hasPets ? setup.petDetails || "Yes" : "No pets declared"}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField label="Tenancy type" htmlFor="lease-setup-tenancy-type">
            <select
              id="lease-setup-tenancy-type"
              value={tenancyType}
              onChange={(e) => setTenancyType(e.target.value as TenancyType)}
              disabled={pending}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="month_to_month">Month-to-month</option>
              <option value="fixed_term">Fixed term</option>
            </select>
          </FormField>

          <FormField label="Rent period" htmlFor="lease-setup-rent-period">
            <select
              id="lease-setup-rent-period"
              value={rentPeriod}
              onChange={(e) => setRentPeriod(e.target.value as RentPeriod)}
              disabled={pending}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="day">Day</option>
            </select>
          </FormField>
        </div>

        {tenancyType === "fixed_term" ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FormField label="Fixed-term end date" htmlFor="lease-setup-end-date">
              <input
                id="lease-setup-end-date"
                type="date"
                value={leaseEndDate}
                onChange={(e) => setLeaseEndDate(e.target.value)}
                disabled={pending}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </FormField>
            <FormField label="At end of fixed term" htmlFor="lease-setup-end-behavior">
              <select
                id="lease-setup-end-behavior"
                value={fixedTermEndBehavior}
                onChange={(e) => setFixedTermEndBehavior(e.target.value)}
                disabled={pending}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="">Select…</option>
                <option value="continue">Continue as month-to-month</option>
                <option value="vacate">Tenant must vacate (RTB option E)</option>
              </select>
            </FormField>
          </div>
        ) : null}

        {tenancyType === "fixed_term" && fixedTermEndBehavior === "vacate" ? (
          <div className="mt-4 flex flex-col gap-4">
            <FormField label="Vacate reason" htmlFor="lease-setup-vacate-reason">
              <textarea
                id="lease-setup-vacate-reason"
                rows={3}
                value={vacateReason}
                onChange={(e) => setVacateReason(e.target.value)}
                disabled={pending}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </FormField>
            <FormField label="Applicable RTA section" htmlFor="lease-setup-vacate-section">
              <input
                id="lease-setup-vacate-section"
                type="text"
                value={vacateRtrSection}
                onChange={(e) => setVacateRtrSection(e.target.value)}
                disabled={pending}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </FormField>
            <label className="flex items-start gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={vacateClauseAttested}
                onChange={(e) => setVacateClauseAttested(e.target.checked)}
                disabled={pending}
                className="mt-0.5"
              />
              I confirm this vacate clause complies with the Residential Tenancy Act and is
              applicable to this tenancy.
            </label>
          </div>
        ) : null}

        <div className="mt-6">
          <p className="text-sm font-medium text-neutral-900">Rent & deposits (from tenancy)</p>
          <div className={`${SURFACE_PANEL} mt-2 px-3.5 py-3 text-sm text-neutral-700`}>
            <p>Monthly rent · ${detail.monthlyRent}</p>
            <p className="mt-1">Security deposit · ${detail.securityDeposit}</p>
            <p className="mt-1">Rent due day · {detail.rentDueDay}</p>
            <p className="mt-1">Lease start · {detail.leaseStartDate}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField label="Security deposit due date" htmlFor="lease-setup-security-due">
            <input
              id="lease-setup-security-due"
              type="date"
              value={securityDepositDueDate}
              onChange={(e) => setSecurityDepositDueDate(e.target.value)}
              disabled={pending}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </FormField>
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={petDepositNotApplicable}
                onChange={(e) => setPetDepositNotApplicable(e.target.checked)}
                disabled={pending}
              />
              Pet deposit not applicable
            </label>
            {!petDepositNotApplicable ? (
              <div className="grid gap-4">
                <FormField label="Pet deposit amount" htmlFor="lease-setup-pet-deposit">
                  <input
                    id="lease-setup-pet-deposit"
                    type="number"
                    min={0}
                    step="0.01"
                    value={petDeposit}
                    onChange={(e) => setPetDeposit(e.target.value)}
                    disabled={pending}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </FormField>
                <FormField label="Pet deposit due date" htmlFor="lease-setup-pet-due">
                  <input
                    id="lease-setup-pet-due"
                    type="date"
                    value={petDepositDueDate}
                    onChange={(e) => setPetDepositDueDate(e.target.value)}
                    disabled={pending}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </FormField>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium text-neutral-900">Services included in rent</p>
          <p className="mt-1 text-sm text-neutral-600">
            Check each utility or service the landlord provides as part of the rent.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {RTB_SERVICE_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={servicesIncluded[key]}
                  onChange={() => toggleService(key)}
                  disabled={pending}
                />
                {RTB_SERVICE_LABELS[key]}
              </label>
            ))}
          </div>
        </div>

        {servicesIncluded.parking ? (
          <div className="mt-4">
            <FormField label="Parking details" htmlFor="lease-setup-parking">
              <input
                id="lease-setup-parking"
                type="text"
                value={parkingDescription}
                onChange={(e) => setParkingDescription(e.target.value)}
                disabled={pending}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </FormField>
          </div>
        ) : null}

        {servicesIncluded.storage ? (
          <div className="mt-4">
            <FormField label="Storage details" htmlFor="lease-setup-storage">
              <input
                id="lease-setup-storage"
                type="text"
                value={storageDescription}
                onChange={(e) => setStorageDescription(e.target.value)}
                disabled={pending}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </FormField>
          </div>
        ) : null}

        <div className="mt-6">
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={addendumAttached}
              onChange={(e) => setAddendumAttached(e.target.checked)}
              disabled={pending}
            />
            Additional terms addendum attached
          </label>
          {addendumAttached ? (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <FormField label="Addendum pages" htmlFor="lease-setup-addendum-pages">
                <input
                  id="lease-setup-addendum-pages"
                  type="number"
                  min={1}
                  value={addendumPageCount}
                  onChange={(e) => setAddendumPageCount(e.target.value)}
                  disabled={pending}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </FormField>
              <FormField label="Addendum terms" htmlFor="lease-setup-addendum-terms">
                <input
                  id="lease-setup-addendum-terms"
                  type="number"
                  min={1}
                  value={addendumTermCount}
                  onChange={(e) => setAddendumTermCount(e.target.value)}
                  disabled={pending}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </FormField>
            </div>
          ) : null}
        </div>

        <PrimaryButton
          type="button"
          className="mt-6 !w-auto px-6"
          disabled={pending}
          onClick={onSave}
        >
          {pending ? "Saving…" : "Save lease setup"}
        </PrimaryButton>
      </FormSection>
    </div>
  );
}
