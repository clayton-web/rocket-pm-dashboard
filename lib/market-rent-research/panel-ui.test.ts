import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import {
  MARKET_RENT_FIXTURE_SAMPLE_NOTE,
  MARKET_RENT_RESEARCH_NO_COMPS_MESSAGE,
  MARKET_RENT_RESEARCH_PROVIDER_UNAVAILABLE_MESSAGE,
} from "./constants";
import { providerStatusUiMessage } from "./provider-status-ui";
import { buildCraigslistProviderStatus } from "./provider-status";

describe("market rent research panel UI copy", () => {
  it("shows provider error and no-results messages in constants", () => {
    assert.match(MARKET_RENT_RESEARCH_PROVIDER_UNAVAILABLE_MESSAGE, /No external comparable listings/i);
    assert.match(MARKET_RENT_RESEARCH_NO_COMPS_MESSAGE, /No comparable listings found/i);
  });

  it("shows fixture sample note text", () => {
    assert.match(MARKET_RENT_FIXTURE_SAMPLE_NOTE, /Sample fixture data/i);
  });

  it("renders provider status labels used by the results UI", () => {
    assert.equal(
      providerStatusUiMessage(
        buildCraigslistProviderStatus({ status: "http_error", listingCount: 0 }),
      ),
      "Craigslist unavailable",
    );
    assert.equal(
      providerStatusUiMessage(
        buildCraigslistProviderStatus({ status: "no_results", listingCount: 0 }),
      ),
      "Craigslist returned no results",
    );
  });

  it("includes refreshed results layout in panel and results components", async () => {
    const panelSource = await readFile(
      new URL("../../components/properties/market-rent-research-panel.tsx", import.meta.url),
      "utf8",
    );
    const resultsSource = await readFile(
      new URL("../../components/properties/market-rent-research-results.tsx", import.meta.url),
      "utf8",
    );
    assert.match(panelSource, /MarketRentResearchResults/);
    assert.match(panelSource, /Nearby areas/);
    assert.match(panelSource, /getMarketRentSubAreasGroupedByCity/);
    assert.match(resultsSource, /Recommended Market Rent/);
    assert.match(resultsSource, /Why this rent\?/);
    assert.match(resultsSource, /Research Details/);
    assert.match(resultsSource, /Comparable listings/);
    assert.match(resultsSource, /MARKET_RENT_FIXTURE_SAMPLE_NOTE/);
    assert.match(resultsSource, /provider-status-ui/);
  });
});
