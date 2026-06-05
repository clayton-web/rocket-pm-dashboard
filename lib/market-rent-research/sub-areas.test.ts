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
  resolveSubAreaForResearch,
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
    neighbourhood: overrides.neighbourhood ?? null,
    postedAt: null,
    capturedAt: "2026-06-04T00:00:00.000Z",
    propertyTypeHint: overrides.propertyTypeHint ?? "condo",
    matchScore: 0,
    matchReasons: [],
    excluded: false,
    ...overrides,
  };
}

describe("market rent Craigslist sub-areas", () => {
  it("includes metro Vancouver and Fraser Valley cities", () => {
    const cities = getMarketRentSubAreaCities();
    for (const city of [
      "Vancouver",
      "Burnaby",
      "Port Moody",
      "Abbotsford",
      "Chilliwack",
    ]) {
      assert.ok(cities.includes(city), `missing city ${city}`);
    }
  });

  it("groups Craigslist-compatible options by property city", () => {
    const groups = getMarketRentSubAreasGroupedByCity();
    const portMoody = groups.find((group) => group.city === "Port Moody");
    assert.ok(portMoody);
    assert.ok(portMoody.options.some((option) => option.label === "City-wide"));
    assert.ok(portMoody.options.some((option) => option.label === "Tri-Cities"));
    assert.ok(
      portMoody.options.every((option) => option.hostname === "vancouver"),
    );
  });

  it("resolves Tri-Cities into Craigslist query text but not matching neighbourhood", () => {
    const triCities = MARKET_RENT_SUB_AREA_OPTIONS.find(
      (option) => option.city === "Port Moody" && option.label === "Tri-Cities",
    );
    assert.ok(triCities);
    const resolved = resolveSubAreaForResearch(triCities.id);
    assert.equal(resolved.craigslistSearchArea, "Port Moody Coquitlam Port Coquitlam");
    assert.equal(resolved.craigslistHostname, "vancouver");
    assert.equal(resolved.matchingNeighbourhood, undefined);
  });

  it("uses custom keyword for matching only", () => {
    assert.equal(
      resolveNeighbourhoodFromSubAreaSelection(MARKET_RENT_SUB_AREA_OTHER_ID, "Moody Centre"),
      "Moody Centre",
    );
    const resolved = resolveSubAreaForResearch(
      MARKET_RENT_SUB_AREA_OTHER_ID,
      "Moody Centre Newport Village",
    );
    assert.equal(resolved.matchingNeighbourhood, "Moody Centre Newport Village");
    assert.equal(resolved.craigslistSearchArea, undefined);

    const query = buildCraigslistSearchText({
      ...baseInputs,
      city: "Port Moody",
      neighbourhood: resolved.matchingNeighbourhood,
      postalCode: "V3H 1Y8",
    });
    assert.equal(query, "Port Moody 2br condo");
    assert.doesNotMatch(query, /Moody Centre/);
    assert.doesNotMatch(query, /V3H/);
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
  });

  it("applies matching neighbourhood filter without affecting Craigslist query", () => {
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

    const query = buildCraigslistSearchText({ ...baseInputs, neighbourhood: "Kitsilano" });
    assert.equal(query, "Vancouver 2br condo");
  });

  it("builds a data quality note when matching filter is active", () => {
    assert.match(buildSubAreaDataQualityNote("Glenayre") ?? "", /Matching filter applied/);
    assert.equal(buildSubAreaDataQualityNote(undefined), undefined);
  });
});
