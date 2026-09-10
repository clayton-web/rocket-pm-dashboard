import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusBadge, statusBadgeClasses, type StatusTone } from "@/components/portal/status-badge";

const TONES: StatusTone[] = ["neutral", "success", "warning", "danger", "info"];

const RAW_PALETTE_CLASS =
  /\b(?:bg|text|border)-(?:neutral|gray|slate|zinc|stone|red|emerald|green|amber|yellow|sky|blue|indigo)-\d{2,3}\b/;

describe("status tones", () => {
  it("maps each tone to its own semantic treatment", () => {
    assert.match(statusBadgeClasses("success"), /bg-success-surface\b/);
    assert.match(statusBadgeClasses("warning"), /bg-warning-surface\b/);
    assert.match(statusBadgeClasses("danger"), /bg-danger-surface\b/);
    assert.match(statusBadgeClasses("info"), /bg-info-surface\b/);
    assert.match(statusBadgeClasses("neutral"), /bg-surface-muted\b/);
  });

  it("produces a distinct treatment per tone", () => {
    const rendered = TONES.map((tone) => statusBadgeClasses(tone));
    assert.equal(new Set(rendered).size, TONES.length);
  });

  it("makes the strong emphasis heavier than the soft one without changing tone", () => {
    for (const tone of TONES) {
      const soft = statusBadgeClasses(tone, "soft");
      const strong = statusBadgeClasses(tone, "strong");
      assert.notEqual(soft, strong, tone);
      assert.match(strong, /border-\S*strong\b/, tone);
    }
  });

  it("keeps a single shared shape across tones", () => {
    for (const tone of TONES) {
      assert.match(statusBadgeClasses(tone), /rounded-md border px-2 py-0\.5 text-xs font-medium/, tone);
    }
  });

  it("uses semantic tokens rather than raw palette classes", () => {
    for (const tone of TONES) {
      for (const emphasis of ["soft", "strong"] as const) {
        const match = statusBadgeClasses(tone, emphasis).match(RAW_PALETTE_CLASS);
        assert.equal(match, null, `${tone}/${emphasis} leaked ${match?.[0]}`);
      }
    }
  });
});

describe("StatusBadge", () => {
  it("always renders the label as text so meaning never rests on colour", () => {
    for (const tone of TONES) {
      const html = renderToStaticMarkup(StatusBadge({ tone, children: "Overdue" }));
      assert.match(html, /Overdue/, tone);
    }
  });

  it("treats a reinforcing glyph as decorative", () => {
    const html = renderToStaticMarkup(
      StatusBadge({ tone: "warning", emphasis: "strong", icon: "!", children: "Overdue" }),
    );

    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /Overdue/);
  });

  it("omits the icon slot entirely when no glyph is given", () => {
    const html = renderToStaticMarkup(StatusBadge({ tone: "neutral", children: "Draft" }));
    assert.doesNotMatch(html, /aria-hidden/);
  });
});
