import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCraigslistSearchParams } from "./build-search-query";
import {
  buildCraigslistSearchUrl,
  CRAIGSLIST_SEARCH_API,
} from "../providers/craigslist/craigslist-client";

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
    assert.match(params.query, /Kitsilano/);
  });

  it("maps Abbotsford to abbotsford hostname", () => {
    const params = buildCraigslistSearchParams({
      city: "Abbotsford",
      propertyType: "house",
      bedrooms: 3,
      bathrooms: 2,
    });
    assert.equal(params.citySlug, "abbotsford");
  });
});

describe("buildCraigslistSearchUrl", () => {
  it("uses the corrected SAPI endpoint with area_id", () => {
    const url = buildCraigslistSearchUrl(
      {
        citySlug: "vancouver",
        query: "Vancouver 2br condo",
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
