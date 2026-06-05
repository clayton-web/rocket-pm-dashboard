import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCraigslistSearchText } from "@/lib/scrapers/search/build-search-query";
import {
  buildRegionalFallbackInputs,
  buildSearchWideningPhases,
  suggestRegionalFallbackSearch,
} from "./search-widening";

const portMoodyInputs = {
  city: "Port Moody",
  propertyType: "Condo",
  bedrooms: 2,
  bathrooms: 2,
  sqft: 850,
};

describe("suggestRegionalFallbackSearch", () => {
  it("maps Port Moody to Tri-Cities", () => {
    const fallback = suggestRegionalFallbackSearch(portMoodyInputs);
    assert.ok(fallback);
    assert.equal(fallback.regionLabel, "Tri-Cities");
    assert.match(fallback.craigslistSearchArea, /Coquitlam/i);
  });

  it("returns null when search area already matches regional fallback", () => {
    const fallback = suggestRegionalFallbackSearch({
      ...portMoodyInputs,
      craigslistSearchArea: "Port Moody Coquitlam Port Coquitlam",
    });
    assert.equal(fallback, null);
  });

  it("maps North Vancouver to North Shore", () => {
    const fallback = suggestRegionalFallbackSearch({
      city: "North Vancouver",
      propertyType: "condo",
      bedrooms: 2,
      bathrooms: 1,
    });
    assert.ok(fallback);
    assert.equal(fallback.regionLabel, "North Shore");
  });
});

describe("buildSearchWideningPhases", () => {
  it("includes regional fetch then relaxed sqft re-match", () => {
    const phases = buildSearchWideningPhases(portMoodyInputs);
    assert.equal(phases.length, 2);
    assert.equal(phases[0].label, "regional");
    assert.equal(phases[0].requiresFetch, true);
    assert.equal(phases[1].label, "relaxed-sqft");
    assert.equal(phases[1].requiresFetch, false);
    assert.equal(phases[1].matchOptions.sqftToleranceRatio, 0.4);
  });

  it("uses broadened Craigslist query for regional phase", () => {
    const phases = buildSearchWideningPhases(portMoodyInputs);
    const regionalQuery = buildCraigslistSearchText(phases[0].searchInputs);
    assert.match(regionalQuery, /Port Moody Coquitlam Port Coquitlam/i);
    assert.match(regionalQuery, /2br/i);
    assert.match(regionalQuery, /Condo/i);
  });

  it("buildRegionalFallbackInputs clears neighbourhood filter", () => {
    const fallback = suggestRegionalFallbackSearch({
      ...portMoodyInputs,
      neighbourhood: "Glenayre",
    });
    assert.ok(fallback);
    const regionalInputs = buildRegionalFallbackInputs(
      { ...portMoodyInputs, neighbourhood: "Glenayre" },
      fallback,
    );
    assert.equal(regionalInputs.neighbourhood, undefined);
    assert.equal(regionalInputs.craigslistSearchArea, fallback.craigslistSearchArea);
  });
});
