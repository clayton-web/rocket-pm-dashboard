import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { marketRentResearchIdleState } from "./idle-action-state";

describe("marketRentResearchIdleState", () => {
  it("provides a client-safe idle state for useActionState", () => {
    assert.equal(marketRentResearchIdleState.ok, true);
    assert.equal(marketRentResearchIdleState.status, "no_providers");
    assert.equal(marketRentResearchIdleState.message, "");
    assert.equal(marketRentResearchIdleState.completedAt, 0);
  });

  it("is not exported from the server actions module", async () => {
    const source = await readFile(
      new URL("../../app/(dashboard)/properties/market-rent-research-actions.ts", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(source, /marketRentResearchIdleState/);
  });

  it("panel imports idle state from lib, not server actions", async () => {
    const source = await readFile(
      new URL("../../components/properties/market-rent-research-panel.tsx", import.meta.url),
      "utf8",
    );
    assert.match(source, /idle-action-state/);
    assert.doesNotMatch(source, /marketRentResearchIdleState.*market-rent-research-actions/);
  });
});
