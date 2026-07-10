"use client";

import {
  completeTenantPlacementAction,
  convertApprovedApplicationAction,
  setApplicationReviewAction,
} from "@/app/(dashboard)/leasing/applications/actions";
import {
  FormField,
  FormSection,
  InlineNotice,
  PrimaryButton,
  SURFACE_CARD,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import {
  canConvertApplicationToTenancy,
  formatApplicationDetailStatus,
  formatTenancyStatus,
  isApplicationReviewable,
  type ApplicationStaffDetail,
} from "@/lib/leasing/application-staff-detail";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function formatName(detail: ApplicationStaffDetail) {
  const name = [detail.firstName, detail.lastName].filter(Boolean).join(" ").trim();
  return name || detail.email;
}

function formatSmokerStatus(value: string | null) {
  if (!value) return "—";
  if (value === "non_smoker") return "Non-smoker";
  if (value === "smoker") return "Smoker";
  if (value === "prefer_not_to_say") return "Prefer not to say";
  return value;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-sm text-neutral-700">
      <span className="text-neutral-500">{label} · </span>
      {children}
    </p>
  );
}

export function ApplicationDetail({
  initialDetail,
  loadError,
}: {
  initialDetail: ApplicationStaffDetail | null;
  loadError: string | null;
}) {
  if (loadError || !initialDetail) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="mb-4">
          <Link href="/leasing/applications" className="text-sm font-medium text-neutral-700 underline">
            ← Back to applications
          </Link>
        </p>
        <InlineNotice>{loadError ?? "Application not found."}</InlineNotice>
      </div>
    );
  }

  return <ApplicationDetailBody detail={initialDetail} />;
}

function ApplicationDetailBody({ detail }: { detail: ApplicationStaffDetail }) {
  const router = useRouter();
  const leaseStartDefault = detail.suggestedLeaseStartDate ?? "";
  const moveInDefault = detail.desiredMoveInDate ?? detail.suggestedLeaseStartDate ?? "";
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [convertPending, startConvertTransition] = useTransition();
  const [placementPending, startPlacementTransition] = useTransition();
  const [leaseStartDate, setLeaseStartDate] = useState(leaseStartDefault);
  const [moveInDate, setMoveInDate] = useState(moveInDefault);
  const [leaseEndDate, setLeaseEndDate] = useState("");
  const [moveOutDate, setMoveOutDate] = useState("");
  const [monthlyRent, setMonthlyRent] = useState(detail.suggestedMonthlyRent ?? "");
  const [securityDeposit, setSecurityDeposit] = useState("0");
  const [petDeposit, setPetDeposit] = useState("");
  const [placementLeaseStart, setPlacementLeaseStart] = useState(leaseStartDefault);
  const [placementLeaseEnd, setPlacementLeaseEnd] = useState("");
  const [placementRent, setPlacementRent] = useState(detail.suggestedMonthlyRent ?? "");
  const [landlordHandoffNotes, setLandlordHandoffNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const reviewable = isApplicationReviewable(detail.status);
  const canConvert = canConvertApplicationToTenancy(detail);
  const hasTenancy = detail.tenancyId != null;
  const hasPlacement = detail.placementId != null;
  const canCompletePlacement = detail.canCompletePlacement;
  const needsFinishLeasing = canConvert || canCompletePlacement;
  const beginsManagementOnConvert =
    canConvert && detail.conversionPolicy.transitionPropertyToManaged;
  const displayName = formatName(detail);
  const decided =
    detail.status === "approved" || detail.status === "declined";
  const leaseStartHint =
    detail.suggestedLeaseStartSource === "application"
      ? "Prefilled from applicant desired move-in (editable)."
      : detail.suggestedLeaseStartSource === "listing"
        ? "Prefilled from listing available date (editable)."
        : null;

  function onConvertSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionError(null);
    startConvertTransition(async () => {
      const result = await convertApprovedApplicationAction(detail.id, {
        leaseStartDate,
        moveInDate,
        leaseEndDate: leaseEndDate || undefined,
        moveOutDate: moveOutDate || undefined,
        monthlyRent,
        securityDeposit,
        petDeposit: petDeposit || undefined,
        rentalListingId: detail.rentalListingId || undefined,
      });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onPlacementSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionError(null);
    startPlacementTransition(async () => {
      const result = await completeTenantPlacementAction(detail.id, {
        leaseStartDate: placementLeaseStart,
        leaseEndDate: placementLeaseEnd || undefined,
        monthlyRent: placementRent,
        landlordHandoffNotes: landlordHandoffNotes || undefined,
        internalNotes: internalNotes || undefined,
        rentalListingId: detail.rentalListingId || undefined,
      });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function runReview(status: "under_review" | "approved" | "declined") {
    setActionError(null);
    setPendingAction(status);
    startTransition(async () => {
      const result = await setApplicationReviewAction(detail.id, status);
      setPendingAction(null);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      router.refresh();
      if (status === "approved") {
        window.setTimeout(() => {
          document
            .getElementById("finish-leasing")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-4">
        <Link href="/leasing/applications" className="text-sm font-medium text-neutral-700 underline">
          ← Back to applications
        </Link>
      </p>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">{displayName}</h1>
        <p className="mt-1 text-sm text-neutral-600">Rental application review</p>
      </div>

      {actionError ? <InlineNotice className="mb-4">{actionError}</InlineNotice> : null}

      <div className={`${SURFACE_CARD} mb-6 px-4 py-4`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <span className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium text-neutral-800">
            {formatApplicationDetailStatus(detail.status)}
          </span>
          {detail.submittedAt ? (
            <time className="text-xs text-neutral-500" dateTime={detail.submittedAt}>
              Submitted {formatDateTime(detail.submittedAt)}
            </time>
          ) : null}
        </div>
        {decided && detail.decisionAt ? (
          <p className="mt-3 text-sm text-neutral-600">
            Decision recorded {formatDateTime(detail.decisionAt)}. This application is final.
          </p>
        ) : null}
        {!reviewable && !decided ? (
          <p className="mt-3 text-sm text-neutral-600">
            This application is not in the review queue ({formatApplicationDetailStatus(detail.status)}).
          </p>
        ) : null}
      </div>

      {reviewable ? (
        <div className="mb-8">
        <FormSection legend="Review actions">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <PrimaryButton
              type="button"
              className="!w-auto px-6"
              disabled={isPending}
              onClick={() => runReview("under_review")}
            >
              {isPending && pendingAction === "under_review" ? "Updating…" : "Mark under review"}
            </PrimaryButton>
            <PrimaryButton
              type="button"
              className="!w-auto px-6"
              disabled={isPending}
              onClick={() => runReview("approved")}
            >
              {isPending && pendingAction === "approved" ? "Approving…" : "Approve"}
            </PrimaryButton>
            <PrimaryButton
              type="button"
              className="!w-auto px-6"
              disabled={isPending}
              onClick={() => runReview("declined")}
            >
              {isPending && pendingAction === "declined" ? "Declining…" : "Decline"}
            </PrimaryButton>
          </div>
        </FormSection>
        </div>
      ) : null}

      {hasTenancy ? (
        <div className={`${SURFACE_CARD} mb-8 px-4 py-4`}>
          <h2 className="text-sm font-semibold text-neutral-900">Tenancy created</h2>
          <p className="mt-2 font-mono text-xs text-neutral-600">
            Tenancy ·{" "}
            <Link
              href={`/leasing/tenancies/${detail.tenancyId}`}
              className="font-medium underline"
            >
              {detail.tenancyId}
            </Link>
          </p>
          {detail.tenancyStatus ? (
            <p className="mt-2 text-sm text-neutral-700">
              <span className="text-neutral-500">Status · </span>
              {formatTenancyStatus(detail.tenancyStatus)}
            </p>
          ) : null}
          <p className="mt-3 text-sm text-neutral-600">
            A primary tenant contact was created with portal access enabled. The tenant signs the
            lease through a secure email link before activation. Portal sign-in and Documents work
            after this tenancy is set to <span className="font-medium">Active</span>.
          </p>
        </div>
      ) : null}

      {needsFinishLeasing ? (
        <div
          id="finish-leasing"
          className={`${SURFACE_CARD} mb-8 border border-neutral-900 bg-neutral-50 px-4 py-4`}
        >
          <h2 className="text-sm font-semibold text-neutral-900">Next: finish leasing</h2>
          <p className="mt-2 text-sm text-neutral-700">
            {canCompletePlacement
              ? "This application is approved. Complete tenant placement below to close the engagement."
              : beginsManagementOnConvert
                ? "This application is approved. Create the tenancy below to begin management and close the listing."
                : "This application is approved. Create the tenancy below to finish leasing and close the listing."}
          </p>
        </div>
      ) : null}

      {hasPlacement ? (
        <div className={`${SURFACE_CARD} mb-8 border border-emerald-200 bg-emerald-50/40 px-4 py-4`}>
          <h2 className="text-sm font-semibold text-neutral-900">Placement completed</h2>
          <p className="mt-2 text-sm text-neutral-700">
            This placement-only engagement is complete. No managed tenancy or tenant portal access
            was created. The property remains Tenant Placement Only.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <DetailRow label="Completed">{formatDateTime(detail.placementCompletedAt)}</DetailRow>
            <DetailRow label="Lease start">{formatDate(detail.placementLeaseStartDate)}</DetailRow>
            <DetailRow label="Monthly rent">
              {detail.placementMonthlyRent ? `$${detail.placementMonthlyRent}` : "—"}
            </DetailRow>
            <DetailRow label="Listing closed">
              {detail.placementListingClosed ? "Yes" : "No / already closed / none"}
            </DetailRow>
            {detail.placementLandlordHandoffNotes ? (
              <DetailRow label="Landlord handoff">{detail.placementLandlordHandoffNotes}</DetailRow>
            ) : null}
            {detail.placementInternalNotes ? (
              <DetailRow label="Internal notes">{detail.placementInternalNotes}</DetailRow>
            ) : null}
          </div>
        </div>
      ) : null}

      {canCompletePlacement ? (
        <div className="mb-8">
          <FormSection legend="Complete tenant placement">
            <p className="text-sm text-neutral-700">
              Service relationship · {detail.serviceRelationshipLabel}
            </p>
            <p className="mt-2 text-sm text-neutral-600">
              Completing placement records that the tenant was placed with the landlord. It does{" "}
              <span className="font-medium">not</span> create a managed tenancy, enable tenant portal
              access, or turn on maintenance, notices, inspections, or move-out workflows. The
              property stays Tenant Placement Only. The related rental listing will be closed when
              this succeeds.
            </p>
            {detail.rentalListingHeadline || detail.rentalListingId ? (
              <p className="mt-2 text-sm text-neutral-700">
                Listing · {detail.rentalListingHeadline ?? detail.rentalListingId}
                {detail.rentalListingMonthlyRent
                  ? ` · advertised $${detail.rentalListingMonthlyRent}`
                  : ""}
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-900">
                No listing attribution on this application. If exactly one open listing exists for
                the unit it will close automatically; otherwise you will be asked to choose.
              </p>
            )}
            <form className="mt-4 flex flex-col gap-4" onSubmit={onPlacementSubmit} noValidate>
              <FormField
                label="Lease start date (required)"
                htmlFor="placement-lease-start"
                helper={leaseStartHint ?? undefined}
              >
                <input
                  id="placement-lease-start"
                  type="date"
                  value={placementLeaseStart}
                  onChange={(e) => setPlacementLeaseStart(e.target.value)}
                  required
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                />
              </FormField>
              <FormField label="Lease end date (optional)" htmlFor="placement-lease-end">
                <input
                  id="placement-lease-end"
                  type="date"
                  value={placementLeaseEnd}
                  onChange={(e) => setPlacementLeaseEnd(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                />
              </FormField>
              <FormField
                label="Final monthly rent (required)"
                htmlFor="placement-rent"
                helper={
                  detail.suggestedMonthlyRent
                    ? `From listing $${detail.suggestedMonthlyRent} (editable).`
                    : undefined
                }
              >
                <input
                  id="placement-rent"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={placementRent}
                  onChange={(e) => setPlacementRent(e.target.value)}
                  required
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                />
              </FormField>
              <FormField label="Landlord handoff notes (optional)" htmlFor="placement-handoff">
                <textarea
                  id="placement-handoff"
                  value={landlordHandoffNotes}
                  onChange={(e) => setLandlordHandoffNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                />
              </FormField>
              <FormField label="Internal notes (optional)" htmlFor="placement-notes">
                <textarea
                  id="placement-notes"
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                />
              </FormField>
              <PrimaryButton type="submit" disabled={placementPending} className="!w-auto px-6">
                {placementPending ? "Completing…" : "Complete placement"}
              </PrimaryButton>
            </form>
            <p className="mt-3 text-xs text-neutral-500">
              Managed tenancy conversion remains disabled for this property.
            </p>
          </FormSection>
        </div>
      ) : null}

      {canConvert ? (
        <div className="mb-8" id="finish-leasing-form">
          <FormSection legend="Create tenancy">
            <p className="text-sm text-neutral-600">
              Creates a tenancy in <span className="font-medium">Pending move-in</span> status and a
              primary tenant contact with portal access enabled. The tenant signs via email link;
              portal login works after you mark the tenancy Active.
            </p>
            {beginsManagementOnConvert ? (
              <p className="mt-2 text-sm text-neutral-700">
                This property is <span className="font-medium">Pre-management</span>. Converting
                will begin ongoing management and set the service relationship to{" "}
                <span className="font-medium">Managed</span>.
              </p>
            ) : null}
            {detail.rentalListingHeadline || detail.suggestedMonthlyRent ? (
              <p className="mt-2 text-sm text-neutral-700">
                {detail.rentalListingHeadline
                  ? `Listing · ${detail.rentalListingHeadline}. `
                  : ""}
                {detail.suggestedMonthlyRent
                  ? `Advertised rent $${detail.suggestedMonthlyRent} (prefilled below; adjust if needed).`
                  : "Related listing will close when conversion succeeds."}
              </p>
            ) : (
              <p className="mt-2 text-sm text-neutral-600">
                No listing attribution. If exactly one open listing exists for this unit, it will
                close on successful conversion.
              </p>
            )}
            <form className="mt-4 flex flex-col gap-4" onSubmit={onConvertSubmit} noValidate>
              <FormField
                label="Lease start date (required)"
                htmlFor="lease-start"
                helper={leaseStartHint ?? undefined}
              >
                <input
                  id="lease-start"
                  type="date"
                  value={leaseStartDate}
                  onChange={(e) => setLeaseStartDate(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                  required
                />
              </FormField>
              <FormField
                label="Move-in date (required)"
                htmlFor="move-in"
                helper={
                  detail.desiredMoveInDate
                    ? "Defaults to desired move-in (editable)."
                    : (leaseStartHint ?? undefined)
                }
              >
                <input
                  id="move-in"
                  type="date"
                  value={moveInDate}
                  onChange={(e) => setMoveInDate(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                  required
                />
              </FormField>
              <FormField label="Lease end date (optional)" htmlFor="lease-end">
                <input
                  id="lease-end"
                  type="date"
                  value={leaseEndDate}
                  onChange={(e) => setLeaseEndDate(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                />
              </FormField>
              <FormField label="Anticipated move-out (optional)" htmlFor="move-out">
                <input
                  id="move-out"
                  type="date"
                  value={moveOutDate}
                  onChange={(e) => setMoveOutDate(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                />
              </FormField>
              <FormField
                label="Monthly rent (required)"
                htmlFor="monthly-rent"
                helper={
                  detail.suggestedMonthlyRent
                    ? `From listing $${detail.suggestedMonthlyRent} (editable). Not from applicant income.`
                    : "Enter the lease rent — not from applicant income."
                }
              >
                <input
                  id="monthly-rent"
                  type="number"
                  min={0}
                  step="0.01"
                  value={monthlyRent}
                  onChange={(e) => setMonthlyRent(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                  required
                />
              </FormField>
              <FormField label="Security deposit (required)" htmlFor="security-deposit">
                <input
                  id="security-deposit"
                  type="number"
                  min={0}
                  step="0.01"
                  value={securityDeposit}
                  onChange={(e) => setSecurityDeposit(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                  required
                />
              </FormField>
              {detail.hasPets ? (
                <FormField label="Pet deposit (optional)" htmlFor="pet-deposit">
                  <input
                    id="pet-deposit"
                    type="number"
                    min={0}
                    step="0.01"
                    value={petDeposit}
                    onChange={(e) => setPetDeposit(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                  />
                </FormField>
              ) : null}
              <div className={`${SURFACE_PANEL} px-3.5 py-3 text-sm text-neutral-600`}>
                <p className="font-medium text-neutral-800">Tenant contact (from application)</p>
                <p className="mt-1">
                  {detail.firstName} {detail.lastName} · {detail.email}
                  {detail.phone ? ` · ${detail.phone}` : ""}
                </p>
                <p className="mt-2">Role: Tenant · Portal access: Enabled</p>
              </div>
              <PrimaryButton type="submit" disabled={convertPending} className="!w-auto px-6">
                {convertPending ? "Creating…" : "Create tenancy"}
              </PrimaryButton>
            </form>
          </FormSection>
        </div>
      ) : null}

      <div className="flex flex-col gap-8">
        <FormSection legend="Rental">
          <div className={`${SURFACE_PANEL} flex flex-col gap-2 px-3.5 py-3`}>
            <DetailRow label="Property">{detail.propertyName}</DetailRow>
            <DetailRow label="Unit">{detail.unitLabel}</DetailRow>
            <DetailRow label="Service relationship">{detail.serviceRelationshipLabel}</DetailRow>
            <DetailRow label="Listing">
              {detail.rentalListingHeadline ?? detail.rentalListingId ?? "None (legacy / unattributed)"}
              {detail.rentalListingStatus ? ` · ${detail.rentalListingStatus}` : ""}
            </DetailRow>
          </div>
        </FormSection>

        <FormSection legend="Applicant">
          <div className={`${SURFACE_PANEL} flex flex-col gap-2 px-3.5 py-3`}>
            <DetailRow label="Email">{detail.email}</DetailRow>
            {detail.phone ? <DetailRow label="Phone">{detail.phone}</DetailRow> : null}
            {detail.currentAddress ? (
              <DetailRow label="Current address">{detail.currentAddress}</DetailRow>
            ) : null}
            <DetailRow label="Desired move-in">{formatDate(detail.desiredMoveInDate)}</DetailRow>
            <DetailRow label="Occupants">
              {detail.occupantCount ?? "—"}
            </DetailRow>
            <DetailRow label="Monthly income">
              {detail.monthlyIncome != null ? `$${detail.monthlyIncome}` : "—"}
            </DetailRow>
            <DetailRow label="Smoking">{formatSmokerStatus(detail.smokerStatus)}</DetailRow>
            <DetailRow label="Pets">{detail.hasPets ? "Yes" : "No"}</DetailRow>
            {detail.hasPets && detail.petDetails ? (
              <DetailRow label="Pet details">{detail.petDetails}</DetailRow>
            ) : null}
          </div>
        </FormSection>

        <FormSection legend="Emergency contact">
          <div className={`${SURFACE_PANEL} flex flex-col gap-2 px-3.5 py-3`}>
            <DetailRow label="Name">
              {[detail.emergencyContactFirstName, detail.emergencyContactLastName]
                .filter(Boolean)
                .join(" ") || "—"}
            </DetailRow>
            <DetailRow label="Phone">{detail.emergencyContactPhone ?? "—"}</DetailRow>
            <DetailRow label="Email">{detail.emergencyContactEmail ?? "—"}</DetailRow>
          </div>
        </FormSection>

        <FormSection legend="Employment">
          <div className={`${SURFACE_PANEL} flex flex-col gap-2 px-3.5 py-3`}>
            <DetailRow label="Employer">{detail.employerName ?? "—"}</DetailRow>
            <DetailRow label="Job title">{detail.jobTitle ?? "—"}</DetailRow>
            {detail.employmentNotes ? (
              <DetailRow label="Notes">{detail.employmentNotes}</DetailRow>
            ) : null}
          </div>
        </FormSection>

        <FormSection legend="Consent">
          <div className={`${SURFACE_PANEL} flex flex-col gap-2 px-3.5 py-3`}>
            <DetailRow label="Credit check consent">
              {detail.consentCreditCheck ? "Yes" : "No"}
            </DetailRow>
            <DetailRow label="Signature name">{detail.consentSignatureName ?? "—"}</DetailRow>
            <DetailRow label="Signed at">{formatDateTime(detail.consentSignedAt)}</DetailRow>
          </div>
        </FormSection>

        <FormField label="References" htmlFor="application-refs">
          <div id="application-refs" className={`${SURFACE_PANEL} flex flex-col gap-2 px-3.5 py-3`}>
            <p className="font-mono text-xs text-neutral-600">
              Application · {detail.id}
            </p>
            {detail.prospectId ? (
              <p className="font-mono text-xs text-neutral-600">
                Linked prospect · {detail.prospectId}
              </p>
            ) : (
              <p className="text-sm text-neutral-500">No linked prospect</p>
            )}
          </div>
        </FormField>
      </div>
    </div>
  );
}

