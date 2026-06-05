import { hasOrgWidePropertyRights } from "@/lib/services/property-access";
import type { StaffContext } from "@/lib/services/staff-context";

/** PM or org-wide staff may run market rent research when the feature flag is on. */
export function canRunMarketRentResearch(
  ctx: StaffContext,
  propertyId: string,
  featureEnabled: boolean,
): boolean {
  if (!featureEnabled) return false;
  if (hasOrgWidePropertyRights(ctx)) return true;
  const roles = ctx.assignmentRolesByProperty.get(propertyId);
  return Boolean(roles?.has("property_manager"));
}

export type PropertyDetailMarketRentResearch = {
  enabled: true;
};

export function resolvePropertyDetailMarketRentResearch(args: {
  featureEnabled: boolean;
  canManagePropertyUnits: boolean;
}): PropertyDetailMarketRentResearch | undefined {
  if (!args.featureEnabled || !args.canManagePropertyUnits) return undefined;
  return { enabled: true };
}
