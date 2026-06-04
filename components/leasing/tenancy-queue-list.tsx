"use client";

import {
  FormField,
  FormSection,
  InlineNotice,
  SURFACE_CARD,
  SURFACE_PANEL,
  toggleTileClasses,
} from "@/components/portal/ui";
import { formatTenancyStatus } from "@/lib/leasing/application-staff-detail";
import type { TenancyQueueRow } from "@/lib/leasing/tenancy-staff-queue";
import Link from "next/link";
import { useMemo, useState } from "react";

function formatMoveInDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function TenancyQueueList({
  initialTenancies,
  loadError,
  statusFilter = "all",
}: {
  initialTenancies: TenancyQueueRow[];
  loadError: string | null;
  statusFilter?: "all" | "pending_move_in";
}) {
  const [tenancies] = useState(initialTenancies);
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const isPendingMoveIn = statusFilter === "pending_move_in";

  const propertyOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const t of tenancies) {
      names.set(t.propertyId, t.propertyName);
    }
    return [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [tenancies]);

  const visible = useMemo(() => {
    if (propertyFilter === "all") return tenancies;
    return tenancies.filter((t) => t.propertyId === propertyFilter);
  }, [tenancies, propertyFilter]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">
          {isPendingMoveIn ? "Pending move-ins" : "Tenancies"}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          {isPendingMoveIn ? (
            <>
              Tenancies awaiting move-in.{" "}
              <Link href="/leasing/tenancies" className="font-medium underline">
                View all tenancies
              </Link>
            </>
          ) : (
            <>
              Manage lease lifecycle and tenant portal access for properties you oversee.{" "}
              <Link
                href="/leasing/tenancies?status=pending_move_in"
                className="font-medium underline"
              >
                View pending move-ins
              </Link>
            </>
          )}
        </p>
      </div>

      {loadError ? <InlineNotice className="mb-4">{loadError}</InlineNotice> : null}

      <div className="flex flex-col gap-8">
        <FormField label="Overview" htmlFor="tenancy-queue-summary">
          <output id="tenancy-queue-summary" className={`block ${SURFACE_PANEL} px-3.5 py-3 text-sm`}>
            <span className="font-medium text-neutral-900">
              {tenancies.length} tenanc{tenancies.length === 1 ? "y" : "ies"}
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

        {tenancies.length === 0 ? (
          <InlineNotice>
            {isPendingMoveIn
              ? "No tenancies pending move-in."
              : "No tenancies yet. Convert an approved application to create one."}
          </InlineNotice>
        ) : visible.length === 0 ? (
          <InlineNotice>No tenancies match this filter.</InlineNotice>
        ) : (
          <ul className="flex list-none flex-col gap-3 p-0">
            {visible.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/leasing/tenancies/${t.id}`}
                  className={`block ${SURFACE_CARD} px-4 py-4 transition-colors hover:border-neutral-400`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium text-neutral-800">
                      {formatTenancyStatus(t.status)}
                    </span>
                  </div>
                  <h2 className="mt-3 text-sm font-semibold text-neutral-900">
                    {t.tenantLabel ?? "No contact on file"}
                  </h2>
                  <p className="mt-1 text-xs font-medium text-neutral-700">{t.propertyName}</p>
                  <p className="mt-2 text-sm text-neutral-600">{t.unitLabel}</p>
                  <p className="mt-2 text-sm text-neutral-600">
                    <span className="text-neutral-500">Move-in · </span>
                    {formatMoveInDate(t.moveInDate)}
                  </p>
                  <p className="mt-1 text-sm text-neutral-600">
                    <span className="text-neutral-500">Rent · </span>${t.monthlyRent}
                  </p>
                  <p className="mt-2 font-mono text-xs text-neutral-500">Ref · {t.id}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
