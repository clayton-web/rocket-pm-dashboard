import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isMarketRentUseFixtureCompsEnabled } from "./fixture-flag";

describe("isMarketRentUseFixtureCompsEnabled", () => {
  const originalFlag = process.env.MARKET_RENT_USE_FIXTURE_COMPS;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercelEnv = process.env.VERCEL_ENV;

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.MARKET_RENT_USE_FIXTURE_COMPS;
    else process.env.MARKET_RENT_USE_FIXTURE_COMPS = originalFlag;
    process.env.NODE_ENV = originalNodeEnv;
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
  });

  it("defaults to false when unset", () => {
    delete process.env.MARKET_RENT_USE_FIXTURE_COMPS;
    process.env.NODE_ENV = "development";
    delete process.env.VERCEL_ENV;
    assert.equal(isMarketRentUseFixtureCompsEnabled(), false);
  });

  it("returns true in local dev when flag is enabled", () => {
    process.env.MARKET_RENT_USE_FIXTURE_COMPS = "true";
    process.env.NODE_ENV = "development";
    delete process.env.VERCEL_ENV;
    assert.equal(isMarketRentUseFixtureCompsEnabled(), true);
  });

  it("returns true on Vercel Preview even though NODE_ENV is production", () => {
    process.env.MARKET_RENT_USE_FIXTURE_COMPS = "true";
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "preview";
    assert.equal(isMarketRentUseFixtureCompsEnabled(), true);
  });

  it("does not use fixture comps on the Vercel Production deployment", () => {
    process.env.MARKET_RENT_USE_FIXTURE_COMPS = "true";
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    assert.equal(isMarketRentUseFixtureCompsEnabled(), false);
  });
});
