import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ScraperTimeoutError } from "../../errors";
import { clearCraigslistAreaIdCache } from "./craigslist-area-id";
import {
  buildCraigslistSearchUrl,
  clearLastCraigslistProviderDiagnostics,
  fetchCraigslistRentals,
  fetchCraigslistRentalsWithRetry,
  fetchCraigslistSearchPayload,
  getLastCraigslistProviderDiagnostics,
} from "./craigslist-client";
import {
  buildCraigslistListingUrl,
  getCraigslistSearchTotalCount,
  mapCraigslistSearchPayload,
} from "./craigslist-mapper";

const FIXTURE_DIR = fileURLToPath(new URL("../../fixtures/", import.meta.url));
const LIVE_SAPI_FIXTURE = JSON.parse(
  readFileSync(`${FIXTURE_DIR}craigslist-sapi-vancouver-sample.json`, "utf8"),
);

const LEGACY_FIXTURE_PAYLOAD = {
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

function mockCraigslistFetch(payload: unknown, areaId = 16) {
  return async (url: string) => {
    if (url.includes(".craigslist.org/search/apa")) {
      return new Response(`"areaId":${areaId}`, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

describe("mapCraigslistSearchPayload", () => {
  it("parses legacy fixture data into raw listing summaries", () => {
    const listings = mapCraigslistSearchPayload(
      LEGACY_FIXTURE_PAYLOAD,
      "Vancouver",
      "2026-06-04T00:00:00.000Z",
    );

    assert.equal(listings.length, 2);
    assert.equal(listings[0].sourceListingId, "7890123456");
    assert.equal(listings[0].monthlyRent, 2800);
    assert.equal(listings[0].neighbourhood, "Kitsilano");
  });

  it("parses live Craigslist SAPI schema fixtures", () => {
    const listings = mapCraigslistSearchPayload(LIVE_SAPI_FIXTURE, "Vancouver");
    assert.equal(listings.length, 2);

    const first = listings[0];
    assert.equal(first.sourceListingId, "7939025820");
    assert.equal(first.monthlyRent, 2800);
    assert.equal(first.bedrooms, 2);
    assert.equal(first.sqft, 850);
    assert.equal(first.neighbourhood, "kitsilano");
    assert.match(first.sourceUrl, /vancouver\.craigslist\.org\/kst\/apa\/d\//);
  });

  it("builds listing URLs from SAPI fields", () => {
    const url = buildCraigslistListingUrl({
      postingId: 7939025820,
      categoryAbbr: "apa",
      seo: "vancouver-bright-2br-condo-kitsilano",
      location: { hostname: "vancouver", subareaAbbr: "kst" },
      title: "Bright 2BR condo",
      price: 2800,
    });
    assert.equal(
      url,
      "https://vancouver.craigslist.org/kst/apa/d/vancouver-bright-2br-condo-kitsilano/7939025820.html",
    );
  });

  it("reads totalResultCount from SAPI payload", () => {
    assert.equal(getCraigslistSearchTotalCount(LIVE_SAPI_FIXTURE), 393);
  });

  it("returns empty array for invalid payloads", () => {
    assert.deepEqual(mapCraigslistSearchPayload(null, "Vancouver"), []);
    assert.deepEqual(mapCraigslistSearchPayload({}, "Vancouver"), []);
  });
});

describe("fetchCraigslistRentals", () => {
  afterEach(() => {
    clearCraigslistAreaIdCache();
    clearLastCraigslistProviderDiagnostics();
  });

  it("uses injectable fetchFn with SAPI fixture response (no live network)", async () => {
    const listings = await fetchCraigslistRentals(
      { citySlug: "vancouver", query: "Vancouver 2br condo", bedrooms: 2 },
      { fetchFn: mockCraigslistFetch(LIVE_SAPI_FIXTURE), cityDisplay: "Vancouver" },
    );

    assert.equal(listings.length, 2);
    assert.equal(listings[0].source, "craigslist");
  });

  it("records successful provider diagnostics", async () => {
    await fetchCraigslistRentals(
      { citySlug: "vancouver", query: "Vancouver 2br condo", bedrooms: 2, areaId: 16 },
      { fetchFn: mockCraigslistFetch(LIVE_SAPI_FIXTURE), cityDisplay: "Vancouver" },
    );

    const diagnostics = getLastCraigslistProviderDiagnostics();
    assert.ok(diagnostics);
    assert.equal(diagnostics?.success, true);
    assert.match(diagnostics?.requestUrl ?? "", /area_id=16/);
    assert.ok((diagnostics?.elapsedMs ?? 0) >= 0);
  });

  it("builds SAPI URL with area_id when pre-resolved", () => {
    const url = buildCraigslistSearchUrl(
      {
        citySlug: "vancouver",
        query: "2br",
        bedrooms: 2,
        minBedrooms: 1,
        maxBedrooms: 3,
        minPrice: 2000,
        maxPrice: 3500,
      },
      16,
    );
    assert.match(url, /min_price=2000/);
    assert.match(url, /max_price=3500/);
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
          { citySlug: "vancouver", query: "test", bedrooms: 2, areaId: 16 },
          { fetchFn, timeoutMs: 5 },
        ),
      (error: unknown) => error instanceof ScraperTimeoutError,
    );
  });

  it("records failure diagnostics on HTTP error", async () => {
    const fetchFn = async (url: string) => {
      if (url.includes(".craigslist.org/search/apa")) {
        return new Response('"areaId":16', { status: 200 });
      }
      return new Response('{"errors":[{"message":"Internal error"}]}', { status: 500 });
    };

    await assert.rejects(
      () =>
        fetchCraigslistRentals(
          { citySlug: "vancouver", query: "test", bedrooms: 2, areaId: 16 },
          { fetchFn },
        ),
      (error: unknown) => error instanceof Error,
    );

    const diagnostics = getLastCraigslistProviderDiagnostics();
    assert.ok(diagnostics);
    assert.equal(diagnostics?.success, false);
    assert.equal(diagnostics?.httpStatus, 500);
    assert.match(diagnostics?.responseBodySnippet ?? "", /Internal error/);
  });

  it("retries once on HTTP 500 then succeeds", async () => {
    let sapiAttempts = 0;
    const fetchFn = async (url: string) => {
      if (url.includes(".craigslist.org/search/apa")) {
        return new Response('"areaId":16', { status: 200 });
      }
      sapiAttempts += 1;
      if (sapiAttempts === 1) {
        return new Response("error", { status: 500 });
      }
      return new Response(JSON.stringify(LIVE_SAPI_FIXTURE), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const listings = await fetchCraigslistRentalsWithRetry(
      { citySlug: "vancouver", query: "Vancouver 2br condo", bedrooms: 2, areaId: 16 },
      { fetchFn, cityDisplay: "Vancouver" },
    );

    assert.equal(sapiAttempts, 2);
    assert.equal(listings.length, 2);
  });
});
