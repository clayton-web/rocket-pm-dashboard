import type { PrismaClient, RoleKey, UserPropertyAssignment } from "@prisma/client";
import type { StaffContext } from "./staff-context";
import {
  ForbiddenError,
  hasOrgWidePropertyRights,
  requireOrganizationAdmin,
  requirePropertyAccess,
  requirePropertyManagerAccess,
  requireStaff,
} from "./property-access";
import { NotFoundError } from "./errors";
import { logPropertyActivity } from "./activityLog.service";

/** Only these may appear on `user_property_assignments` for MVP staff routing. */
const ASSIGNABLE_ROLE_KEYS = new Set<RoleKey>(["property_manager", "field_agent"]);

export type AssignUserToPropertyInput = {
  userId: string;
  propertyId: string;
  roleKey: RoleKey;
};

function assertAssignableRole(roleKey: RoleKey): void {
  if (!ASSIGNABLE_ROLE_KEYS.has(roleKey)) {
    throw new Error("Only property_manager and field_agent can be assigned to a property");
  }
}

/**
 * **Organization admin/owner** or **property manager** on that property may assign staff.
 * Field agents must not use this API.
 */
export async function assignUserToProperty(
  prisma: PrismaClient,
  principal: StaffContext,
  input: AssignUserToPropertyInput
): Promise<UserPropertyAssignment> {
  requireStaff(principal);
  assertAssignableRole(input.roleKey);
  if (!hasOrgWidePropertyRights(principal)) {
    await requirePropertyManagerAccess(prisma, principal, input.propertyId);
  } else {
    await requirePropertyAccess(prisma, principal, input.propertyId);
  }
  const target = await prisma.user.findFirst({
    where: { id: input.userId, isActive: true },
    include: { primaryRole: true },
  });
  if (!target) throw new NotFoundError("User not found");
  if (target.primaryRole?.key === "tenant") {
    throw new Error("Tenant accounts cannot receive property staff assignments");
  }
  const property = await prisma.property.findFirst({ where: { id: input.propertyId } });
  if (!property) throw new NotFoundError("Property not found");

  const role = await prisma.role.findUnique({ where: { key: input.roleKey } });
  if (!role) throw new NotFoundError("Role not found — run prisma db seed");

  try {
    const created = await prisma.userPropertyAssignment.create({
      data: {
        userId: input.userId,
        propertyId: input.propertyId,
        roleId: role.id,
      },
      include: { role: true, user: true, property: true },
    });
    await logPropertyActivity(prisma, principal, input.propertyId, "UserPropertyAssignment", created.id, "assignment.created", {
      newValues: { userId: input.userId, roleKey: input.roleKey },
    });
    return created;
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") {
      throw new Error("User already has this role on this property");
    }
    throw e;
  }
}

/** Same authority as assign. */
export async function removeUserFromProperty(
  prisma: PrismaClient,
  principal: StaffContext,
  assignmentId: string
): Promise<void> {
  requireStaff(principal);
  const row = await prisma.userPropertyAssignment.findUnique({
    where: { id: assignmentId },
    include: { role: true },
  });
  if (!row) throw new NotFoundError("Assignment not found");
  if (!ASSIGNABLE_ROLE_KEYS.has(row.role.key)) {
    throw new ForbiddenError("Cannot remove this assignment type via this API");
  }
  if (!hasOrgWidePropertyRights(principal)) {
    await requirePropertyManagerAccess(prisma, principal, row.propertyId);
  } else {
    await requirePropertyAccess(prisma, principal, row.propertyId);
  }
  await logPropertyActivity(prisma, principal, row.propertyId, "UserPropertyAssignment", assignmentId, "assignment.removed", {
    oldValues: { userId: row.userId, roleKey: row.role.key },
  });
  await prisma.userPropertyAssignment.delete({ where: { id: assignmentId } });
}

/** PM or org admin/owner: roster for one property. Field agent: forbidden. */
export async function listAssignmentsForProperty(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string
): Promise<
  Array<
    UserPropertyAssignment & {
      role: { key: RoleKey; name: string };
      user: { id: string; email: string | null; firstName: string | null; lastName: string | null };
    }
  >
> {
  requireStaff(principal);
  if (!hasOrgWidePropertyRights(principal)) {
    await requirePropertyManagerAccess(prisma, principal, propertyId);
  } else {
    await requirePropertyAccess(prisma, principal, propertyId);
  }
  return prisma.userPropertyAssignment.findMany({
    where: { propertyId },
    include: { role: true, user: true },
    orderBy: [{ role: { key: "asc" } }, { user: { email: "asc" } }],
  });
}

/** Org admin/owner: assignments for a user limited to properties in the **active** org. */
export async function listAssignmentsForUser(
  prisma: PrismaClient,
  principal: StaffContext,
  userId: string
): Promise<
  Array<
    UserPropertyAssignment & {
      role: { key: RoleKey; name: string };
      property: { id: string; name: string };
    }
  >
> {
  requireOrganizationAdmin(principal);
  return prisma.userPropertyAssignment.findMany({
    where: {
      userId,
      property: { organizationId: principal.organizationId },
    },
    include: { role: true, property: true },
    orderBy: { property: { name: "asc" } },
  });
}
