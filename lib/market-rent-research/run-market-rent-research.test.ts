import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { ScraperFetchError } from "@/lib/scrapers/errors";
import {
  MARKET_RENT_RESEARCH_NO_COMPS_MESSAGE,
  MARKET_RENT_RESEARCH_NO_PROVIDERS_MESSAGE,
} from "./constants";
import { runMarketRentResearch } from "./run-market-rent-research";
import { MARKET_RENT_OPENAI_FALLBACK_NOTE } from "./synthesize-with-openai";

const validInputs = {
  city: "Vancouver",
  neighbourhood: "Kitsilano",
  propertyType: "condo",
  bedrooms: 2,
  bathrooms: 1,
  sqft: 850,
};

const FIXTURE_PAYLOAD = {
  data: {
    items: [
      {
        postingId: "1",
        url: "https://vancouver.craigslist.org/van/apa/d/1.html",
        title: "Bright 2BR 1BA condo 850 sqft Kitsilano",
        price: 2800,
        bedrooms: 2,
        bathrooms: 1,
        sqft: 850,
        neighbourhood: "Kitsilano",
      },
      {
        postingId: "2",
        url: "https://vancouver.craigslist.org/van/apa/d/2.html",
        title: "2BR 1BA condo Kits 820 sqft",
        price: 2750,
        bedrooms: 2,
        bathrooms: 1,
        sqft: 820,
        neighbourhood: "Kitsilano",
      },
      {
        postingId: "3",
        url: "https://vancouver.craigslist.org/van/apa/d/3.html",
        title: "Modern 2BR 1BA condo 860 sqft",
        price: 2900,
        bedrooms: 2,
        bathrooms: 1,
        sqft: 860,
        neighbourhood: "Kitsilano",
      },
      {
        postingId: "4",
        url: "https://vancouver.craigslist.org/van/apa/d/4.html",
        title: "Spacious 3BR condo Kits",
        price: 3200,
        bedrooms: 3,
        bathrooms: 2,
        sqft: 900,
        neighbourhood: "Kitsilano",
      },
    ],
  },
};

function fixtureFetch() {
  return async () =>
    new Response(JSON.stringify(FIXTURE_PAYLOAD), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
}

const mockOpenAiSuccess = async () => ({
  suggestedRent: {
    conservative: 2750,
    recommended: 2800,
    aggressive: 2900,
    currency: "CAD",
  },
  confidence: "high",
  confidenceReason: "Four similar Craigslist comps support a mid-$2,700 range.",
  explanation: "Comparable listings cluster near $2,800 for similar 2-bedroom condos in Kitsilano.",
  comparableListingsUsed: [],
  dataQualityNotes: [],
});

describe("runMarketRentResearch", () => {
  const originalCraigslist = process.env.MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED;
  const originalOpenAi = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (originalCraigslist === undefined) delete process.env.MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED;
    else process.env.MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED = originalCraigslist;
    if (originalOpenAi === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAi;
  });

  it("returns no_providers when Craigslist flag is off", async () => {
    delete process.env.MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED;
    const result = await runMarketRentResearch(validInputs);
    assert.equal(result.ok, true);
    if (!result.ok || result.status !== "no_providers") return;
    assert.equal(result.message, MARKET_RENT_RESEARCH_NO_PROVIDERS_MESSAGE);
  });

  it("returns success with stats when Craigslist is enabled and fixture fetch succeeds", async () => {
    process.env.MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED = "true";
    delete process.env.OPENAI_API_KEY;
    const result = await runMarketRentResearch(validInputs, {
      fetchCraigslist: fixtureFetch(),
    });

    assert.equal(result.ok, true);
    if (!result.ok || result.status !== "success") return;
    assert.ok(result.result.suggestedRent.recommended > 0);
    assert.equal(result.result.explanationSource, "deterministic");
    assert.ok(result.result.comparableListingsUsed.length >= 3);
  });

  it("returns deterministic fallback when OpenAI key is missing", async () => {
    process.env.MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED = "true";
    delete process.env.OPENAI_API_KEY;
    const result = await runMarketRentResearch(validInputs, {
      fetchCraigslist: fixtureFetch(),
    });
    assert.equal(result.ok, true);
    if (!result.ok || result.status !== "success") return;
    assert.equal(result.result.explanationSource, "deterministic");
    assert.ok(result.result.suggestedRent.recommended > 0);
  });

  it("uses OpenAI explanation when mocked completion succeeds", async () => {
    process.env.MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED = "true";
    process.env.OPENAI_API_KEY = "test-key";
    const result = await runMarketRentResearch(validInputs, {
      fetchCraigslist: fixtureFetch(),
      createOpenAiCompletion: mockOpenAiSuccess,
    });
    assert.equal(result.ok, true);
    if (!result.ok || result.status !== "success") return;
    assert.equal(result.result.explanationSource, "openai");
    assert.match(result.result.explanation, /Comparable listings cluster/);
    assert.equal(result.result.confidence, "medium");
  });

  it("returns deterministic fallback when OpenAI fails", async () => {
    process.env.MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED = "true";
    process.env.OPENAI_API_KEY = "test-key";
    const result = await runMarketRentResearch(validInputs, {
      fetchCraigslist: fixtureFetch(),
      createOpenAiCompletion: async () => {
        throw new Error("OpenAI request failed (503).");
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok || result.status !== "success") return;
    assert.equal(result.result.explanationSource, "deterministic");
    assert.ok(result.result.suggestedRent.recommended > 0);
    assert.ok(result.result.dataQualityNotes.some((note) => note.includes(MARKET_RENT_OPENAI_FALLBACK_NOTE)));
  });

  it("returns graceful error when provider fails", async () => {
    process.env.MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED = "true";
    const result = await runMarketRentResearch(validInputs, {
      fetchCraigslist: async () => {
        throw new ScraperFetchError("craigslist", "Craigslist search failed (503).");
      },
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /Craigslist search failed/);
  });

  it("returns no comps message when listings do not match criteria", async () => {
    process.env.MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED = "true";
    const result = await runMarketRentResearch(
      { ...validInputs, city: "Victoria", bedrooms: 5 },
      { fetchCraigslist: fixtureFetch() },
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, MARKET_RENT_RESEARCH_NO_COMPS_MESSAGE);
  });
});

describe("market rent research PR3 boundaries", () => {
  it("does not import Gemini or old rental ad assistant modules", async () => {
    const files = [
      "./run-market-rent-research.ts",
      "./openai-client.ts",
      "./build-openai-prompt.ts",
      "./parse-openai-output.ts",
      "./synthesize-with-openai.ts",
      "./action-handlers.ts",
    ];

    for (const relativePath of files) {
      const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
      assert.doesNotMatch(source, /from ["']@\/lib\/ai\//);
      assert.doesNotMatch(source, /from ["']@\/lib\/rental-ad-assistant\//);
      assert.doesNotMatch(source, /gemini/i);
    }
  });

  it("does not write to Prisma from orchestrator source", async () => {
    const source = await readFile(
      new URL("./run-market-rent-research.ts", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(source, /prisma\./i);
    assert.doesNotMatch(source, /PrismaClient/);
  });
});
