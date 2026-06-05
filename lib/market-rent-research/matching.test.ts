import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NormalizedComparable } from "@/lib/scrapers/types";
import type { MarketRentResearchInputs } from "@/lib/validation/market-rent-research";
import { applyOutlierExclusions, matchComparableListings, matchesPostalCode } from "./matching";

const baseInputs: MarketRentResearchInputs = {
  city: "Vancouver",
  propertyType: "condo",
  bedrooms: 2,
  bathrooms: 1,
  sqft: 800,
};

function listing(overrides: Partial<NormalizedComparable> = {}): NormalizedComparable {
  return {
    source: "craigslist",
    sourceListingId: overrides.sourceListingId ?? "1",
    sourceUrl: overrides.sourceUrl ?? "https://example.com/1",
    title: overrides.title ?? "2BR condo Vancouver",
    monthlyRent: overrides.monthlyRent ?? 2500,
    currency: "CAD",
    bedrooms: overrides.bedrooms ?? 2,
    bathrooms: overrides.bathrooms ?? 1,
    sqft: overrides.sqft ?? 800,
    city: overrides.city ?? "Vancouver",
    neighbourhood: overrides.neighbourhood ?? "Kitsilano",
    postedAt: null,
    capturedAt: "2026-06-04T00:00:00.000Z",
    propertyTypeHint: overrides.propertyTypeHint ?? "condo",
    matchScore: 0,
    matchReasons: [],
    excluded: false,
    ...overrides,
  };
}

describe("matchComparableListings", () => {
  it("matches bedrooms within ±1", () => {
    const { matched, excluded } = matchComparableListings(baseInputs, [
      listing({ sourceListingId: "ok", bedrooms: 2 }),
      listing({ sourceListingId: "plus1", bedrooms: 3 }),
      listing({ sourceListingId: "minus1", bedrooms: 1 }),
      listing({ sourceListingId: "too-far", bedrooms: 4 }),
    ]);

    assert.deepEqual(
      matched.map((item) => item.sourceListingId).sort(),
      ["minus1", "ok", "plus1"],
    );
    assert.equal(excluded.length, 1);
    assert.match(excluded[0].exclusionReason ?? "", /Bedrooms 4/);
  });

  it("matches bathrooms within ±1 when available", () => {
    const { matched, excluded } = matchComparableListings(baseInputs, [
      listing({ sourceListingId: "ok", bathrooms: 1 }),
      listing({ sourceListingId: "plus1", bathrooms: 2 }),
      listing({ sourceListingId: "too-far", bathrooms: 3 }),
      listing({ sourceListingId: "missing", bathrooms: null }),
    ]);

    assert.deepEqual(
      matched.map((item) => item.sourceListingId).sort(),
      ["missing", "ok", "plus1"],
    );
    assert.equal(excluded.length, 1);
    assert.match(excluded[0].exclusionReason ?? "", /Bathrooms 3/);
  });

  it("matches sqft within ±25% when available", () => {
    const { matched, excluded } = matchComparableListings(baseInputs, [
      listing({ sourceListingId: "ok", sqft: 800 }),
      listing({ sourceListingId: "low", sqft: 600 }),
      listing({ sourceListingId: "high", sqft: 1000 }),
      listing({ sourceListingId: "too-small", sqft: 500 }),
    ]);

    assert.deepEqual(
      matched.map((item) => item.sourceListingId).sort(),
      ["high", "low", "ok"],
    );
    assert.equal(excluded.length, 1);
    assert.match(excluded[0].exclusionReason ?? "", /Sqft 500/);
  });

  it("ranks postal code matches above neighbourhood-only matches", () => {
    const inputs: MarketRentResearchInputs = {
      ...baseInputs,
      postalCode: "V6K1A1",
      neighbourhood: "Kitsilano",
    };
    const { matched } = matchComparableListings(inputs, [
      listing({
        sourceListingId: "neighbourhood-only",
        title: "2BR condo Kitsilano Vancouver",
        neighbourhood: "Kitsilano",
      }),
      listing({
        sourceListingId: "postal-match",
        title: "2BR condo Kitsilano near V6K 1A1 Vancouver",
        neighbourhood: "Kitsilano",
      }),
    ]);

    assert.equal(matched[0]?.sourceListingId, "postal-match");
    assert.ok((matched[0]?.matchScore ?? 0) > (matched[1]?.matchScore ?? 0));
  });
});

describe("matchesPostalCode", () => {
  it("matches full postal code or FSA in listing text", () => {
    const base = listing({ title: "2BR condo Vancouver" });
    assert.equal(matchesPostalCode(base, "V6K 1A1"), false);
    assert.equal(
      matchesPostalCode({ ...base, title: "2BR condo V6K1A1 Vancouver" }, "V6K 1A1"),
      true,
    );
    assert.equal(
      matchesPostalCode({ ...base, title: "2BR condo V6K area Vancouver" }, "V6K 1A1"),
      true,
    );
  });
});

describe("applyOutlierExclusions", () => {
  it("removes rent outliers using IQR when sample size allows", () => {
    const matched = [
      listing({ sourceListingId: "a", monthlyRent: 2400 }),
      listing({ sourceListingId: "b", monthlyRent: 2450 }),
      listing({ sourceListingId: "c", monthlyRent: 2500 }),
      listing({ sourceListingId: "d", monthlyRent: 2550 }),
      listing({ sourceListingId: "outlier", monthlyRent: 5000 }),
    ];

    const { kept, outlierExcluded } = applyOutlierExclusions(matched);

    assert.equal(kept.length, 4);
    assert.equal(outlierExcluded.length, 1);
    assert.equal(outlierExcluded[0].sourceListingId, "outlier");
    assert.match(outlierExcluded[0].exclusionReason ?? "", /IQR/);
  });

  it("keeps all listings when fewer than 4 comps", () => {
    const matched = [
      listing({ sourceListingId: "a", monthlyRent: 2400 }),
      listing({ sourceListingId: "b", monthlyRent: 5000 }),
    ];
    const { kept, outlierExcluded } = applyOutlierExclusions(matched);
    assert.equal(kept.length, 2);
    assert.equal(outlierExcluded.length, 0);
  });
});
