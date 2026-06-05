import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NormalizedComparable } from "@/lib/scrapers/types";
import {
  buildMatchingDiagnostics,
  buildRejectionReasonSummary,
  parseCraigslistAreaIdFromRequestUrl,
} from "./matching-diagnostics";

function listing(exclusionReason?: string): NormalizedComparable {
  return {
    source: "craigslist",
    sourceListingId: "1",
    sourceUrl: "https://example.com/1",
    title: "2BR condo",
    monthlyRent: 2500,
    currency: "CAD",
    bedrooms: 2,
    bathrooms: 2,
    sqft: 800,
    city: "Port Moody",
    neighbourhood: null,
    postedAt: null,
    capturedAt: "2026-06-04T00:00:00.000Z",
    propertyTypeHint: "condo",
    matchScore: 0,
    matchReasons: [],
    excluded: Boolean(exclusionReason),
    exclusionReason,
  };
}

describe("buildRejectionReasonSummary", () => {
  it("groups exclusion reasons for display", () => {
    const summary = buildRejectionReasonSummary([
      listing("Sqft 500 outside ±25% of 850"),
      listing("Sqft 600 outside ±25% of 850"),
      listing("Bedrooms 4 outside ±1 of 2"),
    ]);
    assert.deepEqual(summary, [
      { reason: "Sqft outside ±25% tolerance", count: 2 },
      { reason: "Bedroom count outside ±1", count: 1 },
    ]);
  });
});

describe("buildMatchingDiagnostics", () => {
  it("builds funnel counts", () => {
    const diagnostics = buildMatchingDiagnostics({
      rawListingCount: 4,
      matched: [listing()],
      excluded: [listing("Different city")],
      outlierExcluded: [],
      kept: [listing()],
      craigslistSearchQuery: "Port Moody 2br condo",
    });
    assert.equal(diagnostics.rawListingCount, 4);
    assert.equal(diagnostics.matchedCount, 1);
    assert.equal(diagnostics.rejectedCount, 1);
    assert.equal(diagnostics.keptCount, 1);
  });
});

describe("parseCraigslistAreaIdFromRequestUrl", () => {
  it("extracts area_id from SAPI request URLs", () => {
    assert.equal(
      parseCraigslistAreaIdFromRequestUrl(
        "https://sapi.craigslist.org/web/v8/postings/search?area_id=16&lang=en",
      ),
      16,
    );
    assert.equal(parseCraigslistAreaIdFromRequestUrl(undefined), null);
  });
});
