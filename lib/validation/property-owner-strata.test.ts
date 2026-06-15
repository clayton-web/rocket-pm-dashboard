import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePropertyOwnerStrataFormInput } from "./property-owner-strata";

describe("parsePropertyOwnerStrataFormInput", () => {
  it("accepts optional owner and strata fields", () => {
    const result = parsePropertyOwnerStrataFormInput({
      ownerEmail: "owner@example.com",
      ownerPhone: "604-555-0100",
      strataNotes: "Council contact: strata@building.com",
    });
    assert.ok(!("error" in result));
    assert.equal(result.ownerEmail, "owner@example.com");
    assert.equal(result.ownerPhone, "604-555-0100");
    assert.equal(result.strataNotes, "Council contact: strata@building.com");
  });

  it("rejects invalid owner email", () => {
    const result = parsePropertyOwnerStrataFormInput({
      ownerEmail: "not-an-email",
      ownerPhone: "",
      strataNotes: "",
    });
    assert.ok("error" in result);
  });
});
