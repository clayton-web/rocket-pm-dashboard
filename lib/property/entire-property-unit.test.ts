import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ENTIRE_PROPERTY_UNIT_NUMBER,
  entirePropertyUnitCreateInput,
} from "./entire-property-unit";

describe("entire property unit", () => {
  it("uses the Entire Property label constant", () => {
    assert.equal(ENTIRE_PROPERTY_UNIT_NUMBER, "Entire Property");
  });

  it("builds default unit create input", () => {
    assert.deepEqual(entirePropertyUnitCreateInput(), { unitNumber: "Entire Property" });
  });
});
