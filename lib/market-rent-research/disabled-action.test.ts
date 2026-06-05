import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { marketRentResearchDisabledActionState } from "./disabled-action";
import { MARKET_RENT_RESEARCH_DISABLED_MESSAGE } from "./constants";

describe("marketRentResearchDisabledActionState", () => {
  it("returns disabled response when feature flag is off", () => {
    const state = marketRentResearchDisabledActionState();
    assert.equal(state.ok, false);
    if (state.ok) return;
    assert.equal(state.error, MARKET_RENT_RESEARCH_DISABLED_MESSAGE);
    assert.ok(state.completedAt > 0);
  });
});
