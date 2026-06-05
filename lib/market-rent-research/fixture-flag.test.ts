import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isMarketRentUseFixtureCompsEnabled } from "./fixture-flag";

describe("isMarketRentUseFixtureCompsEnabled", () => {
  const originalFlag = process.env.MARKET_RENT_USE_FIXTURE_COMPS;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.MARKET_RENT_USE_FIXTURE_COMPS;
    else process.env.MARKET_RENT_USE_FIXTURE_COMPS = originalFlag;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("defaults to false when unset", () => {
    delete process.env.MARKET_RENT_USE_FIXTURE_COMPS;
    process.env.NODE_ENV = "development";
    assert.equal(isMarketRentUseFixtureCompsEnabled(), false);
  });

  it("returns true in non-production when flag is enabled", () => {
    process.env.MARKET_RENT_USE_FIXTURE_COMPS = "true";
    process.env.NODE_ENV = "development";
    assert.equal(isMarketRentUseFixtureCompsEnabled(), true);
  });

  it("does not silently use fixture comps in production", () => {
    process.env.MARKET_RENT_USE_FIXTURE_COMPS = "true";
    process.env.NODE_ENV = "production";
    assert.equal(isMarketRentUseFixtureCompsEnabled(), false);
  });
});
