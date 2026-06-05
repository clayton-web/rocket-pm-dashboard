import type { CreateUnitInput } from "@/lib/services/unit.service";

/** Default unit label for whole-property / single-family rentals. */
export const ENTIRE_PROPERTY_UNIT_NUMBER = "Entire Property";

export function entirePropertyUnitCreateInput(): CreateUnitInput {
  return { unitNumber: ENTIRE_PROPERTY_UNIT_NUMBER };
}

export function isEntirePropertyUnit(unitNumber: string): boolean {
  return unitNumber.trim() === ENTIRE_PROPERTY_UNIT_NUMBER;
}

export function getAdditionalUnits<T extends { unitNumber: string }>(units: T[]): T[] {
  return units.filter((unit) => !isEntirePropertyUnit(unit.unitNumber));
}

export function countAdditionalUnits(units: { unitNumber: string }[]): number {
  return getAdditionalUnits(units).length;
}

export function hasOnlyEntirePropertyUnit(units: { unitNumber: string }[]): boolean {
  return units.length > 0 && units.every((unit) => isEntirePropertyUnit(unit.unitNumber));
}
