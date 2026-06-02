import type { OrganizationMembershipRole, PrismaClient, RoleKey } from "@prisma/client";

/**
 * Staff session context for domain services (framework-agnostic).
 * Load via {@link loadStaffContext} from a validated user id + active organization id.
 */
export type StaffContext = {
  userId: string;
  organizationId: string;
  organizationRole: OrganizationMembershipRole;
  primaryRoleKey: RoleKey | null;
  assignmentRolesByProperty: ReadonlyMap<string, ReadonlySet<RoleKey>>;
};

export async function loadStaffContext(
  prisma: PrismaClient,
  userId: string,
  organizationId: string,
): Promise<StaffContext | null> {
  if (organizationId.trim() === "") return null;

  const membership = await prisma.organizationMembership.findUnique({
    where: {
      userId_organizationId: { organizationId, userId },
    },
    include: {
      user: {
        include: {
          primaryRole: true,
          propertyAssignments: {
            where: { property: { organizationId } },
            include: { role: true },
          },
        },
      },
    },
  });

  if (!membership?.user.isActive) return null;

  const map = new Map<string, Set<RoleKey>>();
  for (const a of membership.user.propertyAssignments) {
    let set = map.get(a.propertyId);
    if (!set) {
      set = new Set();
      map.set(a.propertyId, set);
    }
    set.add(a.role.key);
  }

  return {
    userId: membership.user.id,
    organizationId,
    organizationRole: membership.role,
    primaryRoleKey: membership.user.primaryRole?.key ?? null,
    assignmentRolesByProperty: map,
  };
}
