import type { PropertyServiceRelationship } from "@prisma/client";

export const PROPERTY_SERVICE_RELATIONSHIPS = [
  "MANAGED",
  "PRE_MANAGEMENT",
  "PLACEMENT_ONLY",
] as const satisfies readonly PropertyServiceRelationship[];

export type PropertyServiceRelationshipValue = (typeof PROPERTY_SERVICE_RELATIONSHIPS)[number];

/** Staff-facing labels for create/edit controls. */
export const PROPERTY_SERVICE_RELATIONSHIP_LABELS: Record<PropertyServiceRelationshipValue, string> =
  {
    MANAGED: "Property Management",
    PRE_MANAGEMENT: "Leasing, then Property Management",
    PLACEMENT_ONLY: "Tenant Placement Only",
  };

/** Short labels for property detail status rows. */
export const PROPERTY_SERVICE_RELATIONSHIP_SHORT_LABELS: Record<
  PropertyServiceRelationshipValue,
  string
> = {
  MANAGED: "Managed",
  PRE_MANAGEMENT: "Pre-management",
  PLACEMENT_ONLY: "Placement only",
};

export const PROPERTY_SERVICE_RELATIONSHIP_HELPERS: Record<PropertyServiceRelationshipValue, string> =
  {
    MANAGED:
      "Already under ongoing management. May have tenants; list a unit only when it is available to rent.",
    PRE_MANAGEMENT:
      "Advertising and leasing now; Axford intends to manage the property after a tenant is placed.",
    PLACEMENT_ONLY:
      "Advertise, show, and place a tenant only. After placement, the landlord manages the tenancy — this property is not retained for ongoing management.",
  };

export function isPropertyServiceRelationship(
  value: string,
): value is PropertyServiceRelationshipValue {
  return (PROPERTY_SERVICE_RELATIONSHIPS as readonly string[]).includes(value);
}

export function formatPropertyServiceRelationship(
  value: PropertyServiceRelationship | string | null | undefined,
): string {
  if (!value || !isPropertyServiceRelationship(value)) return "Managed";
  return PROPERTY_SERVICE_RELATIONSHIP_SHORT_LABELS[value];
}

/**
 * Whether the organization intends ongoing management for this property.
 * Placement-only properties should not be treated as managed portfolio assets
 * for future maintenance/tenant-portal gating (downstream work).
 */
export function isOngoingManagementRelationship(
  value: PropertyServiceRelationship | string | null | undefined,
): boolean {
  return value === "MANAGED" || value === "PRE_MANAGEMENT";
}
