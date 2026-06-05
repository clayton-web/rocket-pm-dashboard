import { hasOrgWidePropertyRights } from "@/lib/services/property-access";
import type { StaffContext } from "@/lib/services/staff-context";
import { isMarketRentResearchEnabled } from "./feature-flag";

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

/** Fail closed — never throw while resolving panel props for the property page. */
export function safeResolvePropertyDetailMarketRentResearch(args: {
  canManagePropertyUnits: boolean;
}): PropertyDetailMarketRentResearch | undefined {
  try {
    return resolvePropertyDetailMarketRentResearch({
      featureEnabled: isMarketRentResearchEnabled(),
      canManagePropertyUnits: args.canManagePropertyUnits,
    });
  } catch {
    return undefined;
  }
}
