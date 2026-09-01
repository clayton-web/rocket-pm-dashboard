"use client";

import {
  acceptTenantNoticeAction,
  scheduleMoveOutFromNoticeAction,
} from "@/app/(dashboard)/leasing/notices/actions";
import {
  FormField,
  FormSection,
  InlineNotice,
  SURFACE_CARD,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import { Button } from "@/components/portal/button";
import { FOCUS_RING } from "@/components/portal/focus";
import { formControlClasses } from "@/components/portal/form-control";
import { StatusBadge, type StatusTone } from "@/components/portal/status-badge";
import { formatTenancyStatus } from "@/lib/leasing/application-staff-detail";
import type { NoticeStaffDetail } from "@/lib/leasing/notice-staff-detail";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatDate(iso: string) {
  const d = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { dateStyle: "long" });
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-sm text-foreground-muted">
      <span className="text-foreground-subtle">{label} · </span>
      {children}
    </p>
  );
}

/**
 * Notice owns `state -> label + tone`; `StatusBadge` owns the visual treatment. The four states are
 * semantically equivalent to shared tones — a notice awaiting review needs action, one awaiting
 * scheduling is informational, a scheduled move-out is a completed step, and a reviewed notice is
 * the routine baseline.
 */
function statusBadge(detail: NoticeStaffDetail): { label: string; tone: StatusTone } {
  if (detail.canAccept) {
    return { label: "Pending review", tone: "warning" };
  }
  if (detail.canSchedule) {
    return { label: "Awaiting schedule", tone: "info" };
  }
  if (detail.scheduledMoveOutDate) {
    return { label: "Move-out scheduled", tone: "success" };
  }
  return { label: "Reviewed", tone: "neutral" };
}

export function NoticeDetail({
  initialDetail,
  loadError,
}: {
  initialDetail: NoticeStaffDetail | null;
  loadError: string | null;
}) {
  if (loadError || !initialDetail) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="mb-4">
          <Link href="/leasing/notices" className={`text-sm font-medium text-foreground-muted underline ${FOCUS_RING}`}>
            ← Back to notices
          </Link>
        </p>
        <InlineNotice tone="danger">{loadError ?? "Notice not found."}</InlineNotice>
      </div>
    );
  }

  return <NoticeDetailBody detail={initialDetail} />;
}

function NoticeDetailBody({ detail }: { detail: NoticeStaffDetail }) {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const [acceptPending, startAcceptTransition] = useTransition();
  const [schedulePending, startScheduleTransition] = useTransition();
  const [scheduleDate, setScheduleDate] = useState(
    detail.defaultScheduleDate ?? detail.scheduleDateOptions[0]?.value ?? "",
  );
  const [scheduleDateError, setScheduleDateError] = useState<string | null>(null);

  const badge = statusBadge(detail);

  function onAccept() {
    setActionError(null);
    startAcceptTransition(async () => {
      const result = await acceptTenantNoticeAction(detail.id);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onSchedule() {
    setActionError(null);
    setScheduleDateError(null);
    if (!scheduleDate) {
      setScheduleDateError("Please select a scheduled move-out date.");
      return;
    }
    startScheduleTransition(async () => {
      const result = await scheduleMoveOutFromNoticeAction(detail.id, scheduleDate);
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
        <Link href="/leasing/notices" className={`text-sm font-medium text-foreground-muted underline ${FOCUS_RING}`}>
          ← Back to notices
        </Link>
      </p>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">{detail.tenantLabel}</h1>
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
        <StatusBadge tone={badge.tone} emphasis={badge.tone === "neutral" ? "strong" : "soft"}>
          {badge.label}
        </StatusBadge>
        <p className="mt-3 text-sm text-foreground-muted">
          Tenancy status · {formatTenancyStatus(detail.tenancyStatus)}
        </p>
      </div>

      {detail.canAccept ? (
        <div className="mb-8">
          <FormSection legend="Review">
            <p className="text-sm text-foreground-muted">
              Accepting records the notice and updates the tenancy to notice received. You can
              schedule move-out after acceptance.
            </p>
            <Button
              variant="primary"
              size="lg"
              className="mt-4"
              disabled={acceptPending}
              onClick={onAccept}
            >
              {acceptPending ? "Accepting…" : "Accept notice"}
            </Button>
          </FormSection>
        </div>
      ) : null}

      {detail.scheduledMoveOutDate && detail.tenancyStatus === "move_out_scheduled" ? (
        <div className={`${SURFACE_CARD} mb-8 px-4 py-4 text-sm text-foreground-muted`}>
          <p className="font-medium text-foreground">Move-out scheduled</p>
          <p className="mt-2">
            Continue on the tenancy to schedule the move-out inspection and complete offboarding.
          </p>
          <p className="mt-3">
            <Link
              href={`/leasing/tenancies/${detail.tenancyId}#offboarding-summary`}
              className={`font-medium text-foreground underline ${FOCUS_RING}`}
            >
              Open tenancy offboarding →
            </Link>
          </p>
        </div>
      ) : null}

      {detail.canSchedule ? (
        <div className="mb-8">
          <FormSection legend="Schedule move-out">
            <p className="text-sm text-foreground-muted">
              Confirm the scheduled move-out date for this tenancy. This sets the tenancy scheduled
              vacate date and updates status to move-out scheduled.
            </p>
            <FormField
              label="Scheduled move-out date"
              htmlFor="schedule-move-out"
              helper="Defaults to the tenant requested date. Override only when valid for notice rules."
              error={scheduleDateError}
            >
              <select
                id="schedule-move-out"
                value={scheduleDate}
                onChange={(e) => {
                  setScheduleDate(e.target.value);
                  setScheduleDateError(null);
                }}
                aria-invalid={scheduleDateError ? true : undefined}
                aria-describedby={
                  scheduleDateError
                    ? "schedule-move-out-helper schedule-move-out-error"
                    : "schedule-move-out-helper"
                }
                className={formControlClasses({
                  size: "lg",
                  invalid: Boolean(scheduleDateError),
                  className: "mt-2",
                })}
              >
                {detail.scheduleDateOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FormField>
            <Button
              variant="primary"
              size="lg"
              className="mt-4"
              disabled={schedulePending || detail.scheduleDateOptions.length === 0}
              onClick={onSchedule}
            >
              {schedulePending ? "Scheduling…" : "Schedule move-out"}
            </Button>
          </FormSection>
        </div>
      ) : null}

      <div className="flex flex-col gap-8">
        <FormSection legend="Notice">
          <div className={`${SURFACE_PANEL} flex flex-col gap-2 px-3.5 py-3`}>
            <DetailRow label="Submitted">{formatDateTime(detail.submittedAt)}</DetailRow>
            {detail.acceptedAt ? (
              <DetailRow label="Accepted">{formatDateTime(detail.acceptedAt)}</DetailRow>
            ) : null}
            <DetailRow label="Requested move-out date">
              {formatDate(detail.tenantRequestedMoveOutDate)}
            </DetailRow>
            {detail.scheduledMoveOutDate ? (
              <DetailRow label="Scheduled move-out date (tenancy)">
                {formatDate(detail.scheduledMoveOutDate)}
              </DetailRow>
            ) : null}
            <DetailRow label="Title">{detail.title}</DetailRow>
          </div>
        </FormSection>

        <FormSection legend="Tenant message">
          <div className={`${SURFACE_PANEL} px-3.5 py-3 text-sm text-foreground-muted whitespace-pre-wrap`}>
            {detail.body}
          </div>
        </FormSection>

        <FormSection legend="Links">
          <div className={`${SURFACE_PANEL} flex flex-col gap-2 px-3.5 py-3`}>
            {detail.tenantEmail ? (
              <DetailRow label="Email">{detail.tenantEmail}</DetailRow>
            ) : null}
            <DetailRow label="Tenancy">
              <Link
                href={`/leasing/tenancies/${detail.tenancyId}`}
                className={`font-medium underline ${FOCUS_RING}`}
              >
                View tenancy
              </Link>
            </DetailRow>
          </div>
        </FormSection>
      </div>
    </div>
  );
}
