"use client";

import {
  FormField,
  FormSection,
  InlineNotice,
  PrimaryButton,
  SURFACE_CARD,
  SURFACE_PANEL,
  toggleTileClasses,
} from "@/components/portal/ui";
import type { ProspectQueueRow } from "@/lib/leasing/staff-queue";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { archiveProspectAction } from "@/app/(dashboard)/leasing/prospects/actions";

function formatSubmittedAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { label: iso, dateTime: iso };
  return {
    label: d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
    dateTime: d.toISOString(),
  };
}

function formatDate(iso: string) {
  const d = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function formatName(firstName: string | null, lastName: string | null, email: string) {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || email;
}

export function ProspectQueueList({
  initialProspects,
  loadError,
}: {
  initialProspects: ProspectQueueRow[];
  loadError: string | null;
}) {
  const [prospects, setProspects] = useState(initialProspects);
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const propertyOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const p of prospects) {
      names.set(p.propertyId, p.propertyName);
    }
    return [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [prospects]);

  const visible = useMemo(() => {
    if (propertyFilter === "all") return prospects;
    return prospects.filter((p) => p.propertyId === propertyFilter);
  }, [prospects, propertyFilter]);

  function onArchive(prospectId: string) {
    setActionError(null);
    setPendingId(prospectId);
    startTransition(async () => {
      const result = await archiveProspectAction(prospectId);
      setPendingId(null);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setProspects((prev) => prev.filter((p) => p.id !== prospectId));
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Viewing requests</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Active viewing requests in the leasing pipeline. Public form:{" "}
          <Link href="/portal/viewing" className="font-medium underline">
            /portal/viewing
          </Link>
        </p>
      </div>

      {loadError ? <InlineNotice className="mb-4">{loadError}</InlineNotice> : null}
      {actionError ? <InlineNotice className="mb-4">{actionError}</InlineNotice> : null}

      <div className="flex flex-col gap-8">
        <FormField label="Queue overview" htmlFor="prospect-queue-summary">
          <output id="prospect-queue-summary" className={`block ${SURFACE_PANEL} px-3.5 py-3 text-sm`}>
            <span className="font-medium text-neutral-900">
              {prospects.length} active request{prospects.length === 1 ? "" : "s"}
            </span>
            <span className="mt-1 block text-neutral-600">{visible.length} shown with current filter</span>
          </output>
        </FormField>

        {propertyOptions.length > 1 ? (
          <FormSection legend="Filter by property">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPropertyFilter("all")}
                className={toggleTileClasses(propertyFilter === "all")}
                aria-pressed={propertyFilter === "all"}
              >
                All properties
              </button>
              {propertyOptions.map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPropertyFilter(id)}
                  className={toggleTileClasses(propertyFilter === id)}
                  aria-pressed={propertyFilter === id}
                >
                  {name}
                </button>
              ))}
            </div>
          </FormSection>
        ) : null}

        {prospects.length === 0 ? (
          <InlineNotice>No new viewing requests yet.</InlineNotice>
        ) : visible.length === 0 ? (
          <InlineNotice>No requests match this filter.</InlineNotice>
        ) : (
          <ul className="flex list-none flex-col gap-3 p-0">
            {visible.map((prospect) => {
              const submitted = formatSubmittedAt(prospect.createdAt);
              const displayName = formatName(prospect.firstName, prospect.lastName, prospect.email);
              const archiving = isPending && pendingId === prospect.id;
              return (
                <li key={prospect.id}>
                  <article className={`${SURFACE_CARD} px-4 py-4`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium text-neutral-800">
                        {prospect.pipelineStageLabel}
                      </span>
                      <time className="text-xs text-neutral-500" dateTime={submitted.dateTime}>
                        {submitted.label}
                      </time>
                    </div>
                    <h2 className="mt-3 text-sm font-semibold text-neutral-900">
                      <Link
                        href={`/leasing/prospects/${prospect.id}`}
                        className="underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-600"
                      >
                        {displayName}
                      </Link>
                    </h2>
                    <p className="mt-1 text-xs font-medium text-neutral-700">{prospect.propertyName}</p>
                    <p className="mt-2 text-sm text-neutral-600">
                      {prospect.unitLabel ?? "No specific unit selected"}
                    </p>
                    <p className="mt-2 text-sm text-neutral-600">
                      <span className="text-neutral-500">Email · </span>
                      {prospect.email}
                    </p>
                    {prospect.phone ? (
                      <p className="mt-1 text-sm text-neutral-600">
                        <span className="text-neutral-500">Phone · </span>
                        {prospect.phone}
                      </p>
                    ) : null}
                    {prospect.occupantCount != null ? (
                      <p className="mt-2 text-sm text-neutral-600">
                        <span className="text-neutral-500">Occupants · </span>
                        {prospect.occupantCount}
                        {prospect.hasPets ? " · Pets" : ""}
                      </p>
                    ) : null}
                    {prospect.desiredMoveInDate ? (
                      <p className="mt-1 text-sm text-neutral-600">
                        <span className="text-neutral-500">Desired move-in · </span>
                        {formatDate(prospect.desiredMoveInDate)}
                      </p>
                    ) : null}
                    {prospect.householdIncomeRangeLabel ? (
                      <p className="mt-1 text-sm text-neutral-600">
                        <span className="text-neutral-500">Income range · </span>
                        {prospect.householdIncomeRangeLabel}
                      </p>
                    ) : null}
                    {prospect.preferredViewingNotes ? (
                      <p className="mt-2 line-clamp-2 text-sm text-neutral-700" title={prospect.preferredViewingNotes}>
                        <span className="text-neutral-500">Preferred viewing · </span>
                        {prospect.preferredViewingNotes}
                      </p>
                    ) : null}
                    {prospect.messagePreview ? (
                      <p className="mt-2 line-clamp-2 text-sm text-neutral-700" title={prospect.messagePreview}>
                        <span className="text-neutral-500">Notes · </span>
                        {prospect.messagePreview}
                      </p>
                    ) : null}
                    <p className="mt-2 font-mono text-xs text-neutral-500">Ref · {prospect.id}</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        href={`/leasing/prospects/${prospect.id}`}
                        className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 no-underline hover:bg-neutral-50"
                      >
                        View details
                      </Link>
                      <PrimaryButton
                        type="button"
                        className="!w-auto px-6"
                        disabled={archiving}
                        onClick={() => onArchive(prospect.id)}
                      >
                        {archiving ? "Archiving…" : "Archive"}
                      </PrimaryButton>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
