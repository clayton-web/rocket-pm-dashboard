/**
 * RentalListing service — staff-managed public advertisements for units.
 *
 * Property.isActive / Unit.isActive remain operational portfolio flags.
 * Only status=PUBLISHED listings are publicly visible (see public-intake).
 *
 * One open listing (DRAFT/PUBLISHED/PAUSED) per unit is enforced in transactions.
 * Prisma cannot express a partial unique index for open statuses; CLOSED history
 * is retained so units can be relisted later.
 */
import {
  Prisma,
  type PrismaClient,
  type RentalListing,
  type RentalListingStatus,
} from "@prisma/client";
import {
  ACTIVE_TENANCY_BLOCKS_PUBLISH_MESSAGE,
  isPublishBlockingTenancyStatus,
} from "@/lib/leasing/rental-listing-active-tenancy";
import {
  isOpenRentalListingStatus,
  isPubliclyVisibleRentalListingStatus,
  OPEN_RENTAL_LISTING_STATUSES,
} from "@/lib/leasing/rental-listing-status";
import { logPropertyActivity, pickForAudit } from "./activityLog.service";
import { NotFoundError } from "./errors";
import {
  ForbiddenError,
  hasOrgWidePropertyRights,
  requirePropertyAccess,
  requirePropertyManagerAccess,
  requireStaff,
} from "./property-access";
import type { StaffContext } from "./staff-context";

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

export type RentalListingWritableFields = {
  monthlyRent?: number | null;
  availableDate?: Date | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  approxSqft?: number | null;
  headline?: string | null;
  description?: string | null;
  petPolicy?: string | null;
  parkingDetails?: string | null;
  utilitiesDetails?: string | null;
  viewingInstructions?: string | null;
};

export type CreateRentalListingDraftInput = RentalListingWritableFields & {
  propertyId: string;
  unitId: string;
};

type UnitPropertyRow = {
  id: string;
  propertyId: string;
  unitNumber: string;
  bedrooms: number | null;
  isActive: boolean;
  property: {
    id: string;
    organizationId: string;
    isActive: boolean;
    bedrooms: number | null;
    bathrooms: Prisma.Decimal | null;
    approxSqft: number | null;
    name: string;
    streetLine1: string;
  };
};

async function requireListingManagerAccess(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
): Promise<void> {
  requireStaff(principal);
  if (hasOrgWidePropertyRights(principal)) {
    await requirePropertyAccess(prisma, principal, propertyId);
    return;
  }
  await requirePropertyManagerAccess(prisma, principal, propertyId);
}

async function loadUnitWithProperty(
  prisma: PrismaClient,
  unitId: string,
): Promise<UnitPropertyRow> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: {
      id: true,
      propertyId: true,
      unitNumber: true,
      bedrooms: true,
      isActive: true,
      property: {
        select: {
          id: true,
          organizationId: true,
          isActive: true,
          bedrooms: true,
          bathrooms: true,
          approxSqft: true,
          name: true,
          streetLine1: true,
        },
      },
    },
  });
  if (!unit) throw new NotFoundError("Unit not found");
  return unit;
}

function assertUnitMatchesProperty(unit: UnitPropertyRow, propertyId: string): void {
  if (unit.propertyId !== propertyId) {
    throw new Error("Unit does not belong to this property");
  }
}

function assertUnitInPrincipalOrg(unit: UnitPropertyRow, principal: StaffContext): void {
  if (unit.property.organizationId !== principal.organizationId) {
    throw new ForbiddenError("No access to this property");
  }
}

function decimalFromNumber(value: number | null | undefined): Prisma.Decimal | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Prisma.Decimal(value);
}

function writableToPrismaData(
  input: RentalListingWritableFields,
): Prisma.RentalListingUncheckedUpdateInput {
  const data: Prisma.RentalListingUncheckedUpdateInput = {};
  if (input.monthlyRent !== undefined) {
    data.monthlyRent = decimalFromNumber(input.monthlyRent) ?? null;
  }
  if (input.availableDate !== undefined) data.availableDate = input.availableDate;
  if (input.bedrooms !== undefined) data.bedrooms = input.bedrooms;
  if (input.bathrooms !== undefined) {
    data.bathrooms = decimalFromNumber(input.bathrooms) ?? null;
  }
  if (input.approxSqft !== undefined) data.approxSqft = input.approxSqft;
  if (input.headline !== undefined) data.headline = input.headline?.trim() || null;
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.petPolicy !== undefined) data.petPolicy = input.petPolicy?.trim() || null;
  if (input.parkingDetails !== undefined) {
    data.parkingDetails = input.parkingDetails?.trim() || null;
  }
  if (input.utilitiesDetails !== undefined) {
    data.utilitiesDetails = input.utilitiesDetails?.trim() || null;
  }
  if (input.viewingInstructions !== undefined) {
    data.viewingInstructions = input.viewingInstructions?.trim() || null;
  }
  return data;
}

/**
 * Prefill listing snapshot fields from property/unit profile at draft creation.
 * Values are copied onto the listing so later profile edits do not rewrite history.
 */
function profilePrefillFromUnit(unit: UnitPropertyRow): RentalListingWritableFields {
  return {
    bedrooms: unit.bedrooms ?? unit.property.bedrooms ?? null,
    bathrooms: unit.property.bathrooms != null ? Number(unit.property.bathrooms) : null,
    approxSqft: unit.property.approxSqft ?? null,
    headline: unit.property.streetLine1?.trim() || unit.property.name?.trim() || null,
  };
}

async function findOpenListingForUnit(
  prisma: PrismaClient,
  unitId: string,
  excludeListingId?: string,
): Promise<RentalListing | null> {
  return prisma.rentalListing.findFirst({
    where: {
      unitId,
      status: { in: [...OPEN_RENTAL_LISTING_STATUSES] },
      ...(excludeListingId ? { id: { not: excludeListingId } } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

async function assertNoOtherOpenListing(
  prisma: PrismaClient,
  unitId: string,
  excludeListingId?: string,
): Promise<void> {
  const existing = await findOpenListingForUnit(prisma, unitId, excludeListingId);
  if (existing) {
    throw new Error(
      "This unit already has an open listing (draft, published, or paused). Close it before creating another.",
    );
  }
}

/**
 * Active/in-progress tenancy on the unit blocks publish (not draft creation).
 * See PUBLISH_BLOCKING_TENANCY_STATUSES.
 */
async function assertUnitHasNoPublishBlockingTenancy(
  prisma: PrismaClient,
  unitId: string,
): Promise<void> {
  const tenancy = await prisma.tenancy.findFirst({
    where: {
      unitId,
      status: { in: [...PUBLISH_BLOCKING_TENANCY_STATUSES_FOR_QUERY] },
    },
    select: { id: true, status: true },
  });
  if (tenancy && isPublishBlockingTenancyStatus(tenancy.status)) {
    throw new Error(ACTIVE_TENANCY_BLOCKS_PUBLISH_MESSAGE);
  }
}

const PUBLISH_BLOCKING_TENANCY_STATUSES_FOR_QUERY = [
  "pending_move_in",
  "active",
  "notice_received",
  "move_out_scheduled",
  "inspection_scheduled",
  "inspection_completed",
] as const;

function assertListingEditable(status: RentalListingStatus): void {
  if (status === "CLOSED") {
    throw new Error("Closed listings cannot be edited. Create a new draft to relist this unit.");
  }
  if (status === "PUBLISHED") {
    throw new Error("Pause or close this listing before editing listing details.");
  }
}

function validateReadyToPublish(listing: RentalListing, unit: UnitPropertyRow): void {
  if (!unit.property.isActive) {
    throw new Error("Property must be operationally active before publishing a listing.");
  }
  if (!unit.isActive) {
    throw new Error("Unit must be operationally active before publishing a listing.");
  }
  if (listing.monthlyRent == null || Number(listing.monthlyRent) <= 0) {
    throw new Error("Monthly rent must be greater than zero to publish.");
  }
  if (!listing.availableDate) {
    throw new Error("Available date is required to publish.");
  }
  const headline = listing.headline?.trim();
  if (!headline) {
    throw new Error("Headline is required to publish.");
  }
  const description = listing.description?.trim();
  if (!description) {
    throw new Error("Description is required to publish.");
  }
  if (listing.bedrooms == null) {
    throw new Error("Bedrooms are required to publish.");
  }
  if (listing.bathrooms == null) {
    throw new Error("Bathrooms are required to publish.");
  }
}

export function isRentalListingPubliclyVisible(listing: Pick<RentalListing, "status">): boolean {
  return isPubliclyVisibleRentalListingStatus(listing.status);
}

export async function getRentalListingById(
  prisma: PrismaClient,
  principal: StaffContext,
  listingId: string,
): Promise<RentalListing> {
  requireStaff(principal);
  const listing = await prisma.rentalListing.findUnique({ where: { id: listingId } });
  if (!listing) throw new NotFoundError("Listing not found");
  if (listing.organizationId !== principal.organizationId) {
    throw new ForbiddenError("No access to this listing");
  }
  await requirePropertyAccess(prisma, principal, listing.propertyId);
  return listing;
}

export async function listRentalListingsForProperty(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
): Promise<RentalListing[]> {
  requireStaff(principal);
  await requirePropertyAccess(prisma, principal, propertyId);
  return prisma.rentalListing.findMany({
    where: {
      propertyId,
      organizationId: principal.organizationId,
    },
    orderBy: [{ updatedAt: "desc" }],
  });
}

export async function getOpenRentalListingForUnit(
  prisma: PrismaClient,
  principal: StaffContext,
  unitId: string,
): Promise<RentalListing | null> {
  requireStaff(principal);
  const unit = await loadUnitWithProperty(prisma, unitId);
  assertUnitInPrincipalOrg(unit, principal);
  await requirePropertyAccess(prisma, principal, unit.propertyId);
  return findOpenListingForUnit(prisma, unitId);
}

export async function createRentalListingDraft(
  prisma: PrismaClient,
  principal: StaffContext,
  input: CreateRentalListingDraftInput,
): Promise<RentalListing> {
  requireStaff(principal);
  await requireListingManagerAccess(prisma, principal, input.propertyId);

  const unit = await loadUnitWithProperty(prisma, input.unitId);
  assertUnitMatchesProperty(unit, input.propertyId);
  assertUnitInPrincipalOrg(unit, principal);

  return prisma.$transaction(async (tx) => {
    const db = tx as PrismaClient;
    await assertNoOtherOpenListing(db, input.unitId);

    const prefill = profilePrefillFromUnit(unit);
    const merged: RentalListingWritableFields = {
      ...prefill,
      ...Object.fromEntries(
        Object.entries(input).filter(
          ([key, value]) =>
            key !== "propertyId" &&
            key !== "unitId" &&
            value !== undefined,
        ),
      ),
    };

    const row = await db.rentalListing.create({
      data: {
        organizationId: unit.property.organizationId,
        propertyId: input.propertyId,
        unitId: input.unitId,
        status: "DRAFT",
        monthlyRent: decimalFromNumber(merged.monthlyRent ?? null) ?? null,
        availableDate: merged.availableDate ?? null,
        bedrooms: merged.bedrooms ?? null,
        bathrooms: decimalFromNumber(merged.bathrooms ?? null) ?? null,
        approxSqft: merged.approxSqft ?? null,
        headline: merged.headline?.trim() || null,
        description: merged.description?.trim() || null,
        petPolicy: merged.petPolicy?.trim() || null,
        parkingDetails: merged.parkingDetails?.trim() || null,
        utilitiesDetails: merged.utilitiesDetails?.trim() || null,
        viewingInstructions: merged.viewingInstructions?.trim() || null,
        createdByUserId: principal.userId,
        updatedByUserId: principal.userId,
      },
    });

    await logPropertyActivity(
      db,
      principal,
      input.propertyId,
      "RentalListing",
      row.id,
      "rental_listing.created",
      {
        newValues: pickForAudit(row, [...LISTING_AUDIT_FIELDS]),
      },
    );
    return row;
  });
}

export async function updateRentalListing(
  prisma: PrismaClient,
  principal: StaffContext,
  listingId: string,
  input: RentalListingWritableFields,
): Promise<RentalListing> {
  requireStaff(principal);
  const existing = await getRentalListingById(prisma, principal, listingId);
  await requireListingManagerAccess(prisma, principal, existing.propertyId);
  assertListingEditable(existing.status);

  const data = writableToPrismaData(input);
  if (Object.keys(data).length === 0) return existing;

  const row = await prisma.rentalListing.update({
    where: { id: listingId },
    data: {
      ...data,
      updatedByUserId: principal.userId,
    },
  });
  await logPropertyActivity(
    prisma,
    principal,
    existing.propertyId,
    "RentalListing",
    listingId,
    "rental_listing.updated",
    {
      oldValues: pickForAudit(existing, [...LISTING_AUDIT_FIELDS]),
      newValues: pickForAudit(row, [...LISTING_AUDIT_FIELDS]),
    },
  );
  return row;
}

export async function publishRentalListing(
  prisma: PrismaClient,
  principal: StaffContext,
  listingId: string,
): Promise<RentalListing> {
  requireStaff(principal);
  return prisma.$transaction(async (tx) => {
    const db = tx as PrismaClient;
    const existing = await db.rentalListing.findUnique({ where: { id: listingId } });
    if (!existing) throw new NotFoundError("Listing not found");
    if (existing.organizationId !== principal.organizationId) {
      throw new ForbiddenError("No access to this listing");
    }
    await requireListingManagerAccess(db, principal, existing.propertyId);

    if (existing.status === "CLOSED") {
      throw new Error("Closed listings cannot be published. Create a new draft to relist.");
    }
    if (existing.status === "PUBLISHED") {
      return existing;
    }
    if (existing.status !== "DRAFT" && existing.status !== "PAUSED") {
      throw new Error("Only draft or paused listings can be published.");
    }

    const unit = await loadUnitWithProperty(db, existing.unitId);
    assertUnitMatchesProperty(unit, existing.propertyId);
    await assertNoOtherOpenListing(db, existing.unitId, existing.id);
    await assertUnitHasNoPublishBlockingTenancy(db, existing.unitId);
    validateReadyToPublish(existing, unit);

    const now = new Date();
    const row = await db.rentalListing.update({
      where: { id: listingId },
      data: {
        status: "PUBLISHED",
        publishedAt: existing.publishedAt ?? now,
        pausedAt: null,
        closedAt: null,
        updatedByUserId: principal.userId,
      },
    });

    await logPropertyActivity(
      db,
      principal,
      existing.propertyId,
      "RentalListing",
      listingId,
      "rental_listing.published",
      {
        oldValues: pickForAudit(existing, [...LISTING_AUDIT_FIELDS]),
        newValues: pickForAudit(row, [...LISTING_AUDIT_FIELDS]),
      },
    );
    return row;
  });
}

export async function pauseRentalListing(
  prisma: PrismaClient,
  principal: StaffContext,
  listingId: string,
): Promise<RentalListing> {
  requireStaff(principal);
  return prisma.$transaction(async (tx) => {
    const db = tx as PrismaClient;
    const existing = await db.rentalListing.findUnique({ where: { id: listingId } });
    if (!existing) throw new NotFoundError("Listing not found");
    if (existing.organizationId !== principal.organizationId) {
      throw new ForbiddenError("No access to this listing");
    }
    await requireListingManagerAccess(db, principal, existing.propertyId);

    if (existing.status !== "PUBLISHED") {
      throw new Error("Only published listings can be paused.");
    }

    const now = new Date();
    const row = await db.rentalListing.update({
      where: { id: listingId },
      data: {
        status: "PAUSED",
        pausedAt: now,
        updatedByUserId: principal.userId,
      },
    });

    await logPropertyActivity(
      db,
      principal,
      existing.propertyId,
      "RentalListing",
      listingId,
      "rental_listing.paused",
      {
        oldValues: pickForAudit(existing, [...LISTING_AUDIT_FIELDS]),
        newValues: pickForAudit(row, [...LISTING_AUDIT_FIELDS]),
      },
    );
    return row;
  });
}

/** Return a paused listing to draft for further edits (still open; not publicly visible). */
export async function returnRentalListingToDraft(
  prisma: PrismaClient,
  principal: StaffContext,
  listingId: string,
): Promise<RentalListing> {
  requireStaff(principal);
  return prisma.$transaction(async (tx) => {
    const db = tx as PrismaClient;
    const existing = await db.rentalListing.findUnique({ where: { id: listingId } });
    if (!existing) throw new NotFoundError("Listing not found");
    if (existing.organizationId !== principal.organizationId) {
      throw new ForbiddenError("No access to this listing");
    }
    await requireListingManagerAccess(db, principal, existing.propertyId);

    if (existing.status !== "PAUSED") {
      throw new Error("Only paused listings can be returned to draft.");
    }

    const row = await db.rentalListing.update({
      where: { id: listingId },
      data: {
        status: "DRAFT",
        pausedAt: null,
        updatedByUserId: principal.userId,
      },
    });

    await logPropertyActivity(
      db,
      principal,
      existing.propertyId,
      "RentalListing",
      listingId,
      "rental_listing.returned_to_draft",
      {
        oldValues: pickForAudit(existing, [...LISTING_AUDIT_FIELDS]),
        newValues: pickForAudit(row, [...LISTING_AUDIT_FIELDS]),
      },
    );
    return row;
  });
}

export async function closeRentalListing(
  prisma: PrismaClient,
  principal: StaffContext,
  listingId: string,
): Promise<RentalListing> {
  requireStaff(principal);
  return prisma.$transaction(async (tx) => {
    const db = tx as PrismaClient;
    const existing = await db.rentalListing.findUnique({ where: { id: listingId } });
    if (!existing) throw new NotFoundError("Listing not found");
    if (existing.organizationId !== principal.organizationId) {
      throw new ForbiddenError("No access to this listing");
    }
    await requireListingManagerAccess(db, principal, existing.propertyId);

    if (existing.status === "CLOSED") {
      return existing;
    }
    if (!isOpenRentalListingStatus(existing.status)) {
      throw new Error("Listing cannot be closed from its current status.");
    }

    const now = new Date();
    const row = await db.rentalListing.update({
      where: { id: listingId },
      data: {
        status: "CLOSED",
        closedAt: now,
        pausedAt: existing.status === "PAUSED" ? existing.pausedAt : null,
        updatedByUserId: principal.userId,
      },
    });

    await logPropertyActivity(
      db,
      principal,
      existing.propertyId,
      "RentalListing",
      listingId,
      "rental_listing.closed",
      {
        oldValues: pickForAudit(existing, [...LISTING_AUDIT_FIELDS]),
        newValues: pickForAudit(row, [...LISTING_AUDIT_FIELDS]),
      },
    );
    return row;
  });
}

/** Republish a paused listing (alias of publish for PAUSED → PUBLISHED). */
export async function republishRentalListing(
  prisma: PrismaClient,
  principal: StaffContext,
  listingId: string,
): Promise<RentalListing> {
  return publishRentalListing(prisma, principal, listingId);
}
