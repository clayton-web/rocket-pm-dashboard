import type { PropertyServiceRelationship } from "@prisma/client";
import {
  formatPropertyServiceRelationship,
  isPropertyServiceRelationship,
  type PropertyServiceRelationshipValue,
} from "@/lib/property/service-relationship";

export const PLACEMENT_ONLY_MANAGED_CONVERSION_BLOCKED_MESSAGE =
  "This property is set to Tenant Placement Only. Managed tenancy conversion is disabled because it would enable tenant portal and ongoing property-management workflows. A separate placement-completion workflow is required.";

export type ApplicationConversionPolicy = {
  allowed: boolean;
  serviceRelationship: PropertyServiceRelationshipValue;
  /** When true, successful conversion must set Property.serviceRelationship to MANAGED. */
  transitionPropertyToManaged: boolean;
  reason: string | null;
  /** Short staff-facing queue/detail label. */
  staffStateLabel: string;
  recommendedAction: "convert_managed_tenancy" | "await_placement_completion" | "none";
};

export class PlacementOnlyConversionBlockedError extends Error {
  readonly code = "PLACEMENT_ONLY_CONVERSION_BLOCKED";

  constructor(message = PLACEMENT_ONLY_MANAGED_CONVERSION_BLOCKED_MESSAGE) {
    super(message);
    this.name = "PlacementOnlyConversionBlockedError";
  }
}

/**
 * Whether an approved application may be converted into a managed Tenancy.
 * Loads service relationship from the property — never trust client-supplied values.
 */
export function getApplicationConversionPolicy(input: {
  applicationStatus: string;
  hasTenancy: boolean;
  serviceRelationship: PropertyServiceRelationship | string | null | undefined;
}): ApplicationConversionPolicy {
  const serviceRelationship: PropertyServiceRelationshipValue =
    input.serviceRelationship && isPropertyServiceRelationship(input.serviceRelationship)
      ? input.serviceRelationship
      : "MANAGED";

  if (input.hasTenancy) {
    return {
      allowed: false,
      serviceRelationship,
      transitionPropertyToManaged: false,
      reason: "A tenancy already exists for this application",
      staffStateLabel: "Converted",
      recommendedAction: "none",
    };
  }

  if (input.applicationStatus !== "approved") {
    return {
      allowed: false,
      serviceRelationship,
      transitionPropertyToManaged: false,
      reason: "Application must be approved before creating a tenancy",
      staffStateLabel: formatPropertyServiceRelationship(serviceRelationship),
      recommendedAction: "none",
    };
  }

  if (serviceRelationship === "PLACEMENT_ONLY") {
    return {
      allowed: false,
      serviceRelationship,
      transitionPropertyToManaged: false,
      reason: PLACEMENT_ONLY_MANAGED_CONVERSION_BLOCKED_MESSAGE,
      staffStateLabel: "Placement completion required",
      recommendedAction: "await_placement_completion",
    };
  }

  if (serviceRelationship === "PRE_MANAGEMENT") {
    return {
      allowed: true,
      serviceRelationship,
      transitionPropertyToManaged: true,
      reason: null,
      staffStateLabel: "Ready to convert + begin management",
      recommendedAction: "convert_managed_tenancy",
    };
  }

  return {
    allowed: true,
    serviceRelationship: "MANAGED",
    transitionPropertyToManaged: false,
    reason: null,
    staffStateLabel: "Ready to convert",
    recommendedAction: "convert_managed_tenancy",
  };
}

export function assertCanConvertApplicationToManagedTenancy(
  policy: ApplicationConversionPolicy,
): void {
  if (policy.allowed) return;
  if (policy.serviceRelationship === "PLACEMENT_ONLY") {
    throw new PlacementOnlyConversionBlockedError(policy.reason ?? undefined);
  }
  throw new Error(policy.reason ?? "Application cannot be converted to a tenancy");
}
