import type { PrismaClient, RentalListing } from "@prisma/client";
import { NotFoundError } from "@/lib/services/errors";

/**
 * Validates a public-submitted listing id against property/unit and public availability.
 * Returns null when no listing id is provided (legacy fallback path).
 */
export async function resolvePublicRentalListingAttribution(
  prisma: PrismaClient,
  input: {
    rentalListingId?: string | null;
    propertyId: string;
    unitId?: string | null;
  },
): Promise<RentalListing | null> {
  const listingId = input.rentalListingId?.trim() || null;
  if (!listingId) return null;

  const listing = await prisma.rentalListing.findUnique({
    where: { id: listingId },
  });
  if (!listing) {
    throw new NotFoundError("Rental listing not found");
  }
  if (listing.propertyId !== input.propertyId) {
    throw new Error("Rental listing does not match the selected property");
  }
  if (input.unitId && listing.unitId !== input.unitId) {
    throw new Error("Rental listing does not match the selected unit");
  }
  if (!input.unitId) {
    throw new Error("Unit is required when submitting from a rental listing");
  }
  if (listing.status !== "PUBLISHED") {
    throw new Error("This rental listing is not currently available");
  }

  const property = await prisma.property.findFirst({
    where: { id: listing.propertyId, isActive: true },
    select: { id: true, organizationId: true },
  });
  if (!property) {
    throw new NotFoundError("Property not found or inactive");
  }
  if (listing.organizationId !== property.organizationId) {
    throw new Error("Rental listing does not match the selected property");
  }

  const unit = await prisma.unit.findFirst({
    where: { id: listing.unitId, propertyId: listing.propertyId, isActive: true },
    select: { id: true },
  });
  if (!unit) {
    throw new NotFoundError("Unit not found, inactive, or not on this property");
  }

  return listing;
}

/**
 * Resolves listing attribution for a public application start.
 * Prefers an explicit listing id; otherwise inherits from a linked prospect.
 * Does not guess from currently open listings.
 */
export async function resolveApplicationListingAttribution(
  prisma: PrismaClient,
  input: {
    rentalListingId?: string | null;
    propertyId: string;
    unitId: string;
    prospectRentalListingId?: string | null;
  },
): Promise<string | null> {
  if (input.rentalListingId?.trim()) {
    const listing = await resolvePublicRentalListingAttribution(prisma, {
      rentalListingId: input.rentalListingId,
      propertyId: input.propertyId,
      unitId: input.unitId,
    });
    return listing?.id ?? null;
  }

  const fromProspect = input.prospectRentalListingId?.trim() || null;
  if (!fromProspect) return null;

  const listing = await prisma.rentalListing.findUnique({
    where: { id: fromProspect },
    select: { id: true, propertyId: true, unitId: true },
  });
  if (!listing) return null;
  if (listing.propertyId !== input.propertyId || listing.unitId !== input.unitId) {
    return null;
  }
  return listing.id;
}
