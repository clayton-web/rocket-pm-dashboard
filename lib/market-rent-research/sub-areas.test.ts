import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCraigslistSearchText } from "@/lib/scrapers/search/build-search-query";
import type { MarketRentResearchInputs } from "@/lib/validation/market-rent-research";
import { matchComparableListings } from "./matching";
import type { NormalizedComparable } from "@/lib/scrapers/types";
import {
  MARKET_RENT_SUB_AREA_NOT_SPECIFIED_ID,
  MARKET_RENT_SUB_AREA_OPTIONS,
  MARKET_RENT_SUB_AREA_OTHER_ID,
  buildSubAreaDataQualityNote,
  getMarketRentSubAreaCities,
  getMarketRentSubAreasGroupedByCity,
  resolveNeighbourhoodFromSubAreaSelection,
  suggestSubAreaSelectionForCity,
} from "./sub-areas";

const baseInputs: MarketRentResearchInputs = {
  city: "Vancouver",
  propertyType: "condo",
  bedrooms: 2,
  bathrooms: 1,
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

describe("market rent sub-areas", () => {
  it("includes metro Vancouver and Fraser Valley cities", () => {
    const cities = getMarketRentSubAreaCities();
    for (const city of [
      "Vancouver",
      "Burnaby",
      "New Westminster",
      "Richmond",
      "North Vancouver",
      "West Vancouver",
      "Coquitlam",
      "Port Coquitlam",
      "Port Moody",
      "Surrey",
      "Langley",
      "Maple Ridge",
      "Pitt Meadows",
      "Delta",
      "White Rock",
      "Abbotsford",
      "Mission",
      "Chilliwack",
    ]) {
      assert.ok(cities.includes(city), `missing city ${city}`);
    }
    assert.ok(MARKET_RENT_SUB_AREA_OPTIONS.length > cities.length);
  });

  it("groups options by city with city-wide and neighbourhood entries", () => {
    const groups = getMarketRentSubAreasGroupedByCity();
    const portMoody = groups.find((group) => group.city === "Port Moody");
    assert.ok(portMoody);
    assert.ok(portMoody.options.some((option) => option.label === "City-wide"));
    assert.ok(portMoody.options.some((option) => option.neighbourhood === "Glenayre"));
  });

  it("resolves selected sub-area into a neighbourhood keyword", () => {
    const glenayre = MARKET_RENT_SUB_AREA_OPTIONS.find(
      (option) => option.city === "Port Moody" && option.neighbourhood === "Glenayre",
    );
    assert.ok(glenayre);
    assert.equal(resolveNeighbourhoodFromSubAreaSelection(glenayre.id), "Glenayre");
  });

  it("resolves custom sub-area when Other is selected", () => {
    assert.equal(
      resolveNeighbourhoodFromSubAreaSelection(MARKET_RENT_SUB_AREA_OTHER_ID, "  Moody Centre "),
      "Moody Centre",
    );
  });

  it("returns undefined for blank, city-wide, and empty custom values", () => {
    assert.equal(
      resolveNeighbourhoodFromSubAreaSelection(MARKET_RENT_SUB_AREA_NOT_SPECIFIED_ID),
      undefined,
    );
    assert.equal(
      resolveNeighbourhoodFromSubAreaSelection(suggestSubAreaSelectionForCity("Vancouver")),
      undefined,
    );
    assert.equal(
      resolveNeighbourhoodFromSubAreaSelection(MARKET_RENT_SUB_AREA_OTHER_ID, "   "),
      undefined,
    );
    assert.equal(resolveNeighbourhoodFromSubAreaSelection("not-a-real-id"), undefined);
  });

  it("passes selected sub-area into Craigslist query text", () => {
    const kits = MARKET_RENT_SUB_AREA_OPTIONS.find(
      (option) => option.city === "Vancouver" && option.neighbourhood === "Kitsilano",
    );
    assert.ok(kits);
    const neighbourhood = resolveNeighbourhoodFromSubAreaSelection(kits.id);
    const query = buildCraigslistSearchText({
      ...baseInputs,
      neighbourhood,
    });
    assert.match(query, /Kitsilano/);
  });

  it("uses selected sub-area in matching without crashing on blank values", () => {
    const withNeighbourhood = matchComparableListings(
      { ...baseInputs, neighbourhood: "Kitsilano" },
      [
        listing({ sourceListingId: "match", title: "2BR Kitsilano condo Vancouver" }),
        listing({ sourceListingId: "miss", title: "2BR Burnaby condo Vancouver", neighbourhood: "Metrotown" }),
      ],
    );
    assert.deepEqual(
      withNeighbourhood.matched.map((item) => item.sourceListingId),
      ["match"],
    );

    const blank = matchComparableListings(baseInputs, [
      listing({ sourceListingId: "a" }),
      listing({ sourceListingId: "b", neighbourhood: "Downtown" }),
    ]);
    assert.equal(blank.matched.length, 2);
  });

  it("builds a data quality note when neighbourhood filter is active", () => {
    assert.equal(buildSubAreaDataQualityNote("Glenayre"), "Neighbourhood filter applied: Glenayre.");
    assert.equal(buildSubAreaDataQualityNote(undefined), undefined);
    assert.equal(buildSubAreaDataQualityNote("  "), undefined);
  });
});
