import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCraigslistSearchText } from "@/lib/scrapers/search/build-search-query";
import { runCompSearchWithWidening } from "./comp-search";
import { MIN_MATCHED_COMPS_TARGET } from "./search-widening";

function listing(id: string, rent: number, sqft = 850) {
  return {
    postingId: id,
    url: `https://vancouver.craigslist.org/van/apa/d/${id}.html`,
    title: `Bright 2BR 2BA condo ${sqft} sqft`,
    price: rent,
    bedrooms: 2,
    bathrooms: 2,
    sqft,
    neighbourhood: "Glenayre",
  };
}

function mockWideningFetch(payloads: Record<string, { items: unknown[] }>) {
  return async (url: string) => {
    if (url.includes(".craigslist.org/search/apa")) {
      return new Response('"areaId":16', { status: 200 });
    }
    const queryMatch = /query=([^&]+)/.exec(url);
    const query = queryMatch ? decodeURIComponent(queryMatch[1].replace(/\+/g, " ")) : "";
    const payload = payloads[query] ?? { items: [] };
    return new Response(JSON.stringify({ data: payload }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

const portMoodyInputs = {
  city: "Port Moody",
  propertyType: "Condo",
  bedrooms: 2,
  bathrooms: 2,
  sqft: 850,
};

describe("runCompSearchWithWidening", () => {
  it("triggers regional fallback when original search has fewer than 3 matched comps", async () => {
    const originalQuery = buildCraigslistSearchText(portMoodyInputs);
    const regionalQuery = buildCraigslistSearchText({
      ...portMoodyInputs,
      craigslistSearchArea: "Port Moody Coquitlam Port Coquitlam",
      craigslistHostname: "vancouver",
    });

    const result = await runCompSearchWithWidening(portMoodyInputs, {
      fetchFn: mockWideningFetch({
        [originalQuery]: { items: [listing("1", 2400), listing("2", 2450)] },
        [regionalQuery]: {
          items: [
            listing("3", 2500),
            listing("4", 2550),
            listing("5", 2600),
            listing("6", 2650),
          ],
        },
      }),
    });

    assert.ok(result.searchAttempts.length >= 2);
    assert.equal(result.searchAttempts[0].craigslistSearchQuery, originalQuery);
    assert.ok(result.searchAttempts.some((attempt) => attempt.craigslistSearchQuery === regionalQuery));
    assert.ok(result.kept.length >= MIN_MATCHED_COMPS_TARGET);
    assert.equal(result.searchWasGeographicallyBroadened, true);
  });

  it("records search attempts with raw and matched counts", async () => {
    const originalQuery = buildCraigslistSearchText(portMoodyInputs);
    const result = await runCompSearchWithWidening(portMoodyInputs, {
      fetchFn: mockWideningFetch({
        [originalQuery]: { items: [listing("1", 2400), listing("2", 2450), listing("3", 2500)] },
      }),
    });

    assert.equal(result.searchAttempts.length, 1);
    assert.equal(result.searchAttempts[0].rawListingCount, 3);
    assert.ok(result.searchAttempts[0].matchedCount >= 2);
  });

  it("selects best fallback set when regional search improves comps", async () => {
    const originalQuery = buildCraigslistSearchText(portMoodyInputs);
    const regionalQuery = buildCraigslistSearchText({
      ...portMoodyInputs,
      craigslistSearchArea: "Port Moody Coquitlam Port Coquitlam",
      craigslistHostname: "vancouver",
    });

    const result = await runCompSearchWithWidening(portMoodyInputs, {
      fetchFn: mockWideningFetch({
        [originalQuery]: { items: [listing("1", 2400)] },
        [regionalQuery]: {
          items: [
            listing("2", 2450),
            listing("3", 2500),
            listing("4", 2550),
            listing("5", 2600),
          ],
        },
      }),
    });

    assert.ok(result.kept.length >= 3);
    assert.ok(result.searchAttempts[0].keptCount < result.kept.length);
  });
});
