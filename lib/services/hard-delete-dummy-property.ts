import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { StaffContext } from "./staff-context";
import {
  requirePropertyManagerAccess,
  requireStaff,
} from "./property-access";
import { ForbiddenError, NotFoundError } from "./errors";

export const PROPERTY_HARD_DELETE_BLOCKED_MESSAGE =
  "This property cannot be deleted because it has related records. Deactivate it instead once archive/deactivate is available.";

export const PROPERTY_HARD_DELETE_CONFIRMATION_TEXT = "DELETE";

export type PropertyHardDeleteBlocker =
  | "tenancy"
  | "application"
  | "prospect"
  | "showing"
  | "signatureRequest"
  | "leaseSignature"
  | "document"
  | "applicationDocument"
  | "notice"
  | "maintenanceRequest"
  | "checklist"
  | "rentalListing"
  | "tenantPlacement";

export class PropertyHardDeleteBlockedError extends Error {
  readonly blockers: PropertyHardDeleteBlocker[];

  constructor(blockers: PropertyHardDeleteBlocker[]) {
    super(PROPERTY_HARD_DELETE_BLOCKED_MESSAGE);
    this.name = "PropertyHardDeleteBlockedError";
    this.blockers = blockers;
  }
}

export async function listPropertyHardDeleteBlockers(
  prisma: PrismaClient,
  propertyId: string,
): Promise<PropertyHardDeleteBlocker[]> {
  const [
    tenancyCount,
    applicationCount,
    prospectCount,
    showingCount,
    signatureRequestCount,
    leaseSignatureCount,
    documentCount,
    applicationDocumentCount,
    noticeCount,
    maintenanceRequestCount,
    checklistCount,
    rentalListingCount,
    tenantPlacementCount,
  ] = await Promise.all([
    prisma.tenancy.count({ where: { propertyId } }),
    prisma.application.count({ where: { propertyId } }),
    prisma.prospect.count({ where: { propertyId } }),
    prisma.showing.count({ where: { propertyId } }),
    prisma.signatureRequest.count({ where: { propertyId } }),
    prisma.leaseSignature.count({ where: { signatureRequest: { propertyId } } }),
    prisma.document.count({ where: { propertyId } }),
    prisma.applicationDocument.count({ where: { propertyId } }),
    prisma.notice.count({ where: { propertyId } }),
    prisma.maintenanceRequest.count({ where: { propertyId } }),
    prisma.checklist.count({ where: { propertyId } }),
    prisma.rentalListing.count({ where: { propertyId } }),
    prisma.tenantPlacement.count({ where: { propertyId } }),
  ]);

  const blockers: PropertyHardDeleteBlocker[] = [];
  if (tenancyCount > 0) blockers.push("tenancy");
  if (applicationCount > 0) blockers.push("application");
  if (prospectCount > 0) blockers.push("prospect");
  if (showingCount > 0) blockers.push("showing");
  if (signatureRequestCount > 0) blockers.push("signatureRequest");
  if (leaseSignatureCount > 0) blockers.push("leaseSignature");
  if (documentCount > 0) blockers.push("document");
  if (applicationDocumentCount > 0) blockers.push("applicationDocument");
  if (noticeCount > 0) blockers.push("notice");
  if (maintenanceRequestCount > 0) blockers.push("maintenanceRequest");
  if (checklistCount > 0) blockers.push("checklist");
  if (rentalListingCount > 0) blockers.push("rentalListing");
  if (tenantPlacementCount > 0) blockers.push("tenantPlacement");
  return blockers;
}

function isForeignKeyConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2003" || error.code === "P2014")
  );
}

/**
 * Test-stage hard delete for dummy properties only.
 * Blocks when leasing, documents, or other protected child records exist.
 */
export async function hardDeleteDummyProperty(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
): Promise<void> {
  requireStaff(principal);
  await requirePropertyManagerAccess(prisma, principal, propertyId);

  const property = await prisma.property.findFirst({
    where: { id: propertyId },
    select: { id: true, organizationId: true },
  });
  if (!property) throw new NotFoundError("Property not found");
  if (property.organizationId !== principal.organizationId) {
    throw new ForbiddenError("No access to this property");
  }

  const blockers = await listPropertyHardDeleteBlockers(prisma, propertyId);
  if (blockers.length > 0) {
    throw new PropertyHardDeleteBlockedError(blockers);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const txBlockers = await listPropertyHardDeleteBlockers(tx as PrismaClient, propertyId);
      if (txBlockers.length > 0) {
        throw new PropertyHardDeleteBlockedError(txBlockers);
      }
      await tx.property.delete({ where: { id: propertyId } });
    });
  } catch (error) {
    if (error instanceof PropertyHardDeleteBlockedError) {
      throw error;
    }
    if (isForeignKeyConstraintError(error)) {
      throw new PropertyHardDeleteBlockedError(["tenancy"]);
    }
    throw error;
  }
}
