import type { MarketRentResearchInputs } from "@/lib/validation/market-rent-research";
import type { NormalizedComparable } from "@/lib/scrapers/types";

export function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}

export function normalizePostalCode(postalCode: string): string {
  return postalCode.replace(/\s+/g, "").toUpperCase();
}

export function postalCodeFsa(postalCode: string): string {
  return normalizePostalCode(postalCode).slice(0, 3);
}

/** Parse comma-separated nearby area names for search and matching. */
export function parseNearbyAreas(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function listingSearchText(listing: NormalizedComparable): string {
  return [listing.title, listing.neighbourhood, listing.city]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function includesNeighbourhood(
  listing: NormalizedComparable,
  neighbourhood: string | undefined,
): boolean {
  if (!neighbourhood?.trim()) return true;
  const needle = neighbourhood.trim().toLowerCase();
  return listingSearchText(listing).includes(needle);
}

export function matchesPostalCode(
  listing: NormalizedComparable,
  postalCode: string | undefined,
): boolean {
  if (!postalCode?.trim()) return false;
  const normalized = normalizePostalCode(postalCode);
  const fsa = postalCodeFsa(postalCode);
  const haystack = listingSearchText(listing).toUpperCase();
  return haystack.includes(normalized) || haystack.includes(fsa);
}

export function matchesNearbyArea(
  listing: NormalizedComparable,
  nearbyAreas: string[] | undefined,
): boolean {
  if (!nearbyAreas?.length) return false;
  const haystack = listingSearchText(listing);
  return nearbyAreas.some((area) => haystack.includes(area.trim().toLowerCase()));
}

function scorePropertyType(
  listing: NormalizedComparable,
  propertyType: string,
): { score: number; reason?: string } {
  const target = propertyType.trim().toLowerCase();
  if (!target) return { score: 0 };
  const hint = listing.propertyTypeHint?.toLowerCase() ?? "";
  const title = listing.title.toLowerCase();
  if (hint.includes(target) || title.includes(target)) {
    return { score: 15, reason: "property type match" };
  }
  if (target.includes("condo") && (hint === "condo" || /\bapartment\b/.test(title))) {
    return { score: 10, reason: "similar property type" };
  }
  if (target.includes("townhouse") && /\btownhouse\b|\btownhome\b/.test(title)) {
    return { score: 10, reason: "similar property type" };
  }
  if (target.includes("detached") && /\bdetached\b|\bhouse\b/.test(title)) {
    return { score: 10, reason: "similar property type" };
  }
  return { score: -5 };
}

function evaluateListing(
  listing: NormalizedComparable,
  inputs: MarketRentResearchInputs,
  options?: MatchComparableOptions,
): { included: boolean; score: number; reasons: string[]; exclusionReason?: string } {
  const reasons: string[] = [];
  let score = 0;
  const skipNeighbourhood = options?.skipNeighbourhoodFilter === true;
  const sqftTolerance = options?.sqftToleranceRatio ?? 0.25;

  if (normalizeCity(listing.city) !== normalizeCity(inputs.city)) {
    return { included: false, score: 0, reasons, exclusionReason: "Different city" };
  }
  reasons.push("same city");
  score += 20;

  if (inputs.postalCode?.trim() && matchesPostalCode(listing, inputs.postalCode)) {
    reasons.push("postal code match");
    score += 50;
  }

  if (!skipNeighbourhood && !includesNeighbourhood(listing, inputs.neighbourhood)) {
    return {
      included: false,
      score,
      reasons,
      exclusionReason: "Neighbourhood keyword not found",
    };
  }
  if (!skipNeighbourhood && inputs.neighbourhood?.trim()) {
    reasons.push("neighbourhood match");
    score += 30;
  }

  const nearby = parseNearbyAreas(inputs.nearbyAreas);
  if (nearby.length > 0 && matchesNearbyArea(listing, nearby)) {
    reasons.push("nearby area match");
    score += 25;
  }

  if (listing.bedrooms != null) {
    const diff = Math.abs(listing.bedrooms - inputs.bedrooms);
    if (diff > 1) {
      return {
        included: false,
        score,
        reasons,
        exclusionReason: `Bedrooms ${listing.bedrooms} outside ±1 of ${inputs.bedrooms}`,
      };
    }
    reasons.push(`bedrooms ${listing.bedrooms}`);
    score += diff === 0 ? 20 : 10;
  } else {
    score += 5;
  }

  if (listing.bathrooms != null && inputs.bathrooms != null) {
    const diff = Math.abs(listing.bathrooms - inputs.bathrooms);
    if (diff > 1) {
      return {
        included: false,
        score,
        reasons,
        exclusionReason: `Bathrooms ${listing.bathrooms} outside ±1 of ${inputs.bathrooms}`,
      };
    }
    reasons.push(`bathrooms ${listing.bathrooms}`);
    score += diff === 0 ? 10 : 5;
  }

  if (listing.sqft != null && inputs.sqft != null) {
    const min = inputs.sqft * (1 - sqftTolerance);
    const max = inputs.sqft * (1 + sqftTolerance);
    const pctLabel = Math.round(sqftTolerance * 100);
    if (listing.sqft < min || listing.sqft > max) {
      return {
        included: false,
        score,
        reasons,
        exclusionReason: `Sqft ${listing.sqft} outside ±${pctLabel}% of ${inputs.sqft}`,
      };
    }
    reasons.push(`sqft ${listing.sqft}`);
    score += 10;
  }

  const typeScore = scorePropertyType(listing, inputs.propertyType);
  score += typeScore.score;
  if (typeScore.reason) reasons.push(typeScore.reason);

  return { included: true, score, reasons };
}

export type MatchComparableOptions = {
  /** Fractional tolerance for sqft matching (0.25 = ±25%). Default 0.25. */
  sqftToleranceRatio?: number;
  /** When true, neighbourhood keyword is not required for inclusion. */
  skipNeighbourhoodFilter?: boolean;
};

export function matchComparableListings(
  inputs: MarketRentResearchInputs,
  listings: NormalizedComparable[],
  options?: MatchComparableOptions,
): { matched: NormalizedComparable[]; excluded: NormalizedComparable[] } {
  const matched: NormalizedComparable[] = [];
  const excluded: NormalizedComparable[] = [];

  for (const listing of listings) {
    const evaluation = evaluateListing(listing, inputs, options);
    const next: NormalizedComparable = {
      ...listing,
      matchScore: evaluation.score,
      matchReasons: evaluation.reasons,
      excluded: !evaluation.included,
      exclusionReason: evaluation.exclusionReason,
    };
    if (evaluation.included) matched.push(next);
    else excluded.push(next);
  }

  matched.sort((a, b) => b.matchScore - a.matchScore);
  return { matched, excluded };
}

export function applyOutlierExclusions(
  matched: NormalizedComparable[],
): { kept: NormalizedComparable[]; outlierExcluded: NormalizedComparable[] } {
  const rents = matched.map((listing) => listing.monthlyRent);
  if (rents.length < 4) {
    return { kept: matched, outlierExcluded: [] };
  }

  const sorted = [...rents].sort((a, b) => a - b);
  const q1Index = Math.floor((sorted.length - 1) * 0.25);
  const q3Index = Math.ceil((sorted.length - 1) * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;

  const kept: NormalizedComparable[] = [];
  const outlierExcluded: NormalizedComparable[] = [];

  for (const listing of matched) {
    if (listing.monthlyRent < lower || listing.monthlyRent > upper) {
      outlierExcluded.push({
        ...listing,
        excluded: true,
        exclusionReason: "Rent outside IQR outlier bounds",
      });
    } else {
      kept.push(listing);
    }
  }

  return { kept, outlierExcluded };
}
