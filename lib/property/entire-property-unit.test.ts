import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import {
  ENTIRE_PROPERTY_UNIT_NUMBER,
  countAdditionalUnits,
  entirePropertyUnitCreateInput,
  getAdditionalUnits,
  hasOnlyEntirePropertyUnit,
  isEntirePropertyUnit,
} from "./entire-property-unit";

describe("entire property unit", () => {
  it("uses the Entire Property label constant", () => {
    assert.equal(ENTIRE_PROPERTY_UNIT_NUMBER, "Entire Property");
  });

  it("builds default unit create input", () => {
    assert.deepEqual(entirePropertyUnitCreateInput(), { unitNumber: "Entire Property" });
  });

  it("identifies the default whole-property unit label", () => {
    assert.equal(isEntirePropertyUnit("Entire Property"), true);
    assert.equal(isEntirePropertyUnit("Basement"), false);
  });

  it("filters additional units for display and counts", () => {
    const units = [
      { id: "1", unitNumber: "Entire Property" },
      { id: "2", unitNumber: "Basement" },
      { id: "3", unitNumber: "101" },
    ];
    assert.deepEqual(getAdditionalUnits(units), [
      { id: "2", unitNumber: "Basement" },
      { id: "3", unitNumber: "101" },
    ]);
    assert.equal(countAdditionalUnits(units), 2);
  });

  it("detects when only the default unit exists", () => {
    assert.equal(hasOnlyEntirePropertyUnit([{ unitNumber: "Entire Property" }]), true);
    assert.equal(
      hasOnlyEntirePropertyUnit([
        { unitNumber: "Entire Property" },
        { unitNumber: "Upper" },
      ]),
      false,
    );
    assert.equal(hasOnlyEntirePropertyUnit([]), false);
  });
});

describe("property detail optional units UX", () => {
  it("hides the default unit label and uses optional add-unit copy", async () => {
    const source = await readFile(
      new URL("../../components/properties/property-detail.tsx", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(source, /Unit Entire Property/);
    assert.doesNotMatch(source, /No units listed yet/);
    assert.match(source, /\+ Add Unit/);
    assert.match(source, /basement suite, upper floor, numbered unit/);
    assert.match(source, /getAdditionalUnits/);
  });
});

describe("property list optional units UX", () => {
  it("only shows additional unit counts on the list page", async () => {
    const listSource = await readFile(
      new URL("../../components/properties/property-list.tsx", import.meta.url),
      "utf8",
    );
    const pageSource = await readFile(
      new URL("../../app/(dashboard)/properties/page.tsx", import.meta.url),
      "utf8",
    );
    assert.match(listSource, /additionalUnitCount/);
    assert.match(pageSource, /ENTIRE_PROPERTY_UNIT_NUMBER/);
  });
});

