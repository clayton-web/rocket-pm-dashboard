import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildThreadReclassifySuccessMessage } from "./thread-reclassify-feedback";

describe("buildThreadReclassifySuccessMessage", () => {
  it("includes sender email when memory was updated", () => {
    assert.equal(
      buildThreadReclassifySuccessMessage({
        category: "STRATA",
        senderEmail: "strata@building.com",
      }),
      "Moved to Strata. Future emails from strata@building.com will be sorted here.",
    );
  });

  it("omits sender line when no sender memory was stored", () => {
    assert.equal(
      buildThreadReclassifySuccessMessage({
        category: "LANDLORD_COMMUNICATION",
        senderEmail: null,
      }),
      "Moved to Landlord Communication.",
    );
  });
});
