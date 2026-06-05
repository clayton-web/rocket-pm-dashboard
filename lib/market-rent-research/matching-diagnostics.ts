import type { NormalizedComparable } from "@/lib/scrapers/types";

export type MarketRentRejectionReasonSummary = {
  reason: string;
  count: number;
};

export type MarketRentMatchingDiagnostics = {
  rawListingCount: number;
  matchedCount: number;
  rejectedCount: number;
  keptCount: number;
  rejectionReasons: MarketRentRejectionReasonSummary[];
  craigslistSearchQuery?: string;
  craigslistHostname?: string;
  craigslistAreaId?: number | null;
};

function summarizeExclusionReason(reason: string): string {
  if (reason.startsWith("Bedrooms ")) return "Bedroom count outside ±1";
  if (reason.startsWith("Bathrooms ")) return "Bathroom count outside ±1";
  if (reason.startsWith("Sqft ")) return "Sqft outside ±25% tolerance";
  if (reason === "Different city") return "Different city";
  if (reason === "Neighbourhood keyword not found") return "Neighbourhood mismatch";
  if (reason === "Rent outside IQR outlier bounds") return "Rent outlier (IQR)";
  return reason;
}

export function buildRejectionReasonSummary(
  excluded: NormalizedComparable[],
): MarketRentRejectionReasonSummary[] {
  const counts = new Map<string, number>();
  for (const listing of excluded) {
    const label = summarizeExclusionReason(listing.exclusionReason ?? "Unknown");
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

export function buildMatchingDiagnostics(args: {
  rawListingCount: number;
  matched: NormalizedComparable[];
  excluded: NormalizedComparable[];
  outlierExcluded: NormalizedComparable[];
  kept: NormalizedComparable[];
  craigslistSearchQuery?: string;
  craigslistHostname?: string;
  craigslistAreaId?: number | null;
}): MarketRentMatchingDiagnostics {
  const allRejected = [...args.excluded, ...args.outlierExcluded];
  return {
    rawListingCount: args.rawListingCount,
    matchedCount: args.matched.length,
    rejectedCount: allRejected.length,
    keptCount: args.kept.length,
    rejectionReasons: buildRejectionReasonSummary(allRejected),
    craigslistSearchQuery: args.craigslistSearchQuery,
    craigslistHostname: args.craigslistHostname,
    craigslistAreaId: args.craigslistAreaId,
  };
}

/** Preview-only — expose comp funnel diagnostics in Research Details. */
export function isMarketRentPreviewMatchingDiagnosticsEnabled(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

export function parseCraigslistAreaIdFromRequestUrl(requestUrl: string | undefined): number | null {
  if (!requestUrl) return null;
  const match = /[?&]area_id=(\d+)/.exec(requestUrl);
  if (!match) return null;
  const areaId = Number(match[1]);
  return Number.isInteger(areaId) && areaId > 0 ? areaId : null;
}
