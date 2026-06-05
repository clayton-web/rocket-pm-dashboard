/** Allowed property profile types stored on Property.propertyType. */
export const PROPERTY_PROFILE_TYPES = ["detached", "condo", "townhouse"] as const;

export type PropertyProfileType = (typeof PROPERTY_PROFILE_TYPES)[number];

export const PROPERTY_PROFILE_TYPE_LABELS: Record<PropertyProfileType, string> = {
  detached: "Detached",
  condo: "Condo",
  townhouse: "Townhouse",
};

export type PropertyProfileFields = {
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  approxSqft: number | null;
};

export function formatPropertyProfileTypeLabel(
  propertyType: string | null | undefined,
): string | null {
  if (!propertyType) return null;
  const key = propertyType as PropertyProfileType;
  return PROPERTY_PROFILE_TYPE_LABELS[key] ?? propertyType;
}

export function bathroomsFromDecimal(
  value: { toNumber(): number } | number | null | undefined,
): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const n = value.toNumber();
  return Number.isFinite(n) ? n : null;
}

export function propertyProfileFromRecord(record: {
  propertyType?: string | null;
  bedrooms?: number | null;
  bathrooms?: { toNumber(): number } | number | null;
  approxSqft?: number | null;
}): PropertyProfileFields {
  return {
    propertyType: record.propertyType ?? null,
    bedrooms: record.bedrooms ?? null,
    bathrooms: bathroomsFromDecimal(record.bathrooms),
    approxSqft: record.approxSqft ?? null,
  };
}
