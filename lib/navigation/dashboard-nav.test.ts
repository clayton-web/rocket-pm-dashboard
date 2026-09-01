import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveActiveNavHref, resolveDashboardPageTitle } from "@/lib/navigation/dashboard-nav";

const HREFS = ["/inbox", "/operations", "/properties", "/properties/health", "/leasing"];

describe("resolveActiveNavHref", () => {
  it("matches an exact route", () => {
    assert.equal(resolveActiveNavHref("/inbox", HREFS), "/inbox");
  });

  it("matches a detail route to its section", () => {
    assert.equal(resolveActiveNavHref("/inbox/thread_1", HREFS), "/inbox");
  });

  it("prefers the longest matching href", () => {
    assert.equal(resolveActiveNavHref("/properties/health", HREFS), "/properties/health");
    assert.equal(resolveActiveNavHref("/properties/prop_1", HREFS), "/properties");
  });

  it("does not match a sibling route that merely shares a prefix", () => {
    assert.equal(resolveActiveNavHref("/inboxes", HREFS), null);
  });

  it("returns null when nothing matches", () => {
    assert.equal(resolveActiveNavHref("/unknown", HREFS), null);
  });
});

describe("resolveDashboardPageTitle", () => {
  it("titles routes from the navigation registry", () => {
    assert.equal(resolveDashboardPageTitle("/inbox"), "Inbox");
    assert.equal(resolveDashboardPageTitle("/operations"), "Operations");
    assert.equal(resolveDashboardPageTitle("/organization"), "Organization");
  });

  it("titles detail routes from their section", () => {
    assert.equal(resolveDashboardPageTitle("/inbox/thread_1"), "Inbox");
    assert.equal(resolveDashboardPageTitle("/maintenance/req_1"), "Maintenance");
    assert.equal(resolveDashboardPageTitle("/leasing/applications/app_1"), "Applications");
  });

  it("prefers the more specific route", () => {
    assert.equal(resolveDashboardPageTitle("/properties"), "Properties");
    assert.equal(resolveDashboardPageTitle("/properties/health"), "Property health");
  });

  it("titles routes that have no sidebar entry of their own", () => {
    assert.equal(resolveDashboardPageTitle("/briefing/settings"), "Briefing settings");
    assert.equal(resolveDashboardPageTitle("/leasing/notices/notice_1"), "Notices");
    assert.equal(resolveDashboardPageTitle("/leasing/showings/showing_1"), "Showings");
  });

  it("prefers the shipping entry when two registry rows share an href", () => {
    assert.equal(resolveDashboardPageTitle("/settings/integrations/buildium"), "Buildium");
  });

  it("falls back to the product shorthand for unknown routes", () => {
    assert.equal(resolveDashboardPageTitle("/not-a-route"), "Rocket PM");
  });
});
