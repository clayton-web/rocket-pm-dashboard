import type { OrganizationRole } from "@prisma/client";
import prisma from "@/lib/db/prisma";

export type OrgAccessOptions = {
  userId: string;
  organizationId: string;
  /**
   * Minimum role required within the organization.
   * PLATFORM operators (Rocket Logic) pass through when platformAccessLevel is OPERATOR.
   */
  minimumRole?: OrganizationRole;
};

const roleRank: Record<OrganizationRole, number> = {
  PROPERTY_MANAGER: 0,
  ORG_ADMIN: 1,
};

export async function requireOrgAccess({
  userId,
  organizationId,
  minimumRole = "PROPERTY_MANAGER",
}: OrgAccessOptions) {
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId, organizationId },
  });

  if (membership) {
    if (roleRank[membership.role] < roleRank[minimumRole]) {
      throw new Error("Forbidden");
    }
    return { kind: "member" as const, membership };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.platformAccessLevel === "OPERATOR") {
    const orgExists = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!orgExists) {
      throw new Error("Organization not found");
    }
    return { kind: "operator" as const, user };
  }

  throw new Error("Forbidden");
}

export function isOrgAdmin(role: OrganizationRole) {
  return role === "ORG_ADMIN";
}
