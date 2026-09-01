import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FormField,
  FormSection,
  InlineAlert,
  InlineNotice,
  noticeClasses,
  PortalPageHeader,
  PrimaryButton,
  SelectionCard,
  StickyFormFooter,
  SURFACE_CARD,
  SURFACE_DASHED,
  SURFACE_PANEL,
  toggleTileClasses,
} from "@/components/portal/ui";
import { statusBadgeClasses, type StatusTone } from "@/components/portal/status-badge";

/**
 * Contract guard for the shared portal primitives. These are consumed across the staff shell and
 * the tenant portal, so they must express semantic roles and must not drift back into being an
 * implicit palette of raw Tailwind colour utilities.
 */
const RAW_PALETTE_CLASS = /\b(?:bg|text|border|outline|ring|from|to|via)-(?:neutral|gray|slate|zinc|stone|red|emerald|green|amber|yellow|sky|blue|indigo)-\d{2,3}\b/;

function assertNoRawPalette(subject: string, label: string) {
  const match = subject.match(RAW_PALETTE_CLASS);
  assert.equal(match, null, `${label} should use semantic tokens, found ${match?.[0]}`);
}

describe("portal surface constants", () => {
  it("resolve to semantic surface and border tokens", () => {
    assert.equal(SURFACE_PANEL, "rounded-xl border border-border bg-surface");
    assert.equal(SURFACE_CARD, "rounded-xl border border-border bg-surface shadow-sm");
    assert.equal(SURFACE_DASHED, "rounded-xl border border-dashed border-border-strong bg-surface-muted/80");
  });

  it("carry no raw palette classes", () => {
    for (const [label, value] of Object.entries({ SURFACE_PANEL, SURFACE_CARD, SURFACE_DASHED })) {
      assertNoRawPalette(value, label);
    }
  });
});

describe("toggleTileClasses", () => {
  it("uses the dark primary token when active and a surface when not", () => {
    assert.match(toggleTileClasses(true), /bg-primary\b/);
    assert.match(toggleTileClasses(true), /text-primary-foreground\b/);
    assert.match(toggleTileClasses(false), /bg-surface\b/);
  });

  it("is keyboard focusable with a visible outline in both states", () => {
    for (const classes of [toggleTileClasses(true), toggleTileClasses(false)]) {
      assert.match(classes, /focus-visible:outline-2/);
      assert.match(classes, /focus-visible:outline-focus/);
    }
  });

  it("carries no raw palette classes", () => {
    assertNoRawPalette(toggleTileClasses(true), "toggleTileClasses(true)");
    assertNoRawPalette(toggleTileClasses(false), "toggleTileClasses(false)");
  });
});

describe("PrimaryButton", () => {
  const html = renderToStaticMarkup(PrimaryButton({ children: "Save" }));

  it("stays a dark filled action rather than Rocket red (docs/branding.md D-011 exception)", () => {
    assert.match(html, /bg-primary\b/);
    assert.match(html, /hover:bg-primary-hover/);
    assert.match(html, /text-primary-foreground/);
    assert.doesNotMatch(html, /bg-brand/);
  });

  it("has a visible focus treatment", () => {
    assert.match(html, /focus-visible:outline-2/);
    assert.match(html, /focus-visible:outline-focus/);
  });
});

describe("SelectionCard", () => {
  it("keeps the selected state announced and visually distinct", () => {
    const selected = renderToStaticMarkup(
      SelectionCard({ selected: true, onSelect: () => {}, children: "Option" }),
    );
    const unselected = renderToStaticMarkup(
      SelectionCard({ selected: false, onSelect: () => {}, children: "Option" }),
    );

    assert.match(selected, /aria-pressed="true"/);
    assert.match(selected, /bg-primary\b/);
    assert.match(unselected, /aria-pressed="false"/);
    assert.match(unselected, /bg-surface\b/);
  });
});

describe("FormField validation", () => {
  it("announces the error and signals it with more than colour", () => {
    const html = renderToStaticMarkup(
      FormField({ htmlFor: "rent", label: "Monthly rent", error: "Enter an amount", children: null }),
    );

    assert.match(html, /role="alert"/);
    assert.match(html, /id="rent-error"/);
    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /font-medium/);
    assert.match(html, /Enter an amount/);
  });

  it("renders no error region when the field is valid", () => {
    const html = renderToStaticMarkup(
      FormField({ htmlFor: "rent", label: "Monthly rent", children: null }),
    );

    assert.doesNotMatch(html, /role="alert"/);
  });
});

describe("status primitives", () => {
  it("renders alerts on the danger role", () => {
    const html = renderToStaticMarkup(InlineAlert({ children: "Something failed" }));

    assert.match(html, /role="alert"/);
    assert.match(html, /border-danger-border/);
    assert.match(html, /bg-danger-surface/);
    assert.match(html, /text-danger-foreground/);
  });

  it("renders neutral notices on surface and border roles", () => {
    const html = renderToStaticMarkup(InlineNotice({ children: "Heads up" }));

    assert.match(html, /border-border\b/);
    assert.match(html, /bg-surface-muted\b/);
    assert.match(html, /text-foreground-muted\b/);
  });

  it("gives each notice tone its own semantic treatment", () => {
    const tones: StatusTone[] = ["neutral", "success", "warning", "danger", "info"];
    const rendered = tones.map((tone) => noticeClasses(tone));

    assert.equal(new Set(rendered).size, tones.length);
    for (const [index, tone] of tones.entries()) {
      assertNoRawPalette(rendered[index]!, `notice/${tone}`);
    }
  });

  it("shares one tone vocabulary with the status badges", () => {
    assert.match(noticeClasses("warning"), /bg-warning-surface\b/);
    assert.match(statusBadgeClasses("warning"), /bg-warning-surface\b/);
  });

  it("varies only shape between notice sizes, never tone", () => {
    assert.match(noticeClasses("info", "default"), /rounded-lg px-3\.5 py-3 text-sm/);
    assert.match(noticeClasses("info", "compact"), /rounded-md px-3 py-2 text-xs/);
    assert.match(noticeClasses("info", "compact"), /bg-info-surface\b/);
  });

  it("keeps the alert role on danger notices at any size", () => {
    const html = renderToStaticMarkup(InlineAlert({ children: "Failed", size: "compact" }));

    assert.match(html, /role="alert"/);
    assert.match(html, /bg-danger-surface\b/);
    assert.match(html, /text-xs/);
  });
});

describe("every portal primitive", () => {
  const rendered: Array<[string, string]> = [
    [
      "PortalPageHeader",
      renderToStaticMarkup(
        PortalPageHeader({ eyebrow: "Section", title: "Title", description: "Description" }),
      ),
    ],
    ["FormSection", renderToStaticMarkup(FormSection({ legend: "Legend", helper: "Helper", children: null }))],
    ["FormField", renderToStaticMarkup(FormField({ label: "Label", helper: "Helper", children: null }))],
    ["SelectionCard", renderToStaticMarkup(SelectionCard({ selected: false, onSelect: () => {}, children: "Option" }))],
    ["PrimaryButton", renderToStaticMarkup(PrimaryButton({ children: "Save" }))],
    ["InlineAlert", renderToStaticMarkup(InlineAlert({ children: "Failed" }))],
    ["InlineNotice", renderToStaticMarkup(InlineNotice({ children: "Notice" }))],
    ["StickyFormFooter", renderToStaticMarkup(StickyFormFooter({ children: null }))],
  ];

  it("uses semantic tokens rather than raw palette classes", () => {
    for (const [label, html] of rendered) {
      assertNoRawPalette(html, label);
    }
  });
});
