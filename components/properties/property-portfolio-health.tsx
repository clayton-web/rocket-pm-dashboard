"use client";

import {
  FormSection,
  InlineNotice,
  SURFACE_CARD,
  SURFACE_PANEL,
  toggleTileClasses,
} from "@/components/portal/ui";
import {
  filterPortfolioHealthCleanupQueue,
  normalizeCleanupFilters,
  parseCleanupFiltersParam,
  PORTFOLIO_HEALTH_CLEANUP_FILTER_LABELS,
  PORTFOLIO_HEALTH_PROPERTY_CLEANUP_FILTERS,
  PORTFOLIO_HEALTH_TENANT_CLEANUP_FILTERS,
  serializeCleanupFiltersParam,
  type PortfolioHealthCleanupFilter,
  type PortfolioHealthFilteredRow,
} from "@/lib/property/portfolio-health-cleanup-filters";
import {
  formatPortfolioHealthCategoryStatus,
  formatPortfolioHealthMissingLabels,
  PORTFOLIO_HEALTH_SNAPSHOT_LABELS,
  type PortfolioHealthRow,
  type PortfolioHealthSummary,
} from "@/lib/property/portfolio-health";
import { buildHealthEditTenancyHref } from "@/lib/property/portfolio-health-return";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

function CleanupQueueSnapshot({ summary }: { summary: PortfolioHealthSummary }) {
  const items = PORTFOLIO_HEALTH_SNAPSHOT_LABELS.map(({ label, value }) => ({
    label,
    count: value(summary.issueSnapshot),
  })).filter((item) => item.count > 0);

  if (items.length === 0) {
    return (
      <FormSection legend="Cleanup queue snapshot">
        <p className="text-sm text-neutral-600">No open cleanup issues in the active portfolio.</p>
      </FormSection>
    );
  }

  return (
    <FormSection legend="Cleanup queue snapshot">
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.label} className={`${SURFACE_PANEL} px-3.5 py-3 text-sm text-neutral-800`}>
            <span className="font-medium text-neutral-900">{item.label}</span>
            <span className="tabular-nums text-neutral-600"> · {item.count}</span>
          </li>
        ))}
      </ul>
    </FormSection>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className={`${SURFACE_PANEL} px-3.5 py-3`}>
      <div className="text-2xl font-semibold tabular-nums text-neutral-900">{value}</div>
      <div className="mt-1 text-sm text-neutral-600">{label}</div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: PortfolioHealthRow["overallStatus"] | PortfolioHealthRow["ownerInfoStatus"];
}) {
  const classes =
    status === "complete" || status === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : status === "needs_review" || status === "missing"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : status === "recommended"
          ? "border-sky-200 bg-sky-50 text-sky-900"
          : "border-neutral-200 bg-neutral-50 text-neutral-700";

  const label =
    status === "complete"
      ? "Complete"
      : status === "needs_review"
        ? "Needs Review"
        : formatPortfolioHealthCategoryStatus(status);

  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}

function CategoryCell({ status }: { status: PortfolioHealthRow["ownerInfoStatus"] }) {
  return <span className="text-sm text-neutral-800">{formatPortfolioHealthCategoryStatus(status)}</span>;
}

function MissingItemList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {items.map((item) => (
        <li key={item} className="text-sm text-neutral-700">
          · {item}
        </li>
      ))}
    </ul>
  );
}

function UnitHealthCard({
  slot,
  selectedFilters,
}: {
  slot: PortfolioHealthFilteredRow["visibleUnitSlots"][number];
  selectedFilters: PortfolioHealthCleanupFilter[];
}) {
  const unitIssues = formatPortfolioHealthMissingLabels(slot.visibleTenantDataFlags);

  return (
    <div className={`${SURFACE_PANEL} px-4 py-4`}>
      <h4 className="text-sm font-semibold text-neutral-900">{slot.unitLabel}</h4>

      {slot.isVacant ? (
        <p className="mt-2 text-sm text-neutral-600">No active tenancy</p>
      ) : (
        <>
          {unitIssues.length > 0 ? <MissingItemList items={unitIssues} /> : null}
          {slot.tenancyId ? (
            <div className="mt-3 flex flex-wrap gap-4">
              <Link
                href={`/leasing/tenancies/${slot.tenancyId}`}
                className="text-sm font-medium text-neutral-900 underline"
              >
                View tenancy
              </Link>
              <Link
                href={buildHealthEditTenancyHref(slot.tenancyId, selectedFilters)}
                className="text-sm font-medium text-neutral-900 underline"
              >
                Edit tenancy
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function FilterGroup({
  legend,
  filters,
  selected,
  onToggle,
}: {
  legend: string;
  filters: PortfolioHealthCleanupFilter[];
  selected: PortfolioHealthCleanupFilter[];
  onToggle: (filter: PortfolioHealthCleanupFilter) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{legend}</p>
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const active = selected.includes(filter);
          return (
            <button
              key={filter}
              type="button"
              onClick={() => onToggle(filter)}
              className={toggleTileClasses(active)}
              aria-pressed={active}
            >
              {PORTFOLIO_HEALTH_CLEANUP_FILTER_LABELS[filter]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PropertyPortfolioHealth({
  rows,
  summary,
  loadError,
}: {
  rows: PortfolioHealthRow[];
  summary: PortfolioHealthSummary;
  loadError: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialFilters = useMemo(
    () => parseCleanupFiltersParam(searchParams.get("filters")),
    [searchParams],
  );
  const [selectedFilters, setSelectedFilters] =
    useState<PortfolioHealthCleanupFilter[]>(initialFilters);

  const syncFiltersToUrl = useCallback(
    (filters: PortfolioHealthCleanupFilter[]) => {
      const params = new URLSearchParams(searchParams.toString());
      const serialized = serializeCleanupFiltersParam(filters);
      if (serialized) {
        params.set("filters", serialized);
      } else {
        params.delete("filters");
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const toggleFilter = useCallback(
    (filter: PortfolioHealthCleanupFilter) => {
      setSelectedFilters((current) => {
        const next = normalizeCleanupFilters(
          current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter],
        );
        syncFiltersToUrl(next);
        return next;
      });
    },
    [syncFiltersToUrl],
  );

  const clearFilters = useCallback(() => {
    setSelectedFilters([]);
    syncFiltersToUrl([]);
  }, [syncFiltersToUrl]);

  const visibleRows = useMemo(
    () => filterPortfolioHealthCleanupQueue(rows, selectedFilters),
    [rows, selectedFilters],
  );

  const cleanupDone = searchParams.get("cleanupDone") === "1";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Property Documents &amp; Health</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Review portfolio completeness after CSV import or day-to-day updates. This report is read-only
          and does not block property use.{" "}
          <Link href="/properties" className="font-medium underline">
            Back to properties
          </Link>
        </p>
      </div>

      {loadError ? <InlineNotice className="mb-4">{loadError}</InlineNotice> : null}

      {cleanupDone ? (
        <InlineNotice className="mb-4">
          Cleanup complete for the selected filters. No matching tenancies remain.
        </InlineNotice>
      ) : null}

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <SummaryCard label="Active properties" value={summary.activeProperties} />
        <SummaryCard label="Active tenancies" value={summary.activeTenancies} />
        <SummaryCard label="Complete properties" value={summary.complete} />
        <SummaryCard label="Needs review" value={summary.needsReview} />
        <SummaryCard label="Tenant cleanup needed" value={summary.needsTenantCleanup} />
        <SummaryCard label="Property cleanup needed" value={summary.needsPropertyCleanup} />
        <SummaryCard label="Missing documents" value={summary.missingDocuments} />
        <SummaryCard label="Missing owner contact" value={summary.missingOwnerContact} />
        <SummaryCard label="Missing tenant info" value={summary.missingTenantInfo} />
      </div>

      <div className="mb-8">
        <CleanupQueueSnapshot summary={summary} />
      </div>

      <FormSection legend="Cleanup filters">
        <p className="mb-4 text-sm text-neutral-600">
          Select one or more filters. Properties must match every selected filter. Units show only the
          matching issue badges.
        </p>
        <div className="space-y-4">
          <FilterGroup
            legend="Tenant issues"
            filters={PORTFOLIO_HEALTH_TENANT_CLEANUP_FILTERS}
            selected={selectedFilters}
            onToggle={toggleFilter}
          />
          <FilterGroup
            legend="Property issues"
            filters={PORTFOLIO_HEALTH_PROPERTY_CLEANUP_FILTERS}
            selected={selectedFilters}
            onToggle={toggleFilter}
          />
        </div>
        {selectedFilters.length > 0 ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-medium text-neutral-800 underline"
            >
              Clear all
            </button>
          </div>
        ) : null}
      </FormSection>

      <p className="mb-4 mt-6 text-sm text-neutral-600">
        Showing {visibleRows.length} of {rows.length} propert{rows.length === 1 ? "y" : "ies"}
        {selectedFilters.length > 0
          ? ` · ${selectedFilters.length} active filter${selectedFilters.length === 1 ? "" : "s"}`
          : ""}
        {summary.vacant > 0 ? ` · ${summary.vacant} vacant` : ""}
      </p>

      {rows.length === 0 ? (
        <InlineNotice>No properties found for this organization.</InlineNotice>
      ) : visibleRows.length === 0 ? (
        <InlineNotice>No properties match the selected filters.</InlineNotice>
      ) : (
        <div className="flex flex-col gap-4">
          {visibleRows.map((row) => {
            const propertyIssues = formatPortfolioHealthMissingLabels(row.visiblePropertyMissingItemKeys);

            return (
              <article key={row.propertyId} className={`${SURFACE_CARD} overflow-hidden`}>
                <div className="border-b border-neutral-200 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-neutral-900">{row.propertyLabel}</h2>
                      <p className="mt-1 text-sm text-neutral-600">{row.cityLine}</p>
                      {row.isVacant ? (
                        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                          Vacant
                        </p>
                      ) : null}
                      {row.hasImportPlaceholders ? (
                        <p className="mt-2 text-xs font-medium text-amber-800">
                          Likely imported placeholders — review rent, deposit, and dates
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={row.overallStatus} />
                      <Link
                        href={`/properties/${row.propertyId}`}
                        className="text-sm font-medium text-neutral-900 underline"
                      >
                        Open property
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto border-b border-neutral-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Owner info</th>
                        <th className="px-4 py-3 font-medium">Strata notes</th>
                        <th className="px-4 py-3 font-medium">Active tenant</th>
                        <th className="px-4 py-3 font-medium">Tenant contact</th>
                        <th className="px-4 py-3 font-medium">Lease/rent</th>
                        <th className="px-4 py-3 font-medium">Documents</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-neutral-100">
                        <td className="px-4 py-3">
                          <CategoryCell status={row.ownerInfoStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <CategoryCell status={row.strataNotesStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <CategoryCell status={row.activeTenantStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <CategoryCell status={row.tenantContactStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <CategoryCell status={row.leaseRentStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <CategoryCell status={row.documentsStatus} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="space-y-6 px-4 py-4">
                  {propertyIssues.length > 0 ? (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Property issues
                      </h3>
                      <MissingItemList items={propertyIssues} />
                    </div>
                  ) : null}

                  {row.visibleUnitSlots.length > 0 ? (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Units
                      </h3>
                      <div className="mt-3 flex flex-col gap-3">
                        {row.visibleUnitSlots.map((slot) => (
                          <UnitHealthCard
                            key={slot.unitId}
                            slot={slot}
                            selectedFilters={selectedFilters}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
