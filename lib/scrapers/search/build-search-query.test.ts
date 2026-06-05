import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCraigslistSearchParams,
  buildCraigslistSearchText,
} from "./build-search-query";
import {
  buildCraigslistSearchUrl,
  CRAIGSLIST_SEARCH_API,
} from "../providers/craigslist/craigslist-client";
import { matchComparableListings } from "@/lib/market-rent-research/matching";

describe("buildCraigslistSearchText", () => {
  it("builds a broad Port Moody query without postal code", () => {
    const query = buildCraigslistSearchText({
      city: "Port Moody",
      postalCode: "V3H 1Y8",
      propertyType: "Condo",
      bedrooms: 2,
      bathrooms: 2,
      sqft: 850,
    });
    assert.equal(query, "Port Moody 2br Condo");
    assert.doesNotMatch(query, /V3H/);
  });

  it("does not include neighbourhood or nearby areas in Craigslist query", () => {
    const query = buildCraigslistSearchText({
      city: "Vancouver",
      propertyType: "condo",
      bedrooms: 2,
      bathrooms: 1,
      neighbourhood: "Kitsilano",
      nearbyAreas: "Burnaby, Richmond",
      postalCode: "V6K 1A1",
    });
    assert.equal(query, "Vancouver 2br condo");
  });

  it("uses craigslistSearchArea when provided", () => {
    const query = buildCraigslistSearchText({
      city: "Port Moody",
      propertyType: "condo",
      bedrooms: 2,
      bathrooms: 2,
      craigslistSearchArea: "Port Moody Coquitlam Port Coquitlam",
    });
    assert.equal(query, "Port Moody Coquitlam Port Coquitlam 2br condo");
  });
});

describe("buildCraigslistSearchParams", () => {
  it("includes bedroom filters for SAPI", () => {
    const params = buildCraigslistSearchParams({
      city: "Vancouver",
      propertyType: "condo",
      bedrooms: 2,
      bathrooms: 1,
      neighbourhood: "Kitsilano",
    });
    assert.equal(params.citySlug, "vancouver");
    assert.equal(params.minBedrooms, 1);
    assert.equal(params.maxBedrooms, 3);
    assert.doesNotMatch(params.query, /Kitsilano/);
  });

  it("uses craigslist hostname override for Fraser Valley cities", () => {
    const params = buildCraigslistSearchParams({
      city: "Abbotsford",
      propertyType: "house",
      bedrooms: 3,
      bathrooms: 2,
      craigslistHostname: "abbotsford",
    });
    assert.equal(params.citySlug, "abbotsford");
  });

  it("still allows postal code in matching after fetch", () => {
    const matched = matchComparableListings(
      {
        city: "Port Moody",
        propertyType: "condo",
        bedrooms: 2,
        bathrooms: 2,
        postalCode: "V3H 1Y8",
      },
      [
        {
          source: "craigslist",
          sourceListingId: "1",
          sourceUrl: "https://example.com/1",
          title: "2BR condo near V3H 1Y8 Port Moody",
          monthlyRent: 2400,
          currency: "CAD",
          bedrooms: 2,
          bathrooms: 2,
          sqft: 850,
          city: "Port Moody",
          neighbourhood: null,
          postedAt: null,
          capturedAt: "2026-06-04T00:00:00.000Z",
          propertyTypeHint: "condo",
          matchScore: 0,
          matchReasons: [],
          excluded: false,
        },
      ],
    );
    assert.equal(matched.matched.length, 1);
    assert.ok((matched.matched[0]?.matchScore ?? 0) > 20);
  });
});

describe("buildCraigslistSearchUrl", () => {
  it("uses the corrected SAPI endpoint with area_id", () => {
    const url = buildCraigslistSearchUrl(
      {
        citySlug: "vancouver",
        query: "Port Moody 2br condo",
        bedrooms: 2,
        minBedrooms: 1,
        maxBedrooms: 3,
      },
      16,
    );
    assert.match(url, new RegExp(`^${CRAIGSLIST_SEARCH_API.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\?`));
    assert.match(url, /area_id=16/);
    assert.match(url, /searchPath=apa/);
    assert.match(url, /min_bedrooms=1/);
    assert.match(url, /max_bedrooms=3/);
    assert.doesNotMatch(url, /batch=/);
    assert.doesNotMatch(url, /\/full/);
  });
});
