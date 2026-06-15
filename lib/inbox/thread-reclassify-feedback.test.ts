import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildThreadReclassifySuccessMessage } from "./thread-reclassify-feedback";

describe("buildThreadReclassifySuccessMessage", () => {
  it("returns a simple moved confirmation without future auto-sort messaging", () => {
    assert.equal(
      buildThreadReclassifySuccessMessage({
        category: "STRATA",
      }),
      "Moved to Strata.",
    );
  });
});
