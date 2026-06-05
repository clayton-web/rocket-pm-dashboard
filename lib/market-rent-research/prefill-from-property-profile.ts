import type { PropertyProfileFields } from "@/lib/property/profile";
import { formatPropertyProfileTypeLabel } from "@/lib/property/profile";

export type MarketRentResearchFormPrefill = {
  city: string;
  postalCode: string;
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
};

/** Pre-fill research criteria from property profile; blanks when profile data is missing. */
export function buildMarketRentResearchFormPrefill(args: {
  city: string;
  postalCode?: string;
  profile: PropertyProfileFields;
  unitBedrooms?: number | null;
}): MarketRentResearchFormPrefill {
  const bedrooms = args.profile.bedrooms ?? args.unitBedrooms ?? null;
  return {
    city: args.city,
    postalCode: args.postalCode?.trim() ?? "",
    propertyType: args.profile.propertyType ?? "",
    bedrooms: bedrooms != null ? String(bedrooms) : "",
    bathrooms: args.profile.bathrooms != null ? String(args.profile.bathrooms) : "",
    sqft: args.profile.approxSqft != null ? String(args.profile.approxSqft) : "",
  };
}

export function formatPropertyProfileSummary(args: {
  city: string;
  postalCode?: string;
  profile: PropertyProfileFields;
}): {
  city: string;
  postalCode: string;
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
} {
  return {
    city: args.city,
    postalCode: args.postalCode?.trim() ?? "—",
    propertyType: formatPropertyProfileTypeLabel(args.profile.propertyType) ?? "—",
    bedrooms: args.profile.bedrooms != null ? String(args.profile.bedrooms) : "—",
    bathrooms: args.profile.bathrooms != null ? String(args.profile.bathrooms) : "—",
    sqft: args.profile.approxSqft != null ? String(args.profile.approxSqft) : "—",
  };
}
