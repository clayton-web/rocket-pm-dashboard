import type { NormalizedComparable } from "../types";

function listingKey(listing: NormalizedComparable): string {
  return `${listing.source}:${listing.sourceListingId}`;
}

function normalizeAddressKey(listing: NormalizedComparable): string {
  const neighbourhood = listing.neighbourhood?.trim().toLowerCase() ?? "";
  const title = listing.title.trim().toLowerCase();
  return `${listing.city.toLowerCase()}|${neighbourhood}|${title}|${listing.monthlyRent}`;
}

/** Deduplicates by source id, then fuzzy cross-match on title/rent. */
export function dedupeListings(listings: NormalizedComparable[]): NormalizedComparable[] {
  const byId = new Map<string, NormalizedComparable>();
  for (const listing of listings) {
    byId.set(listingKey(listing), listing);
  }

  const unique = Array.from(byId.values());
  const seen = new Set<string>();
  const result: NormalizedComparable[] = [];

  for (const listing of unique) {
    const fuzzy = normalizeAddressKey(listing);
    if (seen.has(fuzzy)) continue;
    seen.add(fuzzy);
    result.push(listing);
  }

  return result;
}
