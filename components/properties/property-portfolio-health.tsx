"use client";

import {
  FormSection,
  InlineNotice,
  SURFACE_CARD,
  SURFACE_PANEL,
  toggleTileClasses,
} from "@/components/portal/ui";
import {
  filterPortfolioHealthRows,
  formatPortfolioHealthCategoryStatus,
  type PortfolioHealthFilter,
  type PortfolioHealthRow,
  type PortfolioHealthSummary,
} from "@/lib/property/portfolio-health";
import Link from "next/link";
import { useMemo, useState } from "react";

const FILTER_OPTIONS: { id: PortfolioHealthFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "complete", label: "Complete" },
  { id: "needs_review", label: "Needs Review" },
  { id: "missing_documents", label: "Missing Documents" },
  { id: "missing_owner", label: "Missing Owner Info" },
  { id: "missing_tenant", label: "Missing Tenant Info" },
  { id: "missing_rent_lease", label: "Missing Rent/Lease Info" },
  { id: "vacant", label: "Vacant Properties" },
];

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

export function PropertyPortfolioHealth({
  rows,
  summary,
  loadError,
}: {
  rows: PortfolioHealthRow[];
  summary: PortfolioHealthSummary;
  loadError: string | null;
}) {
  const [filter, setFilter] = useState<PortfolioHealthFilter>("all");
  const visibleRows = useMemo(() => filterPortfolioHealthRows(rows, filter), [rows, filter]);

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

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Total properties" value={summary.total} />
        <SummaryCard label="Complete properties" value={summary.complete} />
        <SummaryCard label="Needs review" value={summary.needsReview} />
        <SummaryCard label="Missing documents" value={summary.missingDocuments} />
        <SummaryCard label="Missing owner contact" value={summary.missingOwnerContact} />
        <SummaryCard label="Missing tenant info" value={summary.missingTenantInfo} />
      </div>

      <FormSection legend="Filter">
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              className={toggleTileClasses(filter === option.id)}
              aria-pressed={filter === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>
      </FormSection>

      <p className="mb-4 mt-6 text-sm text-neutral-600">
        Showing {visibleRows.length} of {rows.length} propert{rows.length === 1 ? "y" : "ies"}
        {summary.vacant > 0 ? ` · ${summary.vacant} vacant` : ""}
      </p>

      {rows.length === 0 ? (
        <InlineNotice>No properties found for this organization.</InlineNotice>
      ) : visibleRows.length === 0 ? (
        <InlineNotice>No properties match this filter.</InlineNotice>
      ) : (
        <div className="flex flex-col gap-4">
          {visibleRows.map((row) => (
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

              <div className="overflow-x-auto">
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

              {row.missingItems.length > 0 ? (
                <div className="px-4 py-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Missing or recommended items
                  </h3>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {row.missingItems.map((item) => (
                      <li
                        key={item}
                        className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-700"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
