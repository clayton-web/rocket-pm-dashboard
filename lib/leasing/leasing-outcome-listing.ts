import type { PrismaClient, RentalListing } from "@prisma/client";
import { logPropertyActivity, pickForAudit } from "@/lib/services/activityLog.service";
import type { StaffContext } from "@/lib/services/staff-context";

const LISTING_AUDIT_FIELDS = [
  "status",
  "monthlyRent",
  "availableDate",
  "bedrooms",
  "approxSqft",
  "headline",
  "publishedAt",
  "pausedAt",
  "closedAt",
] as const;

export type ResolveListingForOutcomeCloseResult =
  | { kind: "close"; listing: Pick<RentalListing, "id" | "status" | "propertyId" | "unitId" | "organizationId" | "pausedAt" | "closedAt" | "monthlyRent" | "availableDate" | "bedrooms" | "approxSqft" | "headline" | "publishedAt"> }
  | { kind: "already_closed"; listingId: string }
  | { kind: "none" }
  | { kind: "needs_selection"; candidates: { id: string; headline: string | null; status: string }[] };

/**
 * Deterministic listing selection for outcome closure.
 * - Uses application.rentalListingId when set (never guesses another listing).
 * - For unattributed apps: closes only when exactly one open listing exists on the unit.
 * - If multiple open listings exist (should be rare), requires explicit staff selection.
 */
export async function resolveListingForOutcomeClose(
  prisma: PrismaClient,
  input: {
    propertyId: string;
    unitId: string;
    applicationRentalListingId?: string | null;
    explicitRentalListingId?: string | null;
  },
): Promise<ResolveListingForOutcomeCloseResult> {
  const attributedId =
    input.explicitRentalListingId?.trim() ||
    input.applicationRentalListingId?.trim() ||
    null;

  if (attributedId) {
    const listing = await prisma.rentalListing.findUnique({
      where: { id: attributedId },
    });
    if (!listing) return { kind: "none" };
    if (listing.propertyId !== input.propertyId || listing.unitId !== input.unitId) {
      throw new Error("Selected rental listing does not match this application’s property and unit");
    }
    if (listing.status === "CLOSED") {
      return { kind: "already_closed", listingId: listing.id };
    }
    return { kind: "close", listing };
  }

  const open = await prisma.rentalListing.findMany({
    where: {
      propertyId: input.propertyId,
      unitId: input.unitId,
      status: { in: ["DRAFT", "PUBLISHED", "PAUSED"] },
    },
    select: { id: true, headline: true, status: true },
    orderBy: { updatedAt: "desc" },
  });

  if (open.length === 0) return { kind: "none" };
  if (open.length > 1) {
    return { kind: "needs_selection", candidates: open };
  }

  const listing = await prisma.rentalListing.findUnique({ where: { id: open[0].id } });
  if (!listing) return { kind: "none" };
  return { kind: "close", listing };
}

/**
 * Closes a listing inside an existing transaction. Idempotent for already-CLOSED.
 * Does not re-check listing-manager permissions — caller must authorize the outcome action.
 */
export async function closeRentalListingForLeasingOutcome(
  prisma: PrismaClient,
  principal: StaffContext,
  listingId: string,
  meta?: { reason: string; applicationId: string },
): Promise<{ closed: boolean; listingId: string }> {
  const existing = await prisma.rentalListing.findUnique({ where: { id: listingId } });
  if (!existing) {
    throw new Error("Rental listing not found");
  }
  if (existing.organizationId !== principal.organizationId) {
    throw new Error("Rental listing is not in the active organization");
  }
  if (existing.status === "CLOSED") {
    return { closed: false, listingId: existing.id };
  }

  const now = new Date();
  const row = await prisma.rentalListing.update({
    where: { id: listingId },
    data: {
      status: "CLOSED",
      closedAt: now,
      pausedAt: existing.status === "PAUSED" ? existing.pausedAt : null,
      updatedByUserId: principal.userId,
    },
  });

  await logPropertyActivity(
    prisma,
    principal,
    existing.propertyId,
    "RentalListing",
    listingId,
    "rental_listing.closed",
    {
      oldValues: pickForAudit(existing, [...LISTING_AUDIT_FIELDS]),
      newValues: {
        ...pickForAudit(row, [...LISTING_AUDIT_FIELDS]),
        ...(meta
          ? { reason: meta.reason, applicationId: meta.applicationId }
          : {}),
      },
    },
  );

  return { closed: true, listingId: row.id };
}
