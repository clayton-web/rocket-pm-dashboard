import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardSidebarView, navLinkClasses } from "@/components/dashboard/dashboard-sidebar";
import type { NavItem } from "@/config/navigation";

const ITEMS: NavItem[] = [
  {
    id: "nav-inbox",
    moduleId: "inbox",
    label: "Inbox",
    href: "/inbox",
    enabled: true,
    section: "command",
  },
  {
    id: "nav-operations",
    moduleId: "operations",
    label: "Operations",
    href: "/operations",
    enabled: true,
    section: "command",
  },
  {
    id: "nav-properties",
    moduleId: "properties",
    label: "Properties",
    href: "/properties",
    enabled: true,
    section: "operations",
  },
  {
    id: "nav-properties-health",
    moduleId: "properties",
    label: "Property health",
    href: "/properties/health",
    enabled: true,
    section: "operations",
  },
];

function render(pathname: string): string {
  return renderToStaticMarkup(DashboardSidebarView({ items: ITEMS, pathname }));
}

/** The `<a>` element whose text is `label`, so class assertions target one link at a time. */
function linkMarkup(html: string, label: string): string {
  const end = html.indexOf(`${label}</a>`);
  assert.notEqual(end, -1, `expected a link labelled ${label}`);
  const start = html.lastIndexOf("<a ", end);
  assert.notEqual(start, -1, `expected an anchor opening tag for ${label}`);
  return html.slice(start, end);
}

describe("DashboardSidebarView selected state", () => {
  it("marks only the active route with aria-current", () => {
    const html = render("/operations");

    assert.match(linkMarkup(html, "Operations"), /aria-current="page"/);
    assert.doesNotMatch(linkMarkup(html, "Inbox"), /aria-current="page"/);
    assert.equal(html.match(/aria-current="page"/g)?.length, 1);
  });

  it("selects the section for a detail route", () => {
    const html = render("/inbox/thread_1");

    assert.match(linkMarkup(html, "Inbox"), /aria-current="page"/);
  });

  it("selects the most specific route rather than its parent", () => {
    const html = render("/properties/health");

    assert.match(linkMarkup(html, "Property health"), /aria-current="page"/);
    assert.doesNotMatch(linkMarkup(html, "Properties"), /aria-current="page"/);
  });

  it("selects nothing when the route is outside the navigation registry", () => {
    const html = render("/not-a-route");

    assert.doesNotMatch(html, /aria-current="page"/);
  });

  it("gives the active link a brand indicator as well as a colour change", () => {
    const html = render("/operations");

    assert.match(linkMarkup(html, "Operations"), /bg-brand/);
    assert.doesNotMatch(linkMarkup(html, "Inbox"), /bg-brand/);
  });

  it("exposes the navigation landmark", () => {
    assert.match(render("/inbox"), /<nav aria-label="Primary"/);
  });
});

describe("navLinkClasses", () => {
  it("distinguishes selected from inactive by more than colour", () => {
    const active = navLinkClasses(true);
    const inactive = navLinkClasses(false);

    assert.match(active, /bg-selected/);
    assert.match(active, /font-semibold/);
    assert.doesNotMatch(inactive, /bg-selected/);
    assert.match(inactive, /font-medium/);
  });

  it("keeps hover distinguishable from the selected surface", () => {
    assert.match(navLinkClasses(false), /hover:bg-surface-muted/);
    assert.doesNotMatch(navLinkClasses(false), /hover:bg-selected/);
  });

  it("gives keyboard focus a visible treatment in both states", () => {
    for (const classes of [navLinkClasses(true), navLinkClasses(false)]) {
      assert.match(classes, /focus-visible:outline-2/);
      assert.match(classes, /focus-visible:outline-offset-2/);
      assert.match(classes, /focus-visible:outline-focus/);
    }
  });

  it("uses semantic tokens rather than raw palette classes", () => {
    for (const classes of [navLinkClasses(true), navLinkClasses(false)]) {
      assert.doesNotMatch(classes, /\b(?:bg|text|border)-(?:neutral|red|emerald|amber|sky)-\d{2,3}\b/);
    }
  });
});
