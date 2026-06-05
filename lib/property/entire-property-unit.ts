import type { CreateUnitInput } from "@/lib/services/unit.service";

/** Default unit label for whole-property / single-family rentals. */
export const ENTIRE_PROPERTY_UNIT_NUMBER = "Entire Property";

export function entirePropertyUnitCreateInput(): CreateUnitInput {
  return { unitNumber: ENTIRE_PROPERTY_UNIT_NUMBER };
}
