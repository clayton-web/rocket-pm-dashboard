import type { Prisma, PrismaClient, Property } from "@prisma/client";
import type { StaffContext } from "./staff-context";
import {
  ForbiddenError,
  getAllowedPropertyIds,
  hasOrgWidePropertyRights,
  requireOrganizationAdmin,
  requirePropertyAccess,
  requirePropertyManagerAccess,
  requireStaff,
} from "./property-access";
import { NotFoundError } from "./errors";
import { logPropertyActivity, pickForAudit } from "./activityLog.service";

export type CreatePropertyInput = {
  /** Customer org (Rocket PM tenant). Required for new properties; must match the active org for staff. */
  organizationId: string;
  name: string;
  streetLine1: string;
  streetLine2?: string | null;
  city: string;
  province?: string;
  postalCode: string;
  country?: string;
};

export type UpdatePropertyInput = Partial<
  Pick<
    Property,
    "name" | "streetLine1" | "streetLine2" | "city" | "province" | "postalCode" | "country" | "isActive"
  >
>;

function trimRequired(s: string, label: string): string {
  const v = s.trim();
  if (!v) throw new Error(`${label} is required`);
  return v;
}

/**
 * New properties in the **active** org: `OrganizationMembershipRole` admin/owner, or (future) delegated flows.
 * PMs manage assigned properties via `updateProperty` and units/assignments on those properties.
 */
export async function createProperty(
  prisma: PrismaClient,
  principal: StaffContext,
  input: CreatePropertyInput
): Promise<Property> {
  requireOrganizationAdmin(principal);
  if (input.organizationId !== principal.organizationId) {
    throw new ForbiddenError("Property must be created in the active organization only");
  }
  const row = await prisma.property.create({
    data: {
      organizationId: input.organizationId,
      name: trimRequired(input.name, "name"),
      streetLine1: trimRequired(input.streetLine1, "streetLine1"),
      streetLine2: input.streetLine2?.trim() || null,
      city: trimRequired(input.city, "city"),
      province: input.province?.trim() || "BC",
      postalCode: trimRequired(input.postalCode, "postalCode"),
      country: input.country?.trim() || "CA",
    },
  });
  await logPropertyActivity(prisma, principal, row.id, "Property", row.id, "property.created", {
    newValues: pickForAudit(row, ["name", "city", "province", "postalCode", "isActive"]),
  });
  return row;
}

/** PM / org admin (active org) on this property. Field agents cannot edit property records. */
export async function updateProperty(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
  input: UpdatePropertyInput
): Promise<Property> {
  requireStaff(principal);
  await requirePropertyManagerAccess(prisma, principal, propertyId);
  await ensurePropertyExists(prisma, propertyId);
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = trimRequired(String(input.name), "name");
  if (input.streetLine1 !== undefined) data.streetLine1 = trimRequired(String(input.streetLine1), "streetLine1");
  if (input.streetLine2 !== undefined) data.streetLine2 = input.streetLine2?.trim() || null;
  if (input.city !== undefined) data.city = trimRequired(String(input.city), "city");
  if (input.province !== undefined) data.province = String(input.province).trim() || "BC";
  if (input.postalCode !== undefined) data.postalCode = trimRequired(String(input.postalCode), "postalCode");
  if (input.country !== undefined) data.country = String(input.country).trim() || "CA";
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (Object.keys(data).length === 0) return getPropertyById(prisma, principal, propertyId);
  const before = await prisma.property.findUnique({ where: { id: propertyId } });
  const row = await prisma.property.update({
    where: { id: propertyId },
    data: data as Prisma.PropertyUpdateInput,
  });
  await logPropertyActivity(prisma, principal, propertyId, "Property", propertyId, "property.updated", {
    oldValues: before
      ? pickForAudit(before, ["name", "city", "province", "postalCode", "country", "isActive"])
      : undefined,
    newValues: pickForAudit(row, ["name", "city", "province", "postalCode", "country", "isActive"]),
  });
  return row;
}

/** Org admin/owner or any assignment (PM/field) on the property in the active org. */
export async function getPropertyById(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string
): Promise<Property> {
  requireStaff(principal);
  await requirePropertyAccess(prisma, principal, propertyId);
  const row = await prisma.property.findFirst({ where: { id: propertyId } });
  if (!row) throw new NotFoundError("Property not found");
  return row;
}

/**
 * Org admin/owner: all properties in the active org. Members: only assigned properties in that org.
 * Tenants: empty (internal foundation — portal uses other services later).
 */
export async function listPropertiesForUser(
  prisma: PrismaClient,
  principal: StaffContext
): Promise<Property[]> {
  requireStaff(principal);
  if (hasOrgWidePropertyRights(principal)) {
    return prisma.property.findMany({
      where: { organizationId: principal.organizationId },
      orderBy: { name: "asc" },
    });
  }
  const scope = await getAllowedPropertyIds(prisma, principal);
  const ids = [...scope];
  if (ids.length === 0) return [];
  return prisma.property.findMany({
    where: {
      id: { in: ids },
      organizationId: principal.organizationId,
    },
    orderBy: { name: "asc" },
  });
}

async function ensurePropertyExists(prisma: PrismaClient, propertyId: string): Promise<void> {
  const n = await prisma.property.count({ where: { id: propertyId } });
  if (n === 0) throw new NotFoundError("Property not found");
}
