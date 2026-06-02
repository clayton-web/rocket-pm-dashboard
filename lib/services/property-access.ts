import type { PrismaClient } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import type { StaffContext } from "@/lib/services/staff-context";

export { ForbiddenError, NotFoundError };

export function hasOrgWidePropertyRights(p: StaffContext): boolean {
  return p.organizationRole === "ADMIN" || p.organizationRole === "OWNER";
}

export function requireOrganizationAdmin(p: StaffContext): void {
  if (!hasOrgWidePropertyRights(p)) {
    throw new ForbiddenError("Organization admin or owner access required");
  }
}

export async function assertPropertyInActiveOrganization(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
): Promise<void> {
  const property = await prisma.property.findFirst({
    where: { id: propertyId },
    select: { organizationId: true },
  });
  if (!property) {
    throw new NotFoundError("Property not found");
  }
  if (property.organizationId !== principal.organizationId) {
    throw new ForbiddenError("No access to this property");
  }
}

export function isTenantAccount(p: StaffContext): boolean {
  return p.primaryRoleKey === "tenant";
}

export function requireStaff(p: StaffContext): void {
  if (isTenantAccount(p)) throw new ForbiddenError("Staff only");
}

export async function getAllowedPropertyIds(
  prisma: PrismaClient,
  principal: StaffContext,
): Promise<Set<string>> {
  requireStaff(principal);
  if (hasOrgWidePropertyRights(principal)) {
    const rows = await prisma.property.findMany({
      where: { organizationId: principal.organizationId },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  }
  return new Set(principal.assignmentRolesByProperty.keys());
}

export async function requirePropertyAccess(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
): Promise<void> {
  requireStaff(principal);
  await assertPropertyInActiveOrganization(prisma, principal, propertyId);
  if (hasOrgWidePropertyRights(principal)) return;
  const roles = principal.assignmentRolesByProperty.get(propertyId);
  if (!roles || roles.size === 0) throw new ForbiddenError("No access to this property");
}

export async function requireLeasingAccess(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
): Promise<void> {
  requireStaff(principal);
  await assertPropertyInActiveOrganization(prisma, principal, propertyId);
  if (hasOrgWidePropertyRights(principal)) return;
  const roles = principal.assignmentRolesByProperty.get(propertyId);
  if (!roles?.has("property_manager") && !roles?.has("field_agent")) {
    throw new ForbiddenError("No leasing access to this property");
  }
}

export async function requirePropertyManagerAccess(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
): Promise<void> {
  requireStaff(principal);
  await assertPropertyInActiveOrganization(prisma, principal, propertyId);
  if (hasOrgWidePropertyRights(principal)) return;
  const roles = principal.assignmentRolesByProperty.get(propertyId);
  if (!roles?.has("property_manager")) {
    throw new ForbiddenError("Property manager access required");
  }
}

export function isFieldAgentOnlyOnProperty(principal: StaffContext, propertyId: string): boolean {
  if (hasOrgWidePropertyRights(principal)) return false;
  const roles = principal.assignmentRolesByProperty.get(propertyId);
  if (!roles) return false;
  return roles.has("field_agent") && !roles.has("property_manager");
}

/** For maintenance PATCH on unscoped rows (future routes). */
export function requireUnscopedMaintenancePatchAccess(p: StaffContext): void {
  if (isTenantAccount(p)) throw new ForbiddenError("Staff only");
  requireStaff(p);
  if (hasOrgWidePropertyRights(p)) return;
  for (const roles of p.assignmentRolesByProperty.values()) {
    if (roles.has("property_manager")) return;
  }
  throw new ForbiddenError("Property manager access required");
}
