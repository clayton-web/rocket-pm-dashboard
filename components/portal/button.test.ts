import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Button, buttonClasses, type ButtonVariant } from "@/components/portal/button";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "danger"];

const RAW_PALETTE_CLASS =
  /\b(?:bg|text|border|outline|ring)-(?:neutral|gray|slate|zinc|stone|red|emerald|green|amber|yellow|sky|blue|indigo)-\d{2,3}\b/;

describe("button variants", () => {
  it("keeps the primary action dark ink, not Rocket red (docs/branding.md D-011)", () => {
    const primary = buttonClasses({ variant: "primary" });

    assert.match(primary, /bg-primary\b/);
    assert.match(primary, /text-primary-foreground\b/);
    assert.match(primary, /hover:bg-primary-hover\b/);
    assert.doesNotMatch(primary, /bg-brand\b/);
    assert.doesNotMatch(primary, /bg-danger\b/);
  });

  it("makes danger visually distinct from primary so it cannot be mistaken for the safe action", () => {
    const primary = buttonClasses({ variant: "primary" });
    const danger = buttonClasses({ variant: "danger" });

    assert.match(danger, /bg-danger\b/);
    assert.match(danger, /hover:bg-danger-hover\b/);
    assert.notEqual(primary, danger);
  });

  it("gives secondary a light surface and ghost no surface of its own", () => {
    assert.match(buttonClasses({ variant: "secondary" }), /bg-surface\b/);
    assert.match(buttonClasses({ variant: "secondary" }), /border-border-strong\b/);
    assert.match(buttonClasses({ variant: "ghost" }), /bg-transparent\b/);
    assert.match(buttonClasses({ variant: "ghost" }), /border-transparent\b/);
  });

  it("gives every variant a visible focus ring and a disabled treatment", () => {
    for (const variant of VARIANTS) {
      const classes = buttonClasses({ variant });
      assert.match(classes, /focus-visible:outline-2/, variant);
      assert.match(classes, /focus-visible:outline-offset-2/, variant);
      assert.match(classes, /focus-visible:outline-focus/, variant);
      assert.match(classes, /disabled:cursor-not-allowed/, variant);
      assert.match(classes, /disabled:opacity-60/, variant);
    }
  });

  it("keeps box sizing consistent across variants so mixed action rows line up", () => {
    for (const variant of VARIANTS) {
      assert.match(buttonClasses({ variant }), /\bborder\b/, variant);
    }
  });

  it("uses semantic tokens rather than raw palette classes", () => {
    for (const variant of VARIANTS) {
      const match = buttonClasses({ variant }).match(RAW_PALETTE_CLASS);
      assert.equal(match, null, `${variant} leaked ${match?.[0]}`);
    }
  });
});

describe("button sizes", () => {
  it("exposes only the three densities the portal actually uses", () => {
    assert.match(buttonClasses({ size: "xs" }), /px-3 py-1\.5 text-xs/);
    assert.match(buttonClasses({ size: "sm" }), /px-4 py-2 text-sm/);
    assert.match(buttonClasses({ size: "lg" }), /px-4 py-3\.5 text-sm/);
  });

  it("uses the roomier radius only for the large tenant-form density", () => {
    assert.match(buttonClasses({ size: "lg" }), /rounded-xl/);
    assert.match(buttonClasses({ size: "sm" }), /rounded-md/);
  });

  it("stretches only when asked", () => {
    assert.match(buttonClasses({ block: true }), /\bw-full\b/);
    assert.doesNotMatch(buttonClasses(), /\bw-full\b/);
  });
});

describe("Button element", () => {
  it("defaults to type=button so it cannot accidentally submit a form", () => {
    assert.match(renderToStaticMarkup(Button({ children: "Go" })), /type="button"/);
  });

  it("passes through element props and appends caller classes", () => {
    const html = renderToStaticMarkup(
      Button({ children: "Save", type: "submit", disabled: true, className: "mt-4" }),
    );

    assert.match(html, /type="submit"/);
    assert.match(html, /disabled=""/);
    assert.match(html, /mt-4/);
  });
});
