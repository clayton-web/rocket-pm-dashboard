import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formControlClasses } from "@/components/portal/form-control";

const RAW_PALETTE_CLASS =
  /\b(?:bg|text|border|outline)-(?:neutral|gray|slate|zinc|stone|red|emerald|green|amber|yellow|sky|blue|indigo)-\d{2,3}\b/;

describe("formControlClasses", () => {
  it("gives every control a visible keyboard focus ring", () => {
    for (const size of ["sm", "lg"] as const) {
      const classes = formControlClasses({ size });
      assert.match(classes, /focus-visible:outline-2/, size);
      assert.match(classes, /focus-visible:outline-offset-2/, size);
      assert.match(classes, /focus-visible:outline-focus/, size);
    }
  });

  it("never suppresses the focus outline", () => {
    assert.doesNotMatch(formControlClasses(), /outline-none/);
  });

  it("marks disabled controls as such", () => {
    assert.match(formControlClasses(), /disabled:cursor-not-allowed/);
    assert.match(formControlClasses(), /disabled:opacity-60/);
  });

  it("carries the two densities the portal uses", () => {
    assert.match(formControlClasses({ size: "sm" }), /rounded-md px-3 py-2 text-sm/);
    assert.match(formControlClasses({ size: "lg" }), /rounded-xl bg-surface px-3\.5 py-3 text-sm/);
  });

  it("changes the border for an invalid control without making colour the only signal", () => {
    const invalid = formControlClasses({ invalid: true });
    const valid = formControlClasses();

    assert.match(invalid, /border-danger-border-strong/);
    assert.match(valid, /border-border-strong/);
    assert.doesNotMatch(valid, /border-danger/);
  });

  it("appends caller classes", () => {
    assert.match(formControlClasses({ className: "shadow-sm" }), /shadow-sm/);
  });

  it("uses semantic tokens rather than raw palette classes", () => {
    for (const invalid of [false, true]) {
      for (const size of ["sm", "lg"] as const) {
        const match = formControlClasses({ size, invalid }).match(RAW_PALETTE_CLASS);
        assert.equal(match, null, `${size}/${invalid} leaked ${match?.[0]}`);
      }
    }
  });
});
