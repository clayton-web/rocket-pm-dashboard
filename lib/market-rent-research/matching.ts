import type { MarketRentResearchInputs } from "@/lib/validation/market-rent-research";
import type { NormalizedComparable } from "@/lib/scrapers/types";

function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}

function includesNeighbourhood(
  listing: NormalizedComparable,
  neighbourhood: string | undefined,
): boolean {
  if (!neighbourhood?.trim()) return true;
  const needle = neighbourhood.trim().toLowerCase();
  const haystacks = [listing.neighbourhood, listing.title, listing.city]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return haystacks.some((value) => value.includes(needle));
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
    return { score: 10, reason: "property type match" };
  }
  if (target.includes("condo") && (hint === "condo" || /\bapartment\b/.test(title))) {
    return { score: 5, reason: "similar property type" };
  }
  return { score: -5 };
}

function evaluateListing(
  listing: NormalizedComparable,
  inputs: MarketRentResearchInputs,
): { included: boolean; score: number; reasons: string[]; exclusionReason?: string } {
  const reasons: string[] = [];
  let score = 0;

  if (normalizeCity(listing.city) !== normalizeCity(inputs.city)) {
    return { included: false, score: 0, reasons, exclusionReason: "Different city" };
  }
  reasons.push("same city");
  score += 20;

  if (!includesNeighbourhood(listing, inputs.neighbourhood)) {
    return {
      included: false,
      score,
      reasons,
      exclusionReason: "Neighbourhood keyword not found",
    };
  }
  if (inputs.neighbourhood?.trim()) {
    reasons.push("neighbourhood match");
    score += 10;
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
    const min = inputs.sqft * 0.75;
    const max = inputs.sqft * 1.25;
    if (listing.sqft < min || listing.sqft > max) {
      return {
        included: false,
        score,
        reasons,
        exclusionReason: `Sqft ${listing.sqft} outside ±25% of ${inputs.sqft}`,
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

export function matchComparableListings(
  inputs: MarketRentResearchInputs,
  listings: NormalizedComparable[],
): { matched: NormalizedComparable[]; excluded: NormalizedComparable[] } {
  const matched: NormalizedComparable[] = [];
  const excluded: NormalizedComparable[] = [];

  for (const listing of listings) {
    const evaluation = evaluateListing(listing, inputs);
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
