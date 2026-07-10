import type { PrismaClient } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { isRentalListingPublicFallbackEnabled } from "@/lib/leasing/rental-listing-public-fallback";
import { getPublicPortalOrgSlug } from "@/lib/portal/public-org";
import { NotFoundError } from "@/lib/services/errors";

export type LeasingSubmitOptionUnit = {
  unitId: string;
  unitNumber: string;
  /** Present when sourced from a published RentalListing. */
  rentalListingId?: string;
  monthlyRent?: string | null;
  availableDate?: string | null;
  bedrooms?: number | null;
  bathrooms?: string | null;
  approxSqft?: number | null;
  headline?: string | null;
  description?: string | null;
  isPublishedListing?: boolean;
};

export type LeasingSubmitOption = {
  propertyId: string;
  propertyName: string;
  units: LeasingSubmitOptionUnit[];
};

type Db = PrismaClient;

async function getPublicPortalOrganization(db: Db) {
  const slug = getPublicPortalOrgSlug();
  return db.organization.findFirst({
    where: { slug },
    select: { id: true },
  });
}

function formatDateOnly(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function mergeSubmitOptions(parts: LeasingSubmitOption[]): LeasingSubmitOption[] {
  const byProperty = new Map<string, LeasingSubmitOption>();
  for (const part of parts) {
    let option = byProperty.get(part.propertyId);
    if (!option) {
      option = {
        propertyId: part.propertyId,
        propertyName: part.propertyName,
        units: [],
      };
      byProperty.set(part.propertyId, option);
    }
    const seenUnits = new Set(option.units.map((u) => u.unitId));
    for (const unit of part.units) {
      if (seenUnits.has(unit.unitId)) continue;
      option.units.push(unit);
      seenUnits.add(unit.unitId);
    }
  }
  return [...byProperty.values()].sort((a, b) =>
    a.propertyName.localeCompare(b.propertyName, "en"),
  );
}

/**
 * Published RentalListing rows for the public portal org.
 * Requires operationally active property and unit.
 * serviceRelationship does not gate visibility — managed, pre-management, and
 * placement-only properties may all publish.
 */
export async function listPublishedRentalListingSubmitOptions(
  db: Db = prisma,
): Promise<LeasingSubmitOption[]> {
  const org = await getPublicPortalOrganization(db);
  if (!org) return [];

  const listings = await db.rentalListing.findMany({
    where: {
      organizationId: org.id,
      status: "PUBLISHED",
      property: { isActive: true, organizationId: org.id },
      unit: { isActive: true },
    },
    select: {
      id: true,
      propertyId: true,
      unitId: true,
      monthlyRent: true,
      availableDate: true,
      bedrooms: true,
      bathrooms: true,
      approxSqft: true,
      headline: true,
      description: true,
      property: { select: { id: true, name: true } },
      unit: { select: { id: true, unitNumber: true } },
    },
    orderBy: [{ property: { name: "asc" } }, { unit: { unitNumber: "asc" } }],
  });

  const byProperty = new Map<string, LeasingSubmitOption>();
  for (const listing of listings) {
    let option = byProperty.get(listing.propertyId);
    if (!option) {
      option = {
        propertyId: listing.propertyId,
        propertyName: listing.property.name,
        units: [],
      };
      byProperty.set(listing.propertyId, option);
    }
    option.units.push({
      unitId: listing.unitId,
      unitNumber: listing.unit.unitNumber,
      rentalListingId: listing.id,
      monthlyRent: listing.monthlyRent != null ? listing.monthlyRent.toString() : null,
      availableDate: formatDateOnly(listing.availableDate),
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms != null ? listing.bathrooms.toString() : null,
      approxSqft: listing.approxSqft,
      headline: listing.headline,
      description: listing.description,
      isPublishedListing: true,
    });
  }

  return [...byProperty.values()];
}

/**
 * TEMPORARY per-unit compatibility fallback.
 *
 * Returns operationally active units in the public org that have **no**
 * RentalListing history of any status. As soon as a unit has DRAFT, PUBLISHED,
 * PAUSED, or CLOSED listing history, legacy fallback never includes that unit —
 * staff listing intent is authoritative.
 *
 * This is intentionally per-unit (not organization-wide): publishing one listing
 * must not hide other untouched legacy units.
 */
export async function listLegacyActiveUnitsWithoutListingHistory(
  db: Db = prisma,
): Promise<LeasingSubmitOption[]> {
  const org = await getPublicPortalOrganization(db);
  if (!org) return [];

  const properties = await db.property.findMany({
    where: { organizationId: org.id, isActive: true },
    include: {
      units: {
        where: {
          isActive: true,
          rentalListings: { none: {} },
        },
        orderBy: { unitNumber: "asc" },
        select: { id: true, unitNumber: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return properties
    .filter((p) => p.units.length > 0)
    .map((p) => ({
      propertyId: p.id,
      propertyName: p.name,
      units: p.units.map((u) => ({
        unitId: u.id,
        unitNumber: u.unitNumber,
        isPublishedListing: false,
      })),
    }));
}

/** @deprecated Use {@link listLegacyActiveUnitsWithoutListingHistory}. */
export async function listLegacyActivePropertyUnitSubmitOptions(
  db: Db = prisma,
): Promise<LeasingSubmitOption[]> {
  return listLegacyActiveUnitsWithoutListingHistory(db);
}

/**
 * Public portal property/unit options for viewing and application forms.
 *
 * 1. Always include published listings (active property + unit).
 * 2. When RENTAL_LISTING_PUBLIC_FALLBACK is enabled (default), also include
 *    legacy active units that have zero listing history.
 * 3. Merge per unit so published + untouched legacy units coexist.
 */
export async function listPublicLeasingSubmitOptions(
  db: Db = prisma,
): Promise<LeasingSubmitOption[]> {
  const published = await listPublishedRentalListingSubmitOptions(db);

  if (!isRentalListingPublicFallbackEnabled()) {
    return published;
  }

  const legacy = await listLegacyActiveUnitsWithoutListingHistory(db);
  return mergeSubmitOptions([...published, ...legacy]);
}

/** Ensures the property belongs to the public portal org before public intake. */
export async function assertPropertyInPublicPortalOrg(
  propertyId: string,
  db: Db = prisma,
): Promise<void> {
  const org = await getPublicPortalOrganization(db);
  if (!org) {
    throw new NotFoundError("Property not found or inactive");
  }

  const property = await db.property.findFirst({
    where: { id: propertyId, organizationId: org.id, isActive: true },
    select: { id: true },
  });
  if (!property) {
    throw new NotFoundError("Property not found or inactive");
  }
}

/** Active unit on a public portal property (call after {@link assertPropertyInPublicPortalOrg}). */
export async function assertUnitInPublicPortalProperty(
  propertyId: string,
  unitId: string,
  db: Db = prisma,
): Promise<void> {
  const unit = await db.unit.findFirst({
    where: { id: unitId, propertyId, isActive: true },
    select: { id: true },
  });
  if (!unit) {
    throw new NotFoundError("Unit not found, inactive, or not on this property");
  }
}
