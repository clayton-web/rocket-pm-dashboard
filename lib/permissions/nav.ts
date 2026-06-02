import type { OrganizationMembershipRole } from "@prisma/client";
import type { NavItem } from "@/config/navigation";

export type EffectivePermissions = {
  role: OrganizationMembershipRole | null;
  isPlatformOperator: boolean;
};

export function canSeeNavItem(item: NavItem, perms: EffectivePermissions) {
  if (item.platformOnly && !perms.isPlatformOperator) {
    return false;
  }
  if (!item.minimumRole) {
    return true;
  }
  if (!perms.role) {
    return false;
  }
  if (item.minimumRole === "ADMIN") {
    return perms.role === "ADMIN" || perms.role === "OWNER" || perms.isPlatformOperator;
  }
  return true;
}
