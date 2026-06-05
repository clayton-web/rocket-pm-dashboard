import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  cacheCraigslistAreaId,
  clearCraigslistAreaIdCache,
  extractAreaIdFromHtml,
  getCachedCraigslistAreaId,
  resolveCraigslistAreaId,
} from "./craigslist-area-id";

describe("craigslist area id resolver", () => {
  afterEach(() => {
    clearCraigslistAreaIdCache();
  });

  it("extracts areaId from Craigslist search page HTML", () => {
    const html = `window.cl.init('', '', 'search', { 'location': {"v":1,"areaId":16,"type":"area"} });`;
    assert.equal(extractAreaIdFromHtml(html), 16);
  });

  it("returns null when areaId is missing", () => {
    assert.equal(extractAreaIdFromHtml("<html></html>"), null);
  });

  it("caches resolved area IDs with TTL", async () => {
    cacheCraigslistAreaId("vancouver", 16, 60_000);
    assert.equal(getCachedCraigslistAreaId("vancouver"), 16);
  });

  it("resolves area_id from injectable HTML fetch", async () => {
    const areaId = await resolveCraigslistAreaId("vancouver", {
      fetchFn: async () =>
        new Response('"areaId":471', { status: 200, headers: { "Content-Type": "text/html" } }),
    });
    assert.equal(areaId, 471);
    assert.equal(getCachedCraigslistAreaId("vancouver"), 471);
  });

  it("throws when area page fetch fails", async () => {
    await assert.rejects(
      () =>
        resolveCraigslistAreaId("vancouver", {
          fetchFn: async () => new Response("not found", { status: 404 }),
        }),
      /Failed to resolve Craigslist area_id/,
    );
  });
});
