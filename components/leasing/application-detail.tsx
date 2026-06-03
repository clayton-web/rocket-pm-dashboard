"use client";

import {
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
  const moveInDefault = detail.desiredMoveInDate ?? "";
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [convertPending, startConvertTransition] = useTransition();
  const [leaseStartDate, setLeaseStartDate] = useState(moveInDefault);
  const [moveInDate, setMoveInDate] = useState(moveInDefault);
  const [leaseEndDate, setLeaseEndDate] = useState("");
  const [moveOutDate, setMoveOutDate] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [securityDeposit, setSecurityDeposit] = useState("0");
  const [petDeposit, setPetDeposit] = useState("");

  const reviewable = isApplicationReviewable(detail.status);
  const canConvert = canConvertApplicationToTenancy(detail);
  const hasTenancy = detail.tenancyId != null;
  const displayName = formatName(detail);
  const decided =
    detail.status === "approved" || detail.status === "declined";

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
          <p className="mt-2 font-mono text-xs text-neutral-600">Tenancy · {detail.tenancyId}</p>
          {detail.tenancyStatus ? (
            <p className="mt-2 text-sm text-neutral-700">
              <span className="text-neutral-500">Status · </span>
              {formatTenancyStatus(detail.tenancyStatus)}
            </p>
          ) : null}
          <p className="mt-3 text-sm text-neutral-600">
            A primary tenant contact was created with portal access enabled. The tenant cannot sign in
            until this tenancy is set to <span className="font-medium">Active</span> (not available in
            this release).
          </p>
        </div>
      ) : null}

      {canConvert ? (
        <div className="mb-8">
          <FormSection legend="Create tenancy">
            <p className="text-sm text-neutral-600">
              Creates a tenancy in <span className="font-medium">Pending move-in</span> status and a
              primary tenant contact with portal access enabled. Tenant login will not work until the
              tenancy is later set to Active outside this screen.
            </p>
            <form className="mt-4 flex flex-col gap-4" onSubmit={onConvertSubmit} noValidate>
              <FormField label="Lease start date (required)" htmlFor="lease-start">
                <input
                  id="lease-start"
                  type="date"
                  value={leaseStartDate}
                  onChange={(e) => setLeaseStartDate(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm"
                  required
                />
              </FormField>
              <FormField label="Move-in date (required)" htmlFor="move-in">
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
              <FormField label="Move-out date (optional)" htmlFor="move-out">
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
                helper="Enter the lease rent — not prefilled from applicant income."
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

