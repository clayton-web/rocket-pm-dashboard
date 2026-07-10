import type { PrismaClient, TenantPlacement } from "@prisma/client";
import {
  getApplicationConversionPolicy,
  PlacementOnlyConversionBlockedError,
} from "@/lib/leasing/application-conversion-policy";
import {
  closeRentalListingForLeasingOutcome,
  resolveListingForOutcomeClose,
} from "@/lib/leasing/leasing-outcome-listing";
import { toDateOnlyUTC } from "@/lib/leasing/notice-rules";
import { logPropertyActivity, pickForAudit } from "./activityLog.service";
import { ForbiddenError, NotFoundError } from "./errors";
import { requirePropertyManagerAccess, requireStaff } from "./property-access";
import type { StaffContext } from "./staff-context";

export class PlacementCompletionNotAllowedError extends Error {
  readonly code = "PLACEMENT_COMPLETION_NOT_ALLOWED";

  constructor(message: string) {
    super(message);
    this.name = "PlacementCompletionNotAllowedError";
  }
}

export class ListingSelectionRequiredError extends Error {
  readonly code = "LISTING_SELECTION_REQUIRED";
  readonly candidates: { id: string; headline: string | null; status: string }[];

  constructor(candidates: { id: string; headline: string | null; status: string }[]) {
    super(
      "Select which rental listing to close — more than one open listing exists for this unit and the application has no listing attribution.",
    );
    this.name = "ListingSelectionRequiredError";
    this.candidates = candidates;
  }
}

export type CompleteTenantPlacementInput = {
  applicationId: string;
  leaseStartDate: Date;
  leaseEndDate?: Date | null;
  monthlyRent: number;
  landlordHandoffNotes?: string | null;
  internalNotes?: string | null;
  /** Required only when the application has no listing attribution and multiple open listings exist. */
  rentalListingId?: string | null;
};

function assertValidPlacementDates(start: Date, end: Date | null | undefined): void {
  if (Number.isNaN(start.getTime())) throw new Error("Lease start date is invalid");
  if (end != null) {
    if (Number.isNaN(end.getTime())) throw new Error("Lease end date is invalid");
    if (end.getTime() < start.getTime()) {
      throw new Error("Lease end date must be on or after the lease start date");
    }
  }
}

/**
 * Records a placement-only completion for an approved application.
 * Does not create Tenancy / TenancyContact / portal access.
 * Closes the attributed (or unambiguously open) listing in the same transaction.
 */
export async function completeTenantPlacement(
  prisma: PrismaClient,
  principal: StaffContext,
  input: CompleteTenantPlacementInput,
): Promise<TenantPlacement> {
  requireStaff(principal);

  if (!(input.monthlyRent > 0) || !Number.isFinite(input.monthlyRent)) {
    throw new Error("Monthly rent must be a positive number");
  }
  assertValidPlacementDates(input.leaseStartDate, input.leaseEndDate ?? null);

  return prisma.$transaction(async (tx) => {
    const db = tx as PrismaClient;

    const application = await db.application.findUnique({
      where: { id: input.applicationId },
      include: {
        property: {
          select: {
            id: true,
            organizationId: true,
            serviceRelationship: true,
          },
        },
        tenancy: { select: { id: true } },
        tenantPlacement: { select: { id: true } },
      },
    });
    if (!application) throw new NotFoundError("Application not found");
    if (application.property.organizationId !== principal.organizationId) {
      throw new NotFoundError("Application not found");
    }

    await requirePropertyManagerAccess(db, principal, application.propertyId);

    if (application.tenantPlacement) {
      throw new Error("A placement completion already exists for this application");
    }
    if (application.tenancy) {
      throw new Error("This application already has a managed tenancy");
    }

    const policy = getApplicationConversionPolicy({
      applicationStatus: application.status,
      hasTenancy: false,
      serviceRelationship: application.property.serviceRelationship,
    });

    if (application.property.serviceRelationship !== "PLACEMENT_ONLY") {
      throw new PlacementCompletionNotAllowedError(
        "Placement completion is only available for Tenant Placement Only properties. Use managed tenancy conversion for managed or pre-management properties.",
      );
    }
    if (application.status !== "approved") {
      throw new Error("Application must be approved before completing placement");
    }
    // Placement-only approved apps are not "allowed" for managed conversion — expected.
    if (policy.recommendedAction !== "await_placement_completion") {
      throw new PlacementCompletionNotAllowedError(
        policy.reason ?? "Placement completion is not available for this application",
      );
    }

    const listingResolution = await resolveListingForOutcomeClose(db, {
      propertyId: application.propertyId,
      unitId: application.unitId,
      applicationRentalListingId: application.rentalListingId,
      explicitRentalListingId: input.rentalListingId,
    });

    if (listingResolution.kind === "needs_selection") {
      throw new ListingSelectionRequiredError(listingResolution.candidates);
    }

    const listingIdToClose =
      listingResolution.kind === "close"
        ? listingResolution.listing.id
        : listingResolution.kind === "already_closed"
          ? listingResolution.listingId
          : application.rentalListingId;

    const placement = await db.tenantPlacement.create({
      data: {
        organizationId: application.property.organizationId,
        propertyId: application.propertyId,
        unitId: application.unitId,
        applicationId: application.id,
        rentalListingId: listingIdToClose,
        status: "completed",
        leaseStartDate: input.leaseStartDate,
        leaseEndDate: input.leaseEndDate ?? null,
        monthlyRent: input.monthlyRent,
        completedAt: new Date(),
        landlordHandoffNotes: input.landlordHandoffNotes?.trim() || null,
        internalNotes: input.internalNotes?.trim() || null,
        completedByUserId: principal.userId,
        rentalListingClosed: false,
      },
    });

    let listingClosed = false;
    if (listingResolution.kind === "close") {
      const closeResult = await closeRentalListingForLeasingOutcome(
        db,
        principal,
        listingResolution.listing.id,
        { reason: "tenant_placement_completed", applicationId: application.id },
      );
      listingClosed = closeResult.closed;
    } else if (listingResolution.kind === "already_closed") {
      listingClosed = false;
    }

    const row =
      listingClosed || listingIdToClose
        ? await db.tenantPlacement.update({
            where: { id: placement.id },
            data: {
              rentalListingClosed: listingClosed || listingResolution.kind === "already_closed",
              rentalListingId: listingIdToClose,
            },
          })
        : placement;

    await logPropertyActivity(
      db,
      principal,
      application.propertyId,
      "TenantPlacement",
      row.id,
      "tenant_placement.completed",
      {
        newValues: {
          ...pickForAudit(row, [
            "applicationId",
            "status",
            "leaseStartDate",
            "leaseEndDate",
            "monthlyRent",
            "rentalListingId",
            "rentalListingClosed",
          ]),
          serviceRelationship: "PLACEMENT_ONLY",
        },
      },
    );

    return row;
  });
}

export async function getTenantPlacementByApplicationId(
  prisma: PrismaClient,
  principal: StaffContext,
  applicationId: string,
): Promise<TenantPlacement | null> {
  requireStaff(principal);
  const row = await prisma.tenantPlacement.findUnique({
    where: { applicationId },
  });
  if (!row) return null;
  if (row.organizationId !== principal.organizationId) {
    throw new NotFoundError("Placement not found");
  }
  await requirePropertyManagerAccess(prisma, principal, row.propertyId);
  return row;
}

export async function listTenantPlacementsForProperty(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
): Promise<TenantPlacement[]> {
  requireStaff(principal);
  await requirePropertyManagerAccess(prisma, principal, propertyId);
  return prisma.tenantPlacement.findMany({
    where: { propertyId },
    orderBy: { completedAt: "desc" },
  });
}

/** Parse YYYY-MM-DD form dates for placement completion. */
export function parsePlacementDateOnly(value: string, field: string): Date {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`${field} must be YYYY-MM-DD`);
  }
  const d = toDateOnlyUTC(trimmed);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ${field}`);
  return d;
}

// Re-export for callers that catch conversion-style errors by mistake.
export { PlacementOnlyConversionBlockedError, ForbiddenError };
