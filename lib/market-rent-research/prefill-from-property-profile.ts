import type { PropertyProfileFields } from "@/lib/property/profile";

export type MarketRentResearchFormPrefill = {
  city: string;
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
};

/** Pre-fill research inputs from property profile; blanks when profile data is missing. */
export function buildMarketRentResearchFormPrefill(args: {
  city: string;
  profile: PropertyProfileFields;
  unitBedrooms?: number | null;
}): MarketRentResearchFormPrefill {
  const bedrooms =
    args.profile.bedrooms ?? args.unitBedrooms ?? null;
  return {
    city: args.city,
    propertyType: args.profile.propertyType ?? "",
    bedrooms: bedrooms != null ? String(bedrooms) : "",
    bathrooms:
      args.profile.bathrooms != null ? String(args.profile.bathrooms) : "",
    sqft: args.profile.approxSqft != null ? String(args.profile.approxSqft) : "",
  };
}
