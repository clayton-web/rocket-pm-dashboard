"use client";

import { closeOutShowingAction } from "@/app/(dashboard)/leasing/showings/actions";
import {
  FormField,
  FormSection,
  InlineNotice,
  PrimaryButton,
  SURFACE_CARD,
  SURFACE_PANEL,
} from "@/components/portal/ui";
import { ApplicationPortalHandoffPanel } from "@/components/leasing/application-portal-handoff";
import { formatShowingCloseOutChoice } from "@/lib/leasing/showing-close-out";
import type { ShowingStaffDetail } from "@/lib/leasing/showing-staff-detail";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-sm text-neutral-700">
      <span className="text-neutral-500">{label} · </span>
      {children}
    </p>
  );
}

export function ShowingDetail({
  initialDetail,
  loadError,
}: {
  initialDetail: ShowingStaffDetail | null;
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
        <InlineNotice>{loadError ?? "Showing not found."}</InlineNotice>
      </div>
    );
  }

  return <ShowingDetailBody detail={initialDetail} />;
}

function ShowingDetailBody({ detail }: { detail: ShowingStaffDetail }) {
  const router = useRouter();
  const choiceId = useId();
  const notesId = useId();

  const [actionError, setActionError] = useState<string | null>(null);
  const [closeOutPending, startCloseOutTransition] = useTransition();
  const [choice, setChoice] = useState("");
  const [notes, setNotes] = useState(detail.contactNotes ?? "");

  const showRescheduleNotice = detail.showingOutcome === "reschedule";
  const showInterestedHandoff =
    detail.showingOutcome === "interested" && detail.status === "completed";

  function onCloseOut(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);
    startCloseOutTransition(async () => {
      const result = await closeOutShowingAction(detail.id, {
        choice,
        notes: notes || undefined,
      });
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
        <Link href={detail.prospectHref} className="text-sm font-medium text-neutral-700 underline">
          ← Back to prospect
        </Link>
      </p>

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-neutral-900">Showing</h1>
          <span className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium text-neutral-800">
            {detail.statusLabel}
          </span>
        </div>
        <p className="mt-1 text-sm text-neutral-600">{formatDateTime(detail.scheduledStart)}</p>
        <p className="mt-1 font-mono text-xs text-neutral-500">Ref · {detail.id}</p>
      </div>

      {actionError ? <InlineNotice className="mb-4">{actionError}</InlineNotice> : null}

      <div className="flex flex-col gap-8">
        <FormSection legend="Showing details">
          <div className={`${SURFACE_PANEL} space-y-2 px-3.5 py-3`}>
            <DetailRow label="Prospect">
              <Link href={detail.prospectHref} className="font-medium underline">
                {detail.prospectName}
              </Link>
            </DetailRow>
            <DetailRow label="Prospect email">{detail.prospectEmail}</DetailRow>
            <DetailRow label="Property">{detail.propertyName}</DetailRow>
            <DetailRow label="Unit">{detail.unitLabel ?? "No specific unit"}</DetailRow>
            <DetailRow label="Scheduled start">{formatDateTime(detail.scheduledStart)}</DetailRow>
            <DetailRow label="Scheduled end">{formatDateTime(detail.scheduledEnd)}</DetailRow>
            <DetailRow label="Assigned staff">{detail.assignedToLabel ?? "Unassigned"}</DetailRow>
            <DetailRow label="Scheduled by">{detail.createdByLabel ?? "—"}</DetailRow>
            <DetailRow label="Status">{detail.statusLabel}</DetailRow>
            <DetailRow label="Outcome">{detail.outcomeLabel ?? "—"}</DetailRow>
            <DetailRow label="Contact status">{detail.contactStatusLabel}</DetailRow>
            <DetailRow label="Notes">{detail.contactNotes ?? "—"}</DetailRow>
          </div>
        </FormSection>

        {detail.canCloseOut ? (
          <FormSection legend="Close out showing">
            <form onSubmit={onCloseOut} className="flex flex-col gap-4">
              <FormField label="What happened?" htmlFor={choiceId}>
                <select
                  id={choiceId}
                  required
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a result…</option>
                  {detail.closeOutChoices.map((option) => (
                    <option key={option} value={option}>
                      {formatShowingCloseOutChoice(option)}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Notes (optional)" htmlFor={notesId}>
                <textarea
                  id={notesId}
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </FormField>
              <PrimaryButton type="submit" className="!w-auto px-6" disabled={closeOutPending}>
                {closeOutPending ? "Saving…" : "Save close-out"}
              </PrimaryButton>
            </form>
          </FormSection>
        ) : null}

        {showRescheduleNotice ? (
          <InlineNotice>
            Schedule a new showing from the{" "}
            <Link href={detail.prospectHref} className="font-medium underline">
              prospect detail page
            </Link>
            . This record stays closed for audit history.
          </InlineNotice>
        ) : null}

        {showInterestedHandoff ? (
          <FormSection legend="Application handoff">
            <ApplicationPortalHandoffPanel handoff={detail.applicationHandoff} />
          </FormSection>
        ) : null}

        {detail.linkedApplications.length > 0 ? (
          <FormSection legend="Linked applications">
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
                    <p className="mt-1 font-mono text-xs text-neutral-500">Ref · {app.id}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </FormSection>
        ) : null}
      </div>
    </div>
  );
}
