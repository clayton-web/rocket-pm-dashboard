"use client";

import {
  advanceTenancyStatusAction,
  completeMoveOutInspectionAction,
  scheduleMoveOutInspectionAction,
  setTenancyContactPortalAccessAction,
} from "@/app/(dashboard)/leasing/tenancies/actions";
import { Button } from "@/components/portal/button";
import { FOCUS_RING } from "@/components/portal/focus";
import { formControlClasses } from "@/components/portal/form-control";
import { statusBadgeClasses } from "@/components/portal/status-badge";
import {
  FormField,
  FormSection,
  InlineNotice,
  SURFACE_CARD,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import { OffboardingSummary } from "@/components/leasing/offboarding-summary";
import { LeaseSetupSection } from "@/components/leasing/lease-setup-section";
import { Rtb1DraftSection } from "@/components/leasing/rtb1-draft-section";
import { LeaseSigningSection } from "@/components/leasing/lease-signing-section";
import { TenancyEditSection } from "@/components/leasing/tenancy-edit-section";
import { OnboardingSummary } from "@/components/leasing/onboarding-summary";
import { formatTenancyStatus } from "@/lib/leasing/application-staff-detail";
import type { TenancyStaffDetail } from "@/lib/leasing/tenancy-staff-detail-types";
import type { HealthCleanupContext } from "@/lib/property/portfolio-health-return";
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
    <p className="text-sm text-foreground-muted">
      <span className="text-foreground-subtle">{label} · </span>
      {children}
    </p>
  );
}

export function TenancyDetail({
  initialDetail,
  loadError,
  healthCleanupContext = null,
}: {
  initialDetail: TenancyStaffDetail | null;
  loadError: string | null;
  healthCleanupContext?: HealthCleanupContext | null;
}) {
  if (loadError || !initialDetail) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="mb-4">
          <Link href="/leasing/tenancies" className={`text-sm font-medium text-foreground-muted underline ${FOCUS_RING}`}>
            ← Back to tenancies
          </Link>
        </p>
        <InlineNotice tone="danger">{loadError ?? "Tenancy not found."}</InlineNotice>
      </div>
    );
  }

  return <TenancyDetailBody detail={initialDetail} healthCleanupContext={healthCleanupContext} />;
}

function TenancyDetailBody({
  detail,
  healthCleanupContext = null,
}: {
  detail: TenancyStaffDetail;
  healthCleanupContext?: HealthCleanupContext | null;
}) {
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
  const [inspectionDateError, setInspectionDateError] = useState<string | null>(null);
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
    setInspectionDateError(null);
    if (!inspectionDate) {
      setInspectionDateError("Please enter an inspection date.");
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
    setInspectionDateError(null);
    if (!inspectionDate) {
      setInspectionDateError("Please enter an inspection date.");
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
        <Link href="/leasing/tenancies" className={`text-sm font-medium text-foreground-muted underline ${FOCUS_RING}`}>
          ← Back to tenancies
        </Link>
      </p>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">{tenantName}</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {detail.propertyName} · {detail.unitLabel}
        </p>
      </div>

      {actionError ? (
        <InlineNotice className="mb-4" tone="danger" role="alert">
          {actionError}
        </InlineNotice>
      ) : null}

      <div className={`${SURFACE_CARD} mb-6 px-4 py-4`}>
        <span className={statusBadgeClasses("neutral", "strong")}>
          {formatTenancyStatus(detail.status)}
        </span>
        {detail.showOnboardingSummary && detail.onboardingNextStep.kind !== "none" ? (
          <p className="mt-3 text-sm text-foreground-muted">
            <span className="text-foreground-subtle">Onboarding · </span>
            {detail.onboardingNextStep.title}
          </p>
        ) : null}
        {detail.archivedAt ? (
          <p className="mt-3 text-sm text-foreground-muted">
            Archived {formatDateTime(detail.archivedAt)}
          </p>
        ) : null}
      </div>

      <TenancyEditSection detail={detail} healthCleanupContext={healthCleanupContext} />

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
        <div className="mb-8 flex flex-col gap-8">
          <LeaseSetupSection detail={detail} />
          <Rtb1DraftSection detail={detail} />
          <LeaseSigningSection detail={detail} />
        </div>
      ) : null}

      {detail.canScheduleInspection ? (
        <div className="mb-8" id="offboarding-schedule-inspection">
          <FormSection legend="Schedule move-out inspection">
            <p className="text-sm text-foreground-muted">
              Record the inspection date and move this tenancy to inspection scheduled. Completion
              can happen with a third party, manually, or via a report link later.
            </p>
            <div className="mt-4">
              <FormField
                label="Inspection date"
                htmlFor="inspection-date-schedule"
                error={inspectionDateError}
              >
                <input
                  id="inspection-date-schedule"
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => {
                    setInspectionDate(e.target.value);
                    setInspectionDateError(null);
                  }}
                  aria-invalid={inspectionDateError ? true : undefined}
                  aria-describedby={
                    inspectionDateError ? "inspection-date-schedule-error" : undefined
                  }
                  className={formControlClasses({
                    invalid: Boolean(inspectionDateError),
                    className: "max-w-xs",
                  })}
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
                className={formControlClasses()}
              />
              </FormField>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="mt-4"
              disabled={schedulePending}
              onClick={onScheduleInspection}
            >
              {schedulePending ? "Scheduling…" : "Schedule inspection"}
            </Button>
          </FormSection>
        </div>
      ) : null}

      {detail.canCompleteInspection ? (
        <div className="mb-8" id="offboarding-complete-inspection">
          <FormSection legend="Complete move-out inspection">
            <p className="text-sm text-foreground-muted">
              Confirm the inspection is done and optionally attach a report URL or notes.
            </p>
            <div className="mt-4">
              <FormField
                label="Inspection date"
                htmlFor="inspection-date-complete"
                error={inspectionDateError}
              >
                <input
                  id="inspection-date-complete"
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => {
                    setInspectionDate(e.target.value);
                    setInspectionDateError(null);
                  }}
                  aria-invalid={inspectionDateError ? true : undefined}
                  aria-describedby={
                    inspectionDateError ? "inspection-date-complete-error" : undefined
                  }
                  className={formControlClasses({
                    invalid: Boolean(inspectionDateError),
                    className: "max-w-xs",
                  })}
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
                  className={formControlClasses()}
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
                  className={formControlClasses()}
                />
              </FormField>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="mt-4"
              disabled={completePending}
              onClick={onCompleteInspection}
            >
              {completePending ? "Completing…" : "Complete inspection"}
            </Button>
          </FormSection>
        </div>
      ) : null}

      {detail.advanceStatusLabel && detail.nextStatus ? (
        <div
          className="mb-8"
          id={detail.showOnboardingSummary ? "onboarding-lifecycle" : "offboarding-lifecycle"}
        >
          <FormSection legend="Lifecycle">
            {detail.nextStatus === "active" ? (
              <div className={`${SURFACE_PANEL} mb-4 flex flex-col gap-2 px-3.5 py-3 text-sm text-foreground-muted`}>
                <p>
                  <span className="text-foreground-subtle">Activation readiness · </span>
                  {detail.activationReadiness.ready ? (
                    <span className="font-medium text-success-foreground">Ready</span>
                  ) : (
                    <span className="font-medium text-warning-foreground">Blocked</span>
                  )}
                </p>
                <p>
                  <span className="text-foreground-subtle">Executed lease · </span>
                  {detail.leaseSigning.executedDocumentId ? (
                    <span className="font-medium text-foreground">On file</span>
                  ) : (
                    <span className="text-foreground-muted">Not yet executed</span>
                  )}
                </p>
                {!detail.activationReadiness.ready ? (
                  <InlineNotice className="mt-1" tone="warning">
                    {detail.activationReadiness.reason}
                  </InlineNotice>
                ) : null}
              </div>
            ) : null}
            <Button
              variant="primary"
              size="lg"
              disabled={
                statusPending ||
                (detail.nextStatus === "active" && !detail.activationReadiness.ready)
              }
              onClick={onAdvanceStatus}
            >
              {statusPending ? "Updating…" : detail.advanceStatusLabel}
            </Button>
            {detail.nextStatus === "active" ? (
              <p className="mt-3 text-sm text-foreground-muted">
                Marking active unlocks tenant portal sign-in when portal access is enabled on a
                contact. Tenants sign the lease through the email link before activation; after
                activation they can sign in and view their executed agreement under Documents.
              </p>
            ) : null}
            {detail.status === "inspection_completed" && detail.nextStatus === "ended" ? (
              <p className="mt-3 text-sm text-foreground-muted">
                Mark ended when the tenant has vacated and the move-out inspection is recorded. This
                does not process deposits or close financials.
              </p>
            ) : null}
            {detail.status === "ended" && detail.nextStatus === "archived" ? (
              <p className="mt-3 text-sm text-foreground-muted">
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
                className={`font-medium underline ${FOCUS_RING}`}
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
                      className={`font-medium underline ${FOCUS_RING}`}
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
          <p className="text-sm text-foreground-muted">
            Tenant portal sign-in requires portal access to be enabled on the contact, the tenancy
            status to be <span className="font-medium">Active</span>, and the tenant to use the same
            email address stored on this contact. Lease signing before activation uses the email
            signing link, not portal login.
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
                    <p className="text-sm font-semibold text-foreground">{name || contact.email}</p>
                    <p className="mt-1 text-sm text-foreground-muted">{contact.email}</p>
                    {contact.phone ? (
                      <p className="mt-1 text-sm text-foreground-muted">{contact.phone}</p>
                    ) : null}
                    <p className="mt-2 text-sm text-foreground-muted">
                      <span className="text-foreground-subtle">Role · </span>
                      {formatContactType(contact.contactType)}
                    </p>
                    <p className="mt-2 text-sm text-foreground-muted">
                      <span className="text-foreground-subtle">Portal access · </span>
                      {contact.portalAccessEnabled ? "Enabled" : "Disabled"}
                    </p>
                    {contact.portalAccessEnabled && detail.status !== "active" ? (
                      <p className="mt-2 text-sm text-foreground-muted">
                        Login will not work until this tenancy is Active.
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {contact.portalAccessEnabled ? (
                        <Button
                          variant="primary"
                          size="lg"
                          disabled={toggling}
                          onClick={() => onTogglePortal(contact.id, false)}
                        >
                          {toggling ? "Updating…" : "Disable portal access"}
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="lg"
                          disabled={toggling}
                          onClick={() => onTogglePortal(contact.id, true)}
                        >
                          {toggling ? "Updating…" : "Enable portal access"}
                        </Button>
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
          <p id="tenancy-ref" className="font-mono text-xs text-foreground-muted">
            Tenancy · {detail.id}
          </p>
        </FormField>
      </div>
    </div>
  );
}
