import { ENTIRE_PROPERTY_UNIT_NUMBER } from "@/lib/property/entire-property-unit";

export type PropertyDisplayParts = {
  name: string;
  streetLine1?: string | null;
  streetLine2?: string | null;
};

/** Prisma select for address-based property labels in staff DTOs. */
export const propertyDisplaySelect = {
  name: true,
  streetLine1: true,
  streetLine2: true,
} as const;

export function formatPropertyAddress(property: PropertyDisplayParts): string {
  const line1 = property.streetLine1?.trim();
  if (line1) {
    const line2 = property.streetLine2?.trim();
    return line2 ? `${line1}, ${line2}` : line1;
  }
  const name = property.name?.trim();
  return name || "Property";
}

export function formatUnitLabel(unitNumber: string | null | undefined): string | null {
  const label = unitNumber?.trim();
  return label || null;
}

/** Non-null unit label for required DTO fields. */
export function formatUnitLabelOrDash(unitNumber: string | null | undefined): string {
  return formatUnitLabel(unitNumber) ?? "—";
}

/**
 * Combined property + unit line for emails and inline references.
 * Omits the unit suffix for whole-property rentals ("Entire Property") so SFH
 * labels stay as the street address only.
 */
export function formatPropertyUnitLine(
  property: PropertyDisplayParts,
  unitNumber: string | null | undefined,
): string {
  const address = formatPropertyAddress(property);
  const unit = formatUnitLabel(unitNumber);
  if (!unit || unit === ENTIRE_PROPERTY_UNIT_NUMBER) {
    return address;
  }
  return `${address} – ${unit}`;
}

/** String-only variant for templates that already have a property display value. */
export function formatPropertyUnitReference(
  propertyDisplay: string | null | undefined,
  unitNumber: string | null | undefined,
): string | null {
  const property = propertyDisplay?.trim();
  if (!property) {
    const unit = formatUnitLabel(unitNumber);
    if (!unit || unit === ENTIRE_PROPERTY_UNIT_NUMBER) return unit;
    return unit;
  }
  return formatPropertyUnitLine({ name: property }, unitNumber);
}
