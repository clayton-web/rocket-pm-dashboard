"use client";

import { FormSection, InlineNotice, SURFACE_PANEL } from "@/components/portal/ui";
import type { PropertyTenanciesPageData, PropertyTenancyUnitRow } from "@/lib/property/property-tenancies-staff";
import Link from "next/link";

function DetailField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-1 text-sm text-neutral-900">{value?.trim() ? value : "—"}</dd>
    </div>
  );
}

function OccupancyBadge({ status }: { status: PropertyTenancyUnitRow["occupancyStatus"] }) {
  const classes =
    status === "occupied"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-neutral-200 bg-neutral-50 text-neutral-700";

  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${classes}`}>
      {status === "occupied" ? "Occupied" : "Vacant"}
    </span>
  );
}

function PropertyTenancyUnitCard({ row }: { row: PropertyTenancyUnitRow }) {
  const unitMeta = [
    row.floor ? `Floor ${row.floor}` : null,
    row.bedrooms != null ? `${row.bedrooms} bed` : null,
    !row.unitIsActive ? "Inactive unit" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className={`${SURFACE_PANEL} px-4 py-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">{row.unitLabel}</h3>
          {unitMeta ? <p className="mt-1 text-xs text-neutral-600">{unitMeta}</p> : null}
        </div>
        <OccupancyBadge status={row.occupancyStatus} />
      </div>

      {row.occupancyStatus === "vacant" ? (
        <p className="mt-4 text-sm text-neutral-600">No active tenancy</p>
      ) : (
        <>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailField label="Tenant" value={row.tenantName} />
            <DetailField label="Email" value={row.tenantEmail} />
            <DetailField label="Phone" value={row.tenantPhone} />
            <DetailField label="Monthly rent" value={row.monthlyRent} />
            <DetailField label="Lease start" value={row.leaseStartDate} />
            <DetailField label="Tenancy status" value={row.tenancyStatusLabel} />
          </dl>

          {row.tenancyId ? (
            <div className="mt-4 flex flex-wrap gap-4">
              <Link
                href={`/leasing/tenancies/${row.tenancyId}`}
                className="text-sm font-medium text-neutral-900 underline"
              >
                Open tenancy
              </Link>
              <Link
                href={`/leasing/tenancies/${row.tenancyId}#edit-tenancy`}
                className="text-sm font-medium text-neutral-900 underline"
              >
                Edit tenancy
              </Link>
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}

export function PropertyTenanciesSection({
  data,
  loadError,
}: {
  data: PropertyTenanciesPageData | null;
  loadError: string | null;
}) {
  return (
    <FormSection legend="Tenancies">
      <p className="mb-4 text-sm text-neutral-600">
        Review active tenancy details by unit, then open or edit the tenancy record to clean up imported
        data.
      </p>

      {loadError ? <InlineNotice className="mb-4">{loadError}</InlineNotice> : null}

      {!data || data.units.length === 0 ? (
        <InlineNotice>No units found for this property.</InlineNotice>
      ) : (
        <div className="flex flex-col gap-3">
          {data.units.map((row) => (
            <PropertyTenancyUnitCard key={row.unitId} row={row} />
          ))}
        </div>
      )}
    </FormSection>
  );
}
