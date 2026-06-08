import type {
  Prisma,
  PrismaClient,
  Prospect,
  ProspectStatus,
} from "@prisma/client";
import { toDateOnlyUTC } from "@/lib/leasing/notice-rules";
import type { StaffContext } from "./staff-context";
import { requireLeasingAccess, requireStaff } from "./property-access";
import { NotFoundError } from "./errors";
import { logPropertyActivity, pickForAudit } from "./activityLog.service";

export type SubmitPublicViewingRequestInput = {
  propertyId: string;
  unitId?: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  occupantCount: number;
  hasPets: boolean;
  petDetails?: string | null;
  smokerStatus: string;
  householdIncomeRange: string;
  desiredMoveInDate: Date;
  preferredViewingNotes?: string | null;
  message?: string | null;
};

/** @deprecated Use SubmitPublicViewingRequestInput — kept for type re-exports during transition. */
export type CreatePublicProspectInput = SubmitPublicViewingRequestInput;

export type UpdateProspectInput = {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  message?: string | null;
  unitId?: string | null;
  status?: ProspectStatus;
};

function trimRequiredEmail(email: string): string {
  const v = email.trim().toLowerCase();
  if (!v) throw new Error("Email is required");
  return v;
}

function buildIntakeData(
  input: SubmitPublicViewingRequestInput,
  unitId: string | null,
  email: string,
): Prisma.ProspectUncheckedCreateInput {
  return {
    propertyId: input.propertyId,
    unitId,
    email,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: input.phone?.trim() || null,
    occupantCount: input.occupantCount,
    hasPets: input.hasPets,
    petDetails: input.hasPets ? input.petDetails?.trim() || null : null,
    smokerStatus: input.smokerStatus,
    householdIncomeRange: input.householdIncomeRange,
    desiredMoveInDate: input.desiredMoveInDate,
    preferredViewingNotes: input.preferredViewingNotes?.trim() || null,
    message: input.message?.trim() || null,
    status: "new",
  };
}

async function resolveUnitId(
  prisma: PrismaClient,
  propertyId: string,
  unitId: string | null | undefined,
): Promise<string | null> {
  if (!unitId) return null;
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, propertyId, isActive: true },
  });
  if (!unit) throw new NotFoundError("Unit not found, inactive, or not on this property");
  return unit.id;
}

/**
 * Public viewing request — creates or updates a `new` prospect for the same property + email.
 */
export async function submitPublicViewingRequest(
  prisma: PrismaClient,
  input: SubmitPublicViewingRequestInput,
): Promise<Prospect> {
  const property = await prisma.property.findFirst({
    where: { id: input.propertyId, isActive: true },
  });
  if (!property) throw new NotFoundError("Property not found or inactive");

  const unitId = await resolveUnitId(prisma, input.propertyId, input.unitId);
  const email = trimRequiredEmail(input.email);
  const data = buildIntakeData(input, unitId, email);

  const existing = await prisma.prospect.findFirst({
    where: {
      propertyId: input.propertyId,
      email,
      status: "new",
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return prisma.prospect.update({
      where: { id: existing.id },
      data: {
        ...data,
        status: "new",
      },
    });
  }

  return prisma.prospect.create({ data });
}

/** Alias for {@link submitPublicViewingRequest}. */
export const createPublicProspect = submitPublicViewingRequest;

async function getProspectRow(prisma: PrismaClient, prospectId: string): Promise<Prospect> {
  const row = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!row) throw new NotFoundError("Prospect not found");
  return row;
}

/** Staff with leasing access to the prospect’s property. */
export async function getProspectById(
  prisma: PrismaClient,
  principal: StaffContext,
  prospectId: string,
): Promise<Prospect> {
  requireStaff(principal);
  const row = await getProspectRow(prisma, prospectId);
  await requireLeasingAccess(prisma, principal, row.propertyId);
  return row;
}

export type ListProspectsForPropertyOptions = {
  status?: ProspectStatus;
};

/** `requireLeasingAccess`: org admin/owner, or PM/field assignment for this property in the active org. */
export async function listProspectsForProperty(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
  options?: ListProspectsForPropertyOptions,
): Promise<Prospect[]> {
  requireStaff(principal);
  await requireLeasingAccess(prisma, principal, propertyId);
  return prisma.prospect.findMany({
    where: {
      propertyId,
      ...(options?.status !== undefined ? { status: options.status } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Internal updates (no public spam edits). Cannot change `propertyId`.
 * If `unitId` is set, it must belong to the prospect’s property (or null to clear).
 */
export async function updateProspect(
  prisma: PrismaClient,
  principal: StaffContext,
  prospectId: string,
  input: UpdateProspectInput,
): Promise<Prospect> {
  requireStaff(principal);
  const existing = await getProspectRow(prisma, prospectId);
  await requireLeasingAccess(prisma, principal, existing.propertyId);

  let unitId: string | null | undefined = undefined;
  if (input.unitId !== undefined) {
    if (input.unitId === null) {
      unitId = null;
    } else {
      const unit = await prisma.unit.findFirst({
        where: { id: input.unitId, propertyId: existing.propertyId, isActive: true },
      });
      if (!unit) throw new NotFoundError("Unit not found, inactive, or not on this property");
      unitId = unit.id;
    }
  }

  const data: Record<string, unknown> = {};
  if (input.firstName !== undefined) data.firstName = input.firstName?.trim() || null;
  if (input.lastName !== undefined) data.lastName = input.lastName?.trim() || null;
  if (input.phone !== undefined) data.phone = input.phone?.trim() || null;
  if (input.message !== undefined) data.message = input.message?.trim() || null;
  if (input.status !== undefined) data.status = input.status;
  if (unitId !== undefined) data.unitId = unitId;

  if (Object.keys(data).length === 0) return existing;
  const row = await prisma.prospect.update({
    where: { id: prospectId },
    data: data as Prisma.ProspectUpdateInput,
  });
  await logPropertyActivity(prisma, principal, existing.propertyId, "Prospect", prospectId, "prospect.updated", {
    oldValues: pickForAudit(existing, ["status", "unitId", "qualifiedAt", "applicationSentAt"]),
    newValues: pickForAudit(row, ["status", "unitId", "qualifiedAt", "applicationSentAt"]),
  });
  return row;
}

export async function markProspectQualified(
  prisma: PrismaClient,
  principal: StaffContext,
  prospectId: string,
): Promise<Prospect> {
  requireStaff(principal);
  const existing = await getProspectRow(prisma, prospectId);
  await requireLeasingAccess(prisma, principal, existing.propertyId);

  if (existing.status === "archived") {
    throw new Error("Archived prospects cannot be marked qualified");
  }
  if (existing.qualifiedAt) {
    return existing;
  }

  const row = await prisma.prospect.update({
    where: { id: prospectId },
    data: { qualifiedAt: new Date() },
  });
  await logPropertyActivity(prisma, principal, existing.propertyId, "Prospect", prospectId, "prospect.qualified", {
    oldValues: pickForAudit(existing, ["qualifiedAt"]),
    newValues: pickForAudit(row, ["qualifiedAt"]),
  });
  return row;
}

export async function markApplicationSent(
  prisma: PrismaClient,
  principal: StaffContext,
  prospectId: string,
): Promise<Prospect> {
  requireStaff(principal);
  const existing = await getProspectRow(prisma, prospectId);
  await requireLeasingAccess(prisma, principal, existing.propertyId);

  if (existing.status === "archived") {
    throw new Error("Archived prospects cannot be marked application sent");
  }
  if (existing.applicationSentAt) {
    return existing;
  }

  const row = await prisma.prospect.update({
    where: { id: prospectId },
    data: { applicationSentAt: new Date() },
  });
  await logPropertyActivity(
    prisma,
    principal,
    existing.propertyId,
    "Prospect",
    prospectId,
    "prospect.application_sent",
    {
      oldValues: pickForAudit(existing, ["applicationSentAt"]),
      newValues: pickForAudit(row, ["applicationSentAt"]),
    },
  );
  return row;
}

/** Parse ISO date string to Date-only for service input. */
export function viewingRequestDateFromIso(iso: string): Date {
  return toDateOnlyUTC(iso);
}
