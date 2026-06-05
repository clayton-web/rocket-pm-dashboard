import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isMarketRentScrapeCraigslistEnabled } from "./feature-flag";

describe("isMarketRentScrapeCraigslistEnabled", () => {
  const original = process.env.MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED;
    else process.env.MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED = original;
  });

  it("defaults to false when unset", () => {
    delete process.env.MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED;
    assert.equal(isMarketRentScrapeCraigslistEnabled(), false);
  });

  it("returns true only for explicit truthy values", () => {
    process.env.MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED = "true";
    assert.equal(isMarketRentScrapeCraigslistEnabled(), true);

    process.env.MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED = "1";
    assert.equal(isMarketRentScrapeCraigslistEnabled(), true);

    process.env.MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED = "yes";
    assert.equal(isMarketRentScrapeCraigslistEnabled(), true);
  });

  it("returns false for false and other values", () => {
    process.env.MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED = "false";
    assert.equal(isMarketRentScrapeCraigslistEnabled(), false);

    process.env.MARKET_RENT_SCRAPE_CRAIGSLIST_ENABLED = "0";
    assert.equal(isMarketRentScrapeCraigslistEnabled(), false);
  });
});
