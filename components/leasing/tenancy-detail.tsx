"use client";

import {
  advanceTenancyStatusAction,
  completeMoveOutInspectionAction,
  scheduleMoveOutInspectionAction,
  setTenancyContactPortalAccessAction,
} from "@/app/(dashboard)/leasing/tenancies/actions";
import {
  FormField,
  FormSection,
  InlineNotice,
  PrimaryButton,
  SURFACE_CARD,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import { OffboardingSummary } from "@/components/leasing/offboarding-summary";
import { LeaseSetupSection } from "@/components/leasing/lease-setup-section";
import { OnboardingSummary } from "@/components/leasing/onboarding-summary";
import {
  formatTenancyStatus,
  type TenancyStaffDetail,
} from "@/lib/leasing/tenancy-staff-detail";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatContactType(type: string) {
  if (type === "co_tenant") return "Co-tenant";
  if (type === "emergency_contact") return "Emergency contact";
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-sm text-neutral-700">
      <span className="text-neutral-500">{label} · </span>
      {children}
    </p>
  );
}

export function TenancyDetail({
  initialDetail,
  loadError,
}: {
  initialDetail: TenancyStaffDetail | null;
  loadError: string | null;
}) {
  if (loadError || !initialDetail) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="mb-4">
          <Link href="/leasing/tenancies" className="text-sm font-medium text-neutral-700 underline">
            ← Back to tenancies
          </Link>
        </p>
        <InlineNotice>{loadError ?? "Tenancy not found."}</InlineNotice>
      </div>
    );
  }

  return <TenancyDetailBody detail={initialDetail} />;
}

function TenancyDetailBody({ detail }: { detail: TenancyStaffDetail }) {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusPending, startStatusTransition] = useTransition();
  const [contactPendingId, setContactPendingId] = useState<string | null>(null);
  const [contactPending, startContactTransition] = useTransition();
  const [schedulePending, startScheduleTransition] = useTransition();
  const [completePending, startCompleteTransition] = useTransition();
  const [inspectionDate, setInspectionDate] = useState(
    detail.defaultInspectionDate ?? detail.inspectionDate ?? "",
  );
  const [scheduleNotes, setScheduleNotes] = useState(detail.inspectionNotes ?? "");
  const [completeReportUrl, setCompleteReportUrl] = useState(detail.inspectionReportUrl ?? "");
  const [completeNotes, setCompleteNotes] = useState(detail.inspectionNotes ?? "");

  const primaryContact =
    detail.contacts.find((c) => c.contactType === "tenant") ?? detail.contacts[0];
  const tenantName = primaryContact
    ? [primaryContact.firstName, primaryContact.lastName].filter(Boolean).join(" ").trim() ||
      primaryContact.email
    : "Tenancy";

  function onAdvanceStatus() {
    setActionError(null);
    startStatusTransition(async () => {
      const result = await advanceTenancyStatusAction(detail.id);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onScheduleInspection() {
    setActionError(null);
    if (!inspectionDate) {
      setActionError("Please enter an inspection date.");
      return;
    }
    startScheduleTransition(async () => {
      const result = await scheduleMoveOutInspectionAction(
        detail.id,
        inspectionDate,
        scheduleNotes,
      );
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onCompleteInspection() {
    setActionError(null);
    if (!inspectionDate) {
      setActionError("Please enter an inspection date.");
      return;
    }
    startCompleteTransition(async () => {
      const result = await completeMoveOutInspectionAction(
        detail.id,
        inspectionDate,
        completeReportUrl,
        completeNotes,
      );
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onTogglePortal(contactId: string, enabled: boolean) {
    setActionError(null);
    setContactPendingId(contactId);
    startContactTransition(async () => {
      const result = await setTenancyContactPortalAccessAction(contactId, enabled);
      setContactPendingId(null);
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
        <Link href="/leasing/tenancies" className="text-sm font-medium text-neutral-700 underline">
          ← Back to tenancies
        </Link>
      </p>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">{tenantName}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {detail.propertyName} · {detail.unitLabel}
        </p>
      </div>

      {actionError ? <InlineNotice className="mb-4">{actionError}</InlineNotice> : null}

      <div className={`${SURFACE_CARD} mb-6 px-4 py-4`}>
        <span className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium text-neutral-800">
          {formatTenancyStatus(detail.status)}
        </span>
        {detail.archivedAt ? (
          <p className="mt-3 text-sm text-neutral-600">
            Archived {formatDateTime(detail.archivedAt)}
          </p>
        ) : null}
      </div>

      {detail.showOnboardingSummary ? (
        <OnboardingSummary
          steps={detail.onboardingSteps}
          nextStep={detail.onboardingNextStep}
          moveInDate={detail.moveInDate}
          leaseStartDate={detail.leaseStartDate}
          portalAccessEnabled={detail.primaryPortalAccessEnabled}
        />
      ) : null}

      {detail.showOffboardingSummary ? (
        <OffboardingSummary
          steps={detail.offboardingSteps}
          nextStep={detail.offboardingNextStep}
          requestedMoveOutDate={detail.requestedMoveOutDate}
          scheduledMoveOutDate={detail.moveOutDate}
          inspectionDate={detail.inspectionDate}
          inspectionReportUrl={detail.inspectionReportUrl}
          inspectionNotes={detail.inspectionNotes}
          acceptedNoticeId={detail.acceptedNoticeId}
          missingAcceptedNotice={detail.missingAcceptedNotice}
        />
      ) : null}

      {detail.status !== "ended" && detail.status !== "archived" ? (
        <div className="mb-8">
          <LeaseSetupSection detail={detail} />
        </div>
      ) : null}

      {detail.canScheduleInspection ? (
        <div className="mb-8" id="offboarding-schedule-inspection">
          <FormSection legend="Schedule move-out inspection">
            <p className="text-sm text-neutral-600">
              Record the inspection date and move this tenancy to inspection scheduled. Completion
              can happen with a third party, manually, or via a report link later.
            </p>
            <div className="mt-4">
              <FormField label="Inspection date" htmlFor="inspection-date-schedule">
                <input
                  id="inspection-date-schedule"
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  className="w-full max-w-xs rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </FormField>
            </div>
            <div className="mt-4">
              <FormField label="Notes (optional)" htmlFor="inspection-notes-schedule">
              <textarea
                id="inspection-notes-schedule"
                rows={3}
                value={scheduleNotes}
                onChange={(e) => setScheduleNotes(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
              </FormField>
            </div>
            <PrimaryButton
              type="button"
              className="mt-4 !w-auto px-6"
              disabled={schedulePending}
              onClick={onScheduleInspection}
            >
              {schedulePending ? "Scheduling…" : "Schedule inspection"}
            </PrimaryButton>
          </FormSection>
        </div>
      ) : null}

      {detail.canCompleteInspection ? (
        <div className="mb-8" id="offboarding-complete-inspection">
          <FormSection legend="Complete move-out inspection">
            <p className="text-sm text-neutral-600">
              Confirm the inspection is done and optionally attach a report URL or notes.
            </p>
            <div className="mt-4">
              <FormField label="Inspection date" htmlFor="inspection-date-complete">
                <input
                  id="inspection-date-complete"
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  className="w-full max-w-xs rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </FormField>
            </div>
            <div className="mt-4">
              <FormField
                label="Report URL (optional)"
                htmlFor="inspection-report-url"
                helper="Link to an external report (vendor portal, cloud storage, etc.)."
              >
                <input
                  id="inspection-report-url"
                  type="url"
                  value={completeReportUrl}
                  onChange={(e) => setCompleteReportUrl(e.target.value)}
                  placeholder="https://"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </FormField>
            </div>
            <div className="mt-4">
              <FormField label="Notes (optional)" htmlFor="inspection-notes-complete">
                <textarea
                  id="inspection-notes-complete"
                  rows={3}
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </FormField>
            </div>
            <PrimaryButton
              type="button"
              className="mt-4 !w-auto px-6"
              disabled={completePending}
              onClick={onCompleteInspection}
            >
              {completePending ? "Completing…" : "Complete inspection"}
            </PrimaryButton>
          </FormSection>
        </div>
      ) : null}

      {detail.advanceStatusLabel && detail.nextStatus ? (
        <div
          className="mb-8"
          id={detail.showOnboardingSummary ? "onboarding-lifecycle" : "offboarding-lifecycle"}
        >
          <FormSection legend="Lifecycle">
            <PrimaryButton
              type="button"
              className="!w-auto px-6"
              disabled={statusPending}
              onClick={onAdvanceStatus}
            >
              {statusPending ? "Updating…" : detail.advanceStatusLabel}
            </PrimaryButton>
            {detail.nextStatus === "active" ? (
              <p className="mt-3 text-sm text-neutral-600">
                Marking active allows tenant portal sign-in when portal access is enabled on a
                contact (see below). Onboarding is not automated yet — confirm lease paperwork and
                move-in prep offline before activating.
              </p>
            ) : null}
            {detail.status === "inspection_completed" && detail.nextStatus === "ended" ? (
              <p className="mt-3 text-sm text-neutral-600">
                Mark ended when the tenant has vacated and the move-out inspection is recorded. This
                does not process deposits or close financials.
              </p>
            ) : null}
            {detail.status === "ended" && detail.nextStatus === "archived" ? (
              <p className="mt-3 text-sm text-neutral-600">
                Archive when this tenancy record is fully closed in your process and no further staff
                actions are needed. Archived tenancies remain searchable; portal access rules still
                apply to contacts.
              </p>
            ) : null}
          </FormSection>
        </div>
      ) : null}

      <div className="flex flex-col gap-8">
        <FormSection legend="Lease">
          <div className={`${SURFACE_PANEL} flex flex-col gap-2 px-3.5 py-3`}>
            <DetailRow label="Application">
              <Link
                href={`/leasing/applications/${detail.applicationId}`}
                className="font-medium underline"
              >
                {detail.applicationId}
              </Link>
            </DetailRow>
            <DetailRow label="Lease start">{formatDate(detail.leaseStartDate)}</DetailRow>
            <DetailRow label="Lease end">{formatDate(detail.leaseEndDate)}</DetailRow>
            <DetailRow label="Move-in">{formatDate(detail.moveInDate)}</DetailRow>
            <DetailRow label="Scheduled move-out">{formatDate(detail.moveOutDate)}</DetailRow>
            {detail.requestedMoveOutDate ? (
              <DetailRow label="Requested move-out (notice)">
                {formatDate(detail.requestedMoveOutDate)}
                {detail.acceptedNoticeId ? (
                  <>
                    {" "}
                    ·{" "}
                    <Link
                      href={`/leasing/notices/${detail.acceptedNoticeId}`}
                      className="font-medium underline"
                    >
                      View notice
                    </Link>
                  </>
                ) : null}
              </DetailRow>
            ) : null}
            <DetailRow label="Monthly rent">${detail.monthlyRent}</DetailRow>
            <DetailRow label="Security deposit">${detail.securityDeposit}</DetailRow>
            <DetailRow label="Pet deposit">
              {detail.petDeposit != null ? `$${detail.petDeposit}` : "—"}
            </DetailRow>
          </div>
        </FormSection>

        <FormSection legend="Contacts & portal access">
          <div id="onboarding-contacts">
          <p className="text-sm text-neutral-600">
            Tenant portal sign-in requires portal access to be enabled on the contact, the tenancy
            status to be <span className="font-medium">Active</span>, and the tenant to use the same
            email address stored on this contact.
          </p>
          {detail.contacts.length === 0 ? (
            <InlineNotice className="mt-3">No contacts on this tenancy.</InlineNotice>
          ) : (
            <ul className="mt-3 flex list-none flex-col gap-3 p-0">
              {detail.contacts.map((contact) => {
                const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
                const toggling = contactPending && contactPendingId === contact.id;
                return (
                  <li key={contact.id} className={`${SURFACE_CARD} px-4 py-4`}>
                    <p className="text-sm font-semibold text-neutral-900">{name || contact.email}</p>
                    <p className="mt-1 text-sm text-neutral-600">{contact.email}</p>
                    {contact.phone ? (
                      <p className="mt-1 text-sm text-neutral-600">{contact.phone}</p>
                    ) : null}
                    <p className="mt-2 text-sm text-neutral-600">
                      <span className="text-neutral-500">Role · </span>
                      {formatContactType(contact.contactType)}
                    </p>
                    <p className="mt-2 text-sm text-neutral-700">
                      <span className="text-neutral-500">Portal access · </span>
                      {contact.portalAccessEnabled ? "Enabled" : "Disabled"}
                    </p>
                    {contact.portalAccessEnabled && detail.status !== "active" ? (
                      <p className="mt-2 text-sm text-neutral-600">
                        Login will not work until this tenancy is Active.
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {contact.portalAccessEnabled ? (
                        <PrimaryButton
                          type="button"
                          className="!w-auto px-4 text-sm"
                          disabled={toggling}
                          onClick={() => onTogglePortal(contact.id, false)}
                        >
                          {toggling ? "Updating…" : "Disable portal access"}
                        </PrimaryButton>
                      ) : (
                        <PrimaryButton
                          type="button"
                          className="!w-auto px-4 text-sm"
                          disabled={toggling}
                          onClick={() => onTogglePortal(contact.id, true)}
                        >
                          {toggling ? "Updating…" : "Enable portal access"}
                        </PrimaryButton>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          </div>
        </FormSection>

        <FormField label="Reference" htmlFor="tenancy-ref">
          <p id="tenancy-ref" className="font-mono text-xs text-neutral-600">
            Tenancy · {detail.id}
          </p>
        </FormField>
      </div>
    </div>
  );
}
