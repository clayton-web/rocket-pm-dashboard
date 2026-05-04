import type { OrganizationRole } from "@prisma/client";
import type { NavItem } from "@/config/navigation";

export type EffectivePermissions = {
  role: OrganizationRole | null;
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
  if (item.minimumRole === "ORG_ADMIN") {
    return perms.role === "ORG_ADMIN" || perms.isPlatformOperator;
  }
  return true;
}
