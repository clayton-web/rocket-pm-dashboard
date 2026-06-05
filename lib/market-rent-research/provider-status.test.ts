import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ScraperFetchError, ScraperTimeoutError } from "@/lib/scrapers/errors";
import type { ProviderFetchStatus } from "@/lib/scrapers/types";
import {
  buildCraigslistProviderStatus,
  classifyCraigslistFetchError,
} from "./provider-status";
import { providerStatusUiMessage } from "./provider-status-ui";

describe("classifyCraigslistFetchError", () => {
  it("maps HTTP 500 to http_error", () => {
    const result = classifyCraigslistFetchError(
      new ScraperFetchError("craigslist", "Craigslist search failed (500).", 500),
    );
    assert.equal(result.status, "http_error");
  });

  it("maps timeout to timeout status", () => {
    const result = classifyCraigslistFetchError(new ScraperTimeoutError());
    assert.equal(result.status, "timeout");
  });
});

describe("providerStatusUiMessage", () => {
  it("shows Craigslist unavailable for http_error", () => {
    const status: ProviderFetchStatus = buildCraigslistProviderStatus({
      status: "http_error",
      listingCount: 0,
      errorMessage: "Craigslist search failed (500).",
    });
    assert.equal(providerStatusUiMessage(status), "Craigslist unavailable");
  });

  it("shows timeout message", () => {
    const status: ProviderFetchStatus = buildCraigslistProviderStatus({
      status: "timeout",
      listingCount: 0,
    });
    assert.equal(providerStatusUiMessage(status), "Craigslist timed out");
  });

  it("shows no results message", () => {
    const status: ProviderFetchStatus = buildCraigslistProviderStatus({
      status: "no_results",
      listingCount: 0,
    });
    assert.equal(providerStatusUiMessage(status), "Craigslist returned no results");
  });
});
