import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SummaryPill } from "@/components/portal/summary-pill";

describe("SummaryPill", () => {
  it("renders the count and label", () => {
    const html = renderToStaticMarkup(SummaryPill({ href: "/inbox", label: "Unlinked", count: 12 }));

    assert.match(html, /12/);
    assert.match(html, /Unlinked/);
  });

  it("renders nothing when the count is zero", () => {
    assert.equal(renderToStaticMarkup(SummaryPill({ href: "/inbox", label: "Unlinked", count: 0 })), "");
  });

  it("keeps in-page anchors as plain hash links", () => {
    const html = renderToStaticMarkup(
      SummaryPill({ href: "#ops-section-waiting", label: "Waiting", count: 3 }),
    );

    assert.match(html, /href="#ops-section-waiting"/);
  });

  it("routes non-anchor destinations", () => {
    const html = renderToStaticMarkup(
      SummaryPill({ href: "/inbox?queue=needs_reply", label: "Needs reply", count: 5 }),
    );

    assert.match(html, /href="\/inbox\?queue=needs_reply"/);
  });

  it("aligns counts and gives the control a visible focus ring", () => {
    const html = renderToStaticMarkup(SummaryPill({ href: "/inbox", label: "Unlinked", count: 12 }));

    assert.match(html, /tabular-nums/);
    assert.match(html, /focus-visible:outline-focus/);
  });

  it("uses semantic tokens rather than raw palette classes", () => {
    const html = renderToStaticMarkup(SummaryPill({ href: "/inbox", label: "Unlinked", count: 12 }));

    assert.doesNotMatch(html, /\b(?:bg|text|border)-(?:neutral|red|emerald|amber|sky)-\d{2,3}\b/);
  });
});
