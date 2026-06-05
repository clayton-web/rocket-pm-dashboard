import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { marketRentResearchDisabledActionState } from "./disabled-action";
import { isMarketRentResearchEnabled } from "./feature-flag";

describe("isMarketRentResearchEnabled", () => {
  const original = process.env.MARKET_RENT_RESEARCH_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.MARKET_RENT_RESEARCH_ENABLED;
    else process.env.MARKET_RENT_RESEARCH_ENABLED = original;
  });

  it("defaults to false when unset", () => {
    delete process.env.MARKET_RENT_RESEARCH_ENABLED;
    assert.equal(isMarketRentResearchEnabled(), false);
  });

  it("returns true only for explicit truthy values", () => {
    process.env.MARKET_RENT_RESEARCH_ENABLED = "true";
    assert.equal(isMarketRentResearchEnabled(), true);

    process.env.MARKET_RENT_RESEARCH_ENABLED = "1";
    assert.equal(isMarketRentResearchEnabled(), true);

    process.env.MARKET_RENT_RESEARCH_ENABLED = "yes";
    assert.equal(isMarketRentResearchEnabled(), true);
  });

  it("returns false for false and other values", () => {
    process.env.MARKET_RENT_RESEARCH_ENABLED = "false";
    assert.equal(isMarketRentResearchEnabled(), false);

    process.env.MARKET_RENT_RESEARCH_ENABLED = "0";
    assert.equal(isMarketRentResearchEnabled(), false);
  });

  it("pairs with disabled action state when flag is off", () => {
    delete process.env.MARKET_RENT_RESEARCH_ENABLED;
    assert.equal(isMarketRentResearchEnabled(), false);
    const state = marketRentResearchDisabledActionState();
    assert.equal(state.ok, false);
  });
});
