import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ScraperTimeoutError } from "../../errors";
import {
  fetchCraigslistRentals,
  fetchCraigslistRentalsWithRetry,
  fetchCraigslistSearchPayload,
} from "./craigslist-client";
import { mapCraigslistSearchPayload } from "./craigslist-mapper";

const FIXTURE_PAYLOAD = {
  data: {
    items: [
      {
        postingId: "7890123456",
        url: "https://vancouver.craigslist.org/van/apa/d/vancouver-2br-condo/7890123456.html",
        title: "Bright 2BR 1BA condo 850 sqft Kitsilano",
        price: 2800,
        bedrooms: 2,
        bathrooms: 1,
        sqft: 850,
        neighbourhood: "Kitsilano",
        postedAt: "2026-06-01T12:00:00.000Z",
      },
      {
        postingId: "7890123457",
        url: "https://vancouver.craigslist.org/van/apa/d/vancouver-1br/7890123457.html",
        title: "Cozy 1BR apartment downtown",
        price: 2200,
      },
      {
        postingId: "invalid",
        url: "https://vancouver.craigslist.org/van/apa/d/bad/invalid.html",
        title: "",
        price: 0,
      },
    ],
  },
};

describe("mapCraigslistSearchPayload", () => {
  it("parses fixture data into raw listing summaries", () => {
    const listings = mapCraigslistSearchPayload(FIXTURE_PAYLOAD, "Vancouver", "2026-06-04T00:00:00.000Z");

    assert.equal(listings.length, 2);

    const first = listings[0];
    assert.equal(first.source, "craigslist");
    assert.equal(first.sourceListingId, "7890123456");
    assert.equal(first.monthlyRent, 2800);
    assert.equal(first.bedrooms, 2);
    assert.equal(first.bathrooms, 1);
    assert.equal(first.sqft, 850);
    assert.equal(first.city, "Vancouver");
    assert.equal(first.neighbourhood, "Kitsilano");
    assert.equal(first.postedAt, "2026-06-01T12:00:00.000Z");
    assert.equal(first.capturedAt, "2026-06-04T00:00:00.000Z");
    assert.equal(first.propertyTypeHint, "condo");
  });

  it("parses beds/baths/sqft from title when fields are missing", () => {
    const listings = mapCraigslistSearchPayload(FIXTURE_PAYLOAD, "Vancouver");
    const second = listings.find((listing) => listing.sourceListingId === "7890123457");
    assert.ok(second);
    assert.equal(second.bedrooms, 1);
    assert.equal(second.propertyTypeHint, "condo");
  });

  it("returns empty array for invalid payloads", () => {
    assert.deepEqual(mapCraigslistSearchPayload(null, "Vancouver"), []);
    assert.deepEqual(mapCraigslistSearchPayload({}, "Vancouver"), []);
  });
});

describe("fetchCraigslistRentals", () => {
  it("uses injectable fetchFn with fixture response (no live network)", async () => {
    const fetchFn = async () =>
      new Response(JSON.stringify(FIXTURE_PAYLOAD), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const listings = await fetchCraigslistRentals(
      { citySlug: "vancouver", query: "Vancouver 2br condo", bedrooms: 2 },
      { fetchFn, cityDisplay: "Vancouver" },
    );

    assert.equal(listings.length, 2);
    assert.equal(listings[0].source, "craigslist");
  });

  it("throws ScraperTimeoutError on abort", async () => {
    const fetchFn = async (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("Aborted");
          error.name = "AbortError";
          reject(error);
        });
      });

    await assert.rejects(
      () =>
        fetchCraigslistSearchPayload(
          { citySlug: "vancouver", query: "test", bedrooms: 2 },
          { fetchFn, timeoutMs: 5 },
        ),
      (error: unknown) => error instanceof ScraperTimeoutError,
    );
  });

  it("retries once on HTTP 500 then succeeds", async () => {
    let attempts = 0;
    const fetchFn = async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response("error", { status: 500 });
      }
      return new Response(JSON.stringify(FIXTURE_PAYLOAD), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const listings = await fetchCraigslistRentalsWithRetry(
      { citySlug: "vancouver", query: "Vancouver 2br condo", bedrooms: 2 },
      { fetchFn, cityDisplay: "Vancouver" },
    );

    assert.equal(attempts, 2);
    assert.equal(listings.length, 2);
  });
});
