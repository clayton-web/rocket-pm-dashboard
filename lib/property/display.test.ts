import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENTIRE_PROPERTY_UNIT_NUMBER } from "@/lib/property/entire-property-unit";
import {
  formatPropertyAddress,
  formatPropertyUnitLine,
  formatPropertyUnitReference,
  formatUnitLabel,
  formatUnitLabelOrDash,
} from "@/lib/property/display";

describe("property display helpers", () => {
  it("formatPropertyAddress prefers street line 1 and optional line 2", () => {
    assert.equal(
      formatPropertyAddress({
        name: "Legacy Name",
        streetLine1: "990 Blue Mountain St",
        streetLine2: null,
      }),
      "990 Blue Mountain St",
    );
    assert.equal(
      formatPropertyAddress({
        name: "Legacy Name",
        streetLine1: "990 Blue Mountain St",
        streetLine2: "Suite 200",
      }),
      "990 Blue Mountain St, Suite 200",
    );
  });

  it("formatPropertyAddress falls back to property name", () => {
    assert.equal(
      formatPropertyAddress({ name: "Harbourview Apartments", streetLine1: "" }),
      "Harbourview Apartments",
    );
  });

  it("formatUnitLabel returns raw labels without a Unit prefix", () => {
    assert.equal(formatUnitLabel("Basement"), "Basement");
    assert.equal(formatUnitLabel(" 101 "), "101");
    assert.equal(formatUnitLabel(ENTIRE_PROPERTY_UNIT_NUMBER), ENTIRE_PROPERTY_UNIT_NUMBER);
    assert.equal(formatUnitLabel(null), null);
  });

  it("formatUnitLabelOrDash uses an em dash for missing values", () => {
    assert.equal(formatUnitLabelOrDash(undefined), "—");
    assert.equal(formatUnitLabelOrDash("Upper"), "Upper");
  });

  it("formatPropertyUnitLine uses an en dash between address and unit", () => {
    assert.equal(
      formatPropertyUnitLine(
        { name: "ignored", streetLine1: "990 Blue Mountain St" },
        "Basement",
      ),
      "990 Blue Mountain St – Basement",
    );
  });

  it("formatPropertyUnitLine omits Entire Property suffix for whole-property rentals", () => {
    assert.equal(
      formatPropertyUnitLine(
        { name: "ignored", streetLine1: "990 Blue Mountain St" },
        ENTIRE_PROPERTY_UNIT_NUMBER,
      ),
      "990 Blue Mountain St",
    );
  });

  it("formatPropertyUnitReference works with string-only inputs", () => {
    assert.equal(formatPropertyUnitReference("Oak Apartments", "2B"), "Oak Apartments – 2B");
    assert.equal(formatPropertyUnitReference("Oak Apartments", ENTIRE_PROPERTY_UNIT_NUMBER), "Oak Apartments");
  });
});
