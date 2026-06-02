import type {
  Prisma,
  PrismaClient,
  Prospect,
  ProspectStatus,
} from "@prisma/client";
import type { StaffContext } from "./staff-context";
import { requireLeasingAccess, requireStaff } from "./property-access";
import { NotFoundError } from "./errors";
import { logPropertyActivity, pickForAudit } from "./activityLog.service";

export type CreatePublicProspectInput = {
  propertyId: string;
  unitId?: string | null;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  message?: string | null;
};

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

/**
 * Public viewing request — **no auth principal**.
 * Validates active property and optional unit belongs to property.
 */
export async function createPublicProspect(
  prisma: PrismaClient,
  input: CreatePublicProspectInput
): Promise<Prospect> {
  const property = await prisma.property.findFirst({
    where: { id: input.propertyId, isActive: true },
  });
  if (!property) throw new NotFoundError("Property not found or inactive");

  let unitId: string | null = null;
  if (input.unitId) {
    const unit = await prisma.unit.findFirst({
      where: {
        id: input.unitId,
        propertyId: input.propertyId,
        isActive: true,
      },
    });
    if (!unit) throw new NotFoundError("Unit not found, inactive, or not on this property");
    unitId = unit.id;
  }

  return prisma.prospect.create({
    data: {
      propertyId: input.propertyId,
      unitId,
      email: trimRequiredEmail(input.email),
      firstName: input.firstName?.trim() || null,
      lastName: input.lastName?.trim() || null,
      phone: input.phone?.trim() || null,
      message: input.message?.trim() || null,
      status: "new",
    },
  });
}

async function getProspectRow(prisma: PrismaClient, prospectId: string): Promise<Prospect> {
  const row = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!row) throw new NotFoundError("Prospect not found");
  return row;
}

/** Staff with leasing access to the prospect’s property. */
export async function getProspectById(
  prisma: PrismaClient,
  principal: StaffContext,
  prospectId: string
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
  options?: ListProspectsForPropertyOptions
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
  input: UpdateProspectInput
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
    oldValues: pickForAudit(existing, ["status", "unitId"]),
    newValues: pickForAudit(row, ["status", "unitId"]),
  });
  return row;
}
