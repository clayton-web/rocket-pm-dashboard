import type { NormalizedComparable, RawScraperListing } from "../types";

export function normalizeScraperListing(raw: RawScraperListing): NormalizedComparable {
  return {
    source: raw.source,
    sourceListingId: raw.sourceListingId,
    sourceUrl: raw.sourceUrl,
    title: raw.title,
    monthlyRent: raw.monthlyRent,
    currency: "CAD",
    bedrooms: raw.bedrooms,
    bathrooms: raw.bathrooms,
    sqft: raw.sqft,
    city: raw.city,
    neighbourhood: raw.neighbourhood,
    postedAt: raw.postedAt,
    capturedAt: raw.capturedAt,
    propertyTypeHint: raw.propertyTypeHint,
    matchScore: 0,
    matchReasons: [],
    excluded: false,
  };
}

export function normalizeScraperListings(raw: RawScraperListing[]): NormalizedComparable[] {
  return raw.map(normalizeScraperListing);
}
