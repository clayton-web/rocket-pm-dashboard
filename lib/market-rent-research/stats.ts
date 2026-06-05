import type { MarketRentConfidence } from "@/lib/validation/market-rent-research";
import type { MarketRentSuggestedRent } from "./types";

export type RentStatistics = {
  count: number;
  median: number | null;
  mean: number | null;
  trimmedMean: number | null;
  min: number | null;
  max: number | null;
  p25: number | null;
  p75: number | null;
};

function sortAsc(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function roundToNearest25(value: number): number {
  return Math.round(value / 25) * 25;
}

export function removeIqrOutliers(rents: number[]): {
  kept: number[];
  removed: number[];
} {
  if (rents.length < 4) {
    return { kept: rents, removed: [] };
  }

  const sorted = sortAsc(rents);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  if (q1 == null || q3 == null) return { kept: rents, removed: [] };

  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;

  const kept: number[] = [];
  const removed: number[] = [];
  for (const rent of rents) {
    if (rent < lower || rent > upper) removed.push(rent);
    else kept.push(rent);
  }
  return { kept, removed };
}

export function computeRentStatistics(rents: number[]): RentStatistics {
  if (rents.length === 0) {
    return {
      count: 0,
      median: null,
      mean: null,
      trimmedMean: null,
      min: null,
      max: null,
      p25: null,
      p75: null,
    };
  }

  const sorted = sortAsc(rents);
  const count = sorted.length;
  const sum = sorted.reduce((acc, n) => acc + n, 0);
  const mean = sum / count;
  const trimCount = Math.floor(count * 0.1);
  const trimmedSlice =
    count > 2 ? sorted.slice(trimCount, count - trimCount || undefined) : sorted;
  const trimmedMean =
    trimmedSlice.length > 0
      ? trimmedSlice.reduce((acc, n) => acc + n, 0) / trimmedSlice.length
      : mean;

  return {
    count,
    median: percentile(sorted, 0.5),
    mean,
    trimmedMean,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p25: percentile(sorted, 0.25),
    p75: percentile(sorted, 0.75),
  };
}

export function computeDeterministicSuggestedRent(
  stats: RentStatistics,
): MarketRentSuggestedRent | null {
  if (stats.median == null) return null;

  const conservativeBase =
    stats.p25 != null ? Math.min(stats.p25, stats.median * 0.95) : stats.median * 0.95;
  const aggressiveBase =
    stats.p75 != null ? Math.max(stats.p75, stats.median * 1.05) : stats.median * 1.05;

  return {
    conservative: roundToNearest25(conservativeBase),
    recommended: roundToNearest25(stats.median),
    aggressive: roundToNearest25(aggressiveBase),
    currency: "CAD",
  };
}

export function computeConfidenceFromCompCount(
  count: number,
  missingFieldRatio: number,
  options?: { searchWasGeographicallyBroadened?: boolean },
): { confidence: MarketRentConfidence; reason: string } {
  if (count <= 2) {
    return {
      confidence: "low",
      reason:
        count === 1
          ? "Based on 1 comparable listing only."
          : `Based on ${count} comparable listings only.`,
    };
  }
  if (count <= 5) {
    let reason = `Based on ${count} comparable Craigslist listings.`;
    if (options?.searchWasGeographicallyBroadened) {
      reason += " Search was broadened beyond the original area.";
    }
    return { confidence: "medium", reason };
  }
  if (missingFieldRatio > 0.5) {
    return {
      confidence: "medium",
      reason: `Based on ${count} listings, but many are missing beds, baths, or sqft.`,
    };
  }
  if (options?.searchWasGeographicallyBroadened) {
    return {
      confidence: "medium",
      reason: `Based on ${count} comparable listings after broadening the search area.`,
    };
  }
  return {
    confidence: "high",
    reason: `Based on ${count} comparable Craigslist listings with consistent fields.`,
  };
}

export function computeMissingFieldRatio(
  listings: Array<{ bedrooms: number | null; bathrooms: number | null; sqft: number | null }>,
): number {
  if (listings.length === 0) return 1;
  let missing = 0;
  for (const listing of listings) {
    if (listing.bedrooms == null) missing += 1;
    if (listing.bathrooms == null) missing += 1;
    if (listing.sqft == null) missing += 1;
  }
  return missing / (listings.length * 3);
}

const CONFIDENCE_RANK: Record<MarketRentConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

/** Maximum confidence allowed from matched comp count and field completeness. */
export function getMaxAllowedConfidence(
  count: number,
  missingFieldRatio: number,
  options?: { searchWasGeographicallyBroadened?: boolean },
): MarketRentConfidence {
  if (count <= 2) return "low";
  if (count <= 5) return "medium";
  if (missingFieldRatio > 0.5 || options?.searchWasGeographicallyBroadened) return "medium";
  return "high";
}

export function downgradeConfidence(
  confidence: MarketRentConfidence,
  maxAllowed: MarketRentConfidence,
): MarketRentConfidence {
  return CONFIDENCE_RANK[confidence] > CONFIDENCE_RANK[maxAllowed] ? maxAllowed : confidence;
}
