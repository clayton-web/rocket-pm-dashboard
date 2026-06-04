"use client";

import { archiveProspectAction } from "@/app/(dashboard)/leasing/prospects/actions";
import { scheduleShowingAction } from "@/app/(dashboard)/leasing/prospects/[prospectId]/actions";
import {
  FormField,
  FormSection,
  InlineNotice,
  PrimaryButton,
  SURFACE_CARD,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import { ApplicationPortalHandoffPanel } from "@/components/leasing/application-portal-handoff";
import type { ProspectStaffDetail } from "@/lib/leasing/prospect-staff-detail";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

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

function formatName(detail: ProspectStaffDetail) {
  const name = [detail.firstName, detail.lastName].filter(Boolean).join(" ").trim();
  return name || detail.email;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-sm text-neutral-700">
      <span className="text-neutral-500">{label} · </span>
      {children}
    </p>
  );
}

export function ProspectDetail({
  initialDetail,
  loadError,
}: {
  initialDetail: ProspectStaffDetail | null;
  loadError: string | null;
}) {
  if (loadError || !initialDetail) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="mb-4">
          <Link href="/leasing/prospects" className="text-sm font-medium text-neutral-700 underline">
            ← Back to viewing requests
          </Link>
        </p>
        <InlineNotice>{loadError ?? "Prospect not found."}</InlineNotice>
      </div>
    );
  }

  return <ProspectDetailBody detail={initialDetail} />;
}

function ProspectDetailBody({ detail }: { detail: ProspectStaffDetail }) {
  const router = useRouter();
  const scheduledStartId = useId();
  const scheduledEndId = useId();
  const assignedToId = useId();
  const notesId = useId();

  const [actionError, setActionError] = useState<string | null>(null);
  const [schedulePending, startScheduleTransition] = useTransition();
  const [archivePending, startArchiveTransition] = useTransition();
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");

  function onSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);
    startScheduleTransition(async () => {
      const result = await scheduleShowingAction(detail.id, {
        scheduledStart,
        scheduledEnd: scheduledEnd || undefined,
        assignedToUserId: assignedToUserId || undefined,
        notes: scheduleNotes || undefined,
      });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      router.push(`/leasing/showings/${result.showingId}`);
    });
  }

  function onArchive() {
    setActionError(null);
    startArchiveTransition(async () => {
      const result = await archiveProspectAction(detail.id);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      router.push("/leasing/prospects");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-4">
        <Link href="/leasing/prospects" className="text-sm font-medium text-neutral-700 underline">
          ← Back to viewing requests
        </Link>
      </p>

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-neutral-900">{formatName(detail)}</h1>
          <span className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium text-neutral-800">
            {detail.statusLabel}
          </span>
        </div>
        <p className="mt-1 text-sm text-neutral-600">{detail.propertyName}</p>
        <p className="mt-1 font-mono text-xs text-neutral-500">Ref · {detail.id}</p>
      </div>

      {actionError ? <InlineNotice className="mb-4">{actionError}</InlineNotice> : null}

      <div className="flex flex-col gap-8">
        <FormSection legend="Intake summary">
          <div className={`${SURFACE_PANEL} space-y-2 px-3.5 py-3`}>
            <DetailRow label="Submitted">{formatDateTime(detail.createdAt)}</DetailRow>
            <DetailRow label="Property">{detail.propertyName}</DetailRow>
            <DetailRow label="Unit">{detail.unitLabel ?? "No specific unit selected"}</DetailRow>
            <DetailRow label="Email">{detail.email}</DetailRow>
            <DetailRow label="Phone">{detail.phone ?? "—"}</DetailRow>
            <DetailRow label="Occupants">
              {detail.occupantCount != null ? detail.occupantCount : "—"}
            </DetailRow>
            <DetailRow label="Pets">
              {detail.hasPets
                ? detail.petDetails
                  ? `Yes · ${detail.petDetails}`
                  : "Yes"
                : "No"}
            </DetailRow>
            <DetailRow label="Smoking">{detail.smokerStatusLabel ?? "—"}</DetailRow>
            <DetailRow label="Income range">{detail.householdIncomeRangeLabel ?? "—"}</DetailRow>
            <DetailRow label="Desired move-in">{formatDate(detail.desiredMoveInDate)}</DetailRow>
            <DetailRow label="Preferred viewing">
              {detail.preferredViewingNotes ?? "—"}
            </DetailRow>
            <DetailRow label="Message">{detail.message ?? "—"}</DetailRow>
          </div>
        </FormSection>

        {detail.canSchedule ? (
          <FormSection legend="Schedule showing">
            <form onSubmit={onSchedule} className="flex flex-col gap-4">
              <FormField label="Scheduled start" htmlFor={scheduledStartId}>
                <input
                  id={scheduledStartId}
                  type="datetime-local"
                  required
                  value={scheduledStart}
                  onChange={(e) => setScheduledStart(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </FormField>
              <FormField label="Scheduled end (optional)" htmlFor={scheduledEndId}>
                <input
                  id={scheduledEndId}
                  type="datetime-local"
                  value={scheduledEnd}
                  onChange={(e) => setScheduledEnd(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </FormField>
              <FormField label="Assigned staff (optional)" htmlFor={assignedToId}>
                <select
                  id={assignedToId}
                  value={assignedToUserId}
                  onChange={(e) => setAssignedToUserId(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  {detail.assignableStaff.map((staff) => (
                    <option key={staff.userId} value={staff.userId}>
                      {staff.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Notes (optional)" htmlFor={notesId}>
                <textarea
                  id={notesId}
                  rows={3}
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </FormField>
              <PrimaryButton type="submit" className="!w-auto px-6" disabled={schedulePending}>
                {schedulePending ? "Scheduling…" : "Schedule showing"}
              </PrimaryButton>
            </form>
          </FormSection>
        ) : (
          <InlineNotice>This prospect is archived. Schedule a new showing after restoring intake if needed.</InlineNotice>
        )}

        <FormSection legend="Showing history">
          {detail.showings.length === 0 ? (
            <InlineNotice>No showings scheduled yet.</InlineNotice>
          ) : (
            <ul className="flex list-none flex-col gap-3 p-0">
              {detail.showings.map((showing) => (
                <li key={showing.id}>
                  <Link href={showing.href} className={`block ${SURFACE_CARD} px-4 py-4 no-underline`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-neutral-900">
                        {formatDateTime(showing.scheduledStart)}
                      </span>
                      <span className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium text-neutral-800">
                        {showing.statusLabel}
                      </span>
                    </div>
                    {showing.outcomeLabel ? (
                      <p className="mt-2 text-sm text-neutral-600">
                        <span className="text-neutral-500">Outcome · </span>
                        {showing.outcomeLabel}
                      </p>
                    ) : null}
                    {showing.assignedToLabel ? (
                      <p className="mt-1 text-sm text-neutral-600">
                        <span className="text-neutral-500">Assigned · </span>
                        {showing.assignedToLabel}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </FormSection>

        <FormSection legend="Linked applications">
          {detail.linkedApplications.length === 0 ? (
            <InlineNotice>No linked applications yet.</InlineNotice>
          ) : (
            <ul className="flex list-none flex-col gap-3 p-0">
              {detail.linkedApplications.map((app) => (
                <li key={app.id}>
                  <Link href={app.href} className={`block ${SURFACE_CARD} px-4 py-4 no-underline`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-neutral-900">Application</span>
                      <span className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium text-neutral-800">
                        {app.statusLabel}
                      </span>
                    </div>
                    {app.submittedAt ? (
                      <p className="mt-2 text-sm text-neutral-600">
                        <span className="text-neutral-500">Submitted · </span>
                        {formatDateTime(app.submittedAt)}
                      </p>
                    ) : null}
                    <p className="mt-1 font-mono text-xs text-neutral-500">Ref · {app.id}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </FormSection>

        <FormSection legend="Application handoff">
          <ApplicationPortalHandoffPanel handoff={detail.applicationHandoff} />
        </FormSection>

        {detail.status === "new" ? (
          <FormSection legend="Archive">
            <p className="mb-3 text-sm text-neutral-600">
              Remove this prospect from the viewing requests queue when you are done pursuing them.
            </p>
            <PrimaryButton
              type="button"
              className="!w-auto px-6"
              disabled={archivePending}
              onClick={onArchive}
            >
              {archivePending ? "Archiving…" : "Archive prospect"}
            </PrimaryButton>
          </FormSection>
        ) : null}
      </div>
    </div>
  );
}
