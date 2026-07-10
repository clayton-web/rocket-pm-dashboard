"use client";

import { SURFACE_CARD, SURFACE_PANEL } from "@/components/portal/ui";
import { AddPropertyForm } from "@/components/properties/add-property-form";
import Link from "next/link";

export type PropertyListRow = {
  id: string;
  name: string;
  streetLine1: string;
  streetLine2: string | null;
  city: string;
  province: string;
  postalCode: string;
  /** Additional rentable spaces only — excludes the default Entire Property unit. */
  additionalUnitCount: number | null;
};

function formatStreetLine(row: Pick<PropertyListRow, "streetLine1" | "streetLine2">) {
  return row.streetLine2 ? `${row.streetLine1}, ${row.streetLine2}` : row.streetLine1;
}

function formatCityLine(row: Pick<PropertyListRow, "city" | "province" | "postalCode">) {
  return `${row.city}, ${row.province} ${row.postalCode}`;
}

export function PropertyList({
  properties,
  canCreate,
  loadError,
}: {
  properties: PropertyListRow[];
  canCreate: boolean;
  loadError: string | null;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Properties</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Rental properties in your organization. Review completeness on{" "}
          <Link href="/properties/health" className="font-medium underline">
            Property Documents &amp; Health
          </Link>
          . Operational Active status, service relationship (managed / pre-management / placement
          only), and published rental listings are separate. Units appear on{" "}
          <Link href="/portal/viewing" className="font-medium underline">
            /portal/viewing
          </Link>{" "}
          when published, or via a temporary per-unit fallback for units with no listing history.
        </p>
      </div>

      {loadError ? (
        <p className={`mb-4 rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-sm text-neutral-700`}>
          {loadError}
        </p>
      ) : null}

      {canCreate ? (
        <div className="mb-8">
          <AddPropertyForm />
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {properties.length === 0 ? (
          <p className={`${SURFACE_PANEL} px-3.5 py-3 text-sm text-neutral-600`}>
            {canCreate
              ? "No properties yet. Add one above to get started."
              : "No properties assigned to your account."}
          </p>
        ) : (
          properties.map((property) => (
            <Link
              key={property.id}
              href={`/properties/${property.id}`}
              className={`block ${SURFACE_CARD} px-4 py-4 transition-colors hover:border-neutral-400`}
            >
              <h2 className="text-sm font-semibold text-neutral-900">{formatStreetLine(property)}</h2>
              <p className="mt-1 text-sm text-neutral-600">{formatCityLine(property)}</p>
              {property.additionalUnitCount != null ? (
                <p className="mt-2 text-sm text-neutral-600">
                  <span className="text-neutral-500">Units · </span>
                  {property.additionalUnitCount}
                </p>
              ) : null}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
