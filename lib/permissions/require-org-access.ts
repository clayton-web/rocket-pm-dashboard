import type { OrganizationMembershipRole } from "@prisma/client";
import prisma from "@/lib/db/prisma";

export type OrgAccessOptions = {
  userId: string;
  organizationId: string;
  /**
   * Minimum role required within the organization.
   * PLATFORM operators (Rocket Logic) pass through when platformAccessLevel is OPERATOR.
   */
  minimumRole?: OrganizationMembershipRole;
};

const roleRank: Record<OrganizationMembershipRole, number> = {
  MEMBER: 0,
  ADMIN: 1,
  OWNER: 2,
};

export async function requireOrgAccess({
  userId,
  organizationId,
  minimumRole = "MEMBER",
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

export function isOrgAdmin(role: OrganizationMembershipRole) {
  return role === "ADMIN" || role === "OWNER";
}
