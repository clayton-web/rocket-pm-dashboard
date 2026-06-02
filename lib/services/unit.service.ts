import type { PrismaClient, Unit } from "@prisma/client";
import type { StaffContext } from "./staff-context";
import {
  hasOrgWidePropertyRights,
  requirePropertyAccess,
  requirePropertyManagerAccess,
  requireStaff,
} from "./property-access";
import { NotFoundError } from "./errors";
import { logPropertyActivity, pickForAudit } from "./activityLog.service";

export type CreateUnitInput = {
  unitNumber: string;
  floor?: string | null;
  bedrooms?: number | null;
};

export type UpdateUnitInput = Partial<Pick<Unit, "unitNumber" | "floor" | "bedrooms" | "isActive">>;

function trimRequired(s: string, label: string): string {
  const v = s.trim();
  if (!v) throw new Error(`${label} is required`);
  return v;
}

async function getUnitOrThrow(prisma: PrismaClient, unitId: string): Promise<Unit> {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) throw new NotFoundError("Unit not found");
  return unit;
}

/**
 * Org admin/owner may add units on any property in the active org.
 * Property manager assigned to the property may add units. Field agents: no create.
 */
export async function createUnit(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
  input: CreateUnitInput
): Promise<Unit> {
  requireStaff(principal);
  if (!hasOrgWidePropertyRights(principal)) {
    await requirePropertyManagerAccess(prisma, principal, propertyId);
  } else {
    await requirePropertyAccess(prisma, principal, propertyId);
  }
  const propertyExists = await prisma.property.count({ where: { id: propertyId } });
  if (!propertyExists) throw new NotFoundError("Property not found");
  const row = await prisma.unit.create({
    data: {
      propertyId,
      unitNumber: trimRequired(input.unitNumber, "unitNumber"),
      floor: input.floor?.trim() || null,
      bedrooms: input.bedrooms ?? null,
    },
  });
  await logPropertyActivity(prisma, principal, propertyId, "Unit", row.id, "unit.created", {
    newValues: pickForAudit(row, ["unitNumber", "floor", "bedrooms", "isActive"]),
  });
  return row;
}

/** Org admin/owner or PM on the unit’s property (active org). */
export async function updateUnit(
  prisma: PrismaClient,
  principal: StaffContext,
  unitId: string,
  input: UpdateUnitInput
): Promise<Unit> {
  requireStaff(principal);
  const existing = await getUnitOrThrow(prisma, unitId);
  if (!hasOrgWidePropertyRights(principal)) {
    await requirePropertyManagerAccess(prisma, principal, existing.propertyId);
  } else {
    await requirePropertyAccess(prisma, principal, existing.propertyId);
  }
  const data: Record<string, unknown> = {};
  if (input.unitNumber !== undefined) data.unitNumber = trimRequired(String(input.unitNumber), "unitNumber");
  if (input.floor !== undefined) data.floor = input.floor?.trim() || null;
  if (input.bedrooms !== undefined) data.bedrooms = input.bedrooms;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (Object.keys(data).length === 0) return existing;
  try {
    const row = await prisma.unit.update({ where: { id: unitId }, data: data as UpdateUnitInput });
    await logPropertyActivity(prisma, principal, row.propertyId, "Unit", row.id, "unit.updated", {
      oldValues: pickForAudit(existing, ["unitNumber", "floor", "bedrooms", "isActive"]),
      newValues: pickForAudit(row, ["unitNumber", "floor", "bedrooms", "isActive"]),
    });
    return row;
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") {
      throw new Error("Unit number already exists for this property");
    }
    throw e;
  }
}

/** Org admin/owner or PM/field with access to the property. */
export async function getUnitById(
  prisma: PrismaClient,
  principal: StaffContext,
  unitId: string
): Promise<Unit> {
  requireStaff(principal);
  const unit = await getUnitOrThrow(prisma, unitId);
  await requirePropertyAccess(prisma, principal, unit.propertyId);
  return unit;
}

/** List units for a property; caller must have property access. */
export async function listUnitsForProperty(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string
): Promise<Unit[]> {
  requireStaff(principal);
  await requirePropertyAccess(prisma, principal, propertyId);
  return prisma.unit.findMany({
    where: { propertyId },
    orderBy: { unitNumber: "asc" },
  });
}
