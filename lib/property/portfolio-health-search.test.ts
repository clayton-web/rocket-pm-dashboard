import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PortfolioHealthUnitSlot } from "@/lib/property/portfolio-health";
import { parseCleanupFiltersParam } from "@/lib/property/portfolio-health-cleanup-filters";
import {
  composePortfolioHealthUrlParams,
  matchesPortfolioHealthSearch,
  normalizePostalSearchKey,
  normalizeSearchText,
  parseSearchQueryParam,
  searchPortfolioHealthRows,
  serializeSearchQueryParam,
  type PortfolioHealthSearchableRow,
} from "@/lib/property/portfolio-health-search";

function unitSlot(overrides: Partial<PortfolioHealthUnitSlot> = {}): PortfolioHealthUnitSlot {
  return {
    unitId: "unit-1",
    unitLabel: "Entire Property",
    tenancyId: "tenancy-1",
    tenantName: "Taylor Applicant",
    tenantEmail: "tenant@example.com",
    tenantPhone: "604-555-0200",
    monthlyRent: 2400,
    securityDeposit: 1200,
    leaseStartDate: "2026-01-01",
    moveInDate: "2026-01-01",
    isVacant: false,
    tenantDataFlags: [],
    ...overrides,
  };
}

function row(overrides: Partial<PortfolioHealthSearchableRow> = {}): PortfolioHealthSearchableRow {
  return {
    streetLine1: "831 W 24th Ave",
    streetLine2: null,
    city: "Vancouver",
    province: "BC",
    postalCode: "V6B 1A1",
    unitSlots: [unitSlot()],
    ...overrides,
  };
}

describe("search normalization", () => {
  it("lowercases and collapses punctuation and whitespace", () => {
    assert.equal(normalizeSearchText("  831 W.  24th   Ave. "), "831 w 24th ave");
  });

  it("reduces postal codes to alphanumerics", () => {
    assert.equal(normalizePostalSearchKey("V6B 1A1"), "v6b1a1");
    assert.equal(normalizePostalSearchKey("v6b-1a1"), "v6b1a1");
  });
});

describe("matchesPortfolioHealthSearch", () => {
  it("matches on street line 1", () => {
    assert.equal(matchesPortfolioHealthSearch(row(), "831 W 24th"), true);
    assert.equal(matchesPortfolioHealthSearch(row(), "24th ave"), true);
  });

  it("matches an abbreviated street type against the expanded form", () => {
    const target = row({ streetLine1: "123 Main Street" });
    assert.equal(matchesPortfolioHealthSearch(target, "123 main st"), true);
  });

  it("matches on street line 2", () => {
    const target = row({ streetLine2: "Basement Suite" });
    assert.equal(matchesPortfolioHealthSearch(target, "basement"), true);
  });

  it("matches on unit label", () => {
    const target = row({ unitSlots: [unitSlot({ unitLabel: "Upper" })] });
    assert.equal(matchesPortfolioHealthSearch(target, "upper"), true);
  });

  it("matches on city", () => {
    assert.equal(matchesPortfolioHealthSearch(row(), "vancouver"), true);
  });

  it("matches a postal code written with a space", () => {
    assert.equal(matchesPortfolioHealthSearch(row(), "V6B 1A1"), true);
  });

  it("matches a postal code written without a space", () => {
    assert.equal(matchesPortfolioHealthSearch(row(), "v6b1a1"), true);
  });

  it("matches a partial postal code", () => {
    assert.equal(matchesPortfolioHealthSearch(row(), "V6B"), true);
  });

  it("matches on tenant name", () => {
    assert.equal(matchesPortfolioHealthSearch(row(), "Taylor"), true);
    assert.equal(matchesPortfolioHealthSearch(row(), "applicant"), true);
  });

  it("is case insensitive", () => {
    assert.equal(matchesPortfolioHealthSearch(row(), "VANCOUVER"), true);
    assert.equal(matchesPortfolioHealthSearch(row(), "tAyLoR"), true);
    assert.equal(matchesPortfolioHealthSearch(row(), "831 w 24TH ave"), true);
  });

  it("returns true for a blank or punctuation-only query", () => {
    assert.equal(matchesPortfolioHealthSearch(row(), ""), true);
    assert.equal(matchesPortfolioHealthSearch(row(), "   "), true);
    assert.equal(matchesPortfolioHealthSearch(row(), "  --  "), true);
  });

  it("returns false for a non-match", () => {
    assert.equal(matchesPortfolioHealthSearch(row(), "Kelowna"), false);
    assert.equal(matchesPortfolioHealthSearch(row(), "zzzz"), false);
  });

  it("does not match a tenant name on a vacant unit that has none", () => {
    const target = row({
      unitSlots: [unitSlot({ isVacant: true, tenantName: null, tenancyId: null })],
    });
    assert.equal(matchesPortfolioHealthSearch(target, "Taylor"), false);
    assert.equal(matchesPortfolioHealthSearch(target, "831"), true);
  });
});

describe("searchPortfolioHealthRows", () => {
  const vancouver = row({ streetLine1: "831 W 24th Ave", city: "Vancouver" });
  const burnaby = row({
    streetLine1: "42 Willow Cres",
    city: "Burnaby",
    postalCode: "V5H 2K3",
    unitSlots: [unitSlot({ tenantName: "Jordan Lee" })],
  });

  it("returns every row for a blank query", () => {
    assert.equal(searchPortfolioHealthRows([vancouver, burnaby], "").length, 2);
    assert.equal(searchPortfolioHealthRows([vancouver, burnaby], "  ").length, 2);
  });

  it("narrows to matching rows", () => {
    assert.deepEqual(
      searchPortfolioHealthRows([vancouver, burnaby], "burnaby").map((r) => r.city),
      ["Burnaby"],
    );
    assert.deepEqual(
      searchPortfolioHealthRows([vancouver, burnaby], "jordan").map((r) => r.city),
      ["Burnaby"],
    );
  });

  it("returns nothing when no row matches", () => {
    assert.deepEqual(searchPortfolioHealthRows([vancouver, burnaby], "Nanaimo"), []);
  });

  it("does not mutate the input array", () => {
    const rows = [vancouver, burnaby];
    const result = searchPortfolioHealthRows(rows, "");
    assert.notEqual(result, rows);
    assert.equal(rows.length, 2);
  });
});

describe("search query param", () => {
  it("trims and tolerates a missing value", () => {
    assert.equal(parseSearchQueryParam(null), "");
    assert.equal(parseSearchQueryParam(undefined), "");
    assert.equal(parseSearchQueryParam("  831 main  "), "831 main");
  });

  it("caps an absurdly long query", () => {
    assert.equal(parseSearchQueryParam("x".repeat(500)).length, 200);
  });

  it("serializes to a trimmed string", () => {
    assert.equal(serializeSearchQueryParam("  831 main "), "831 main");
    assert.equal(serializeSearchQueryParam("   "), "");
  });
});

describe("composePortfolioHealthUrlParams", () => {
  it("carries search and filters together", () => {
    const params = composePortfolioHealthUrlParams({
      filters: ["documents", "tenant_email"],
      query: "831 main",
    });
    assert.equal(params.get("filters"), "documents,tenant_email");
    assert.equal(params.get("q"), "831 main");
  });

  it("preserves filters when the search changes", () => {
    const base = composePortfolioHealthUrlParams({ filters: ["documents"], query: "first" });
    const next = composePortfolioHealthUrlParams({
      filters: ["documents"],
      query: "second",
      base: base.toString(),
    });
    assert.equal(next.get("filters"), "documents");
    assert.equal(next.get("q"), "second");
  });

  it("preserves the search when filters change", () => {
    const base = composePortfolioHealthUrlParams({ filters: ["documents"], query: "831 main" });
    const next = composePortfolioHealthUrlParams({
      filters: ["documents", "owner_contact"],
      query: "831 main",
      base: base.toString(),
    });
    assert.equal(next.get("q"), "831 main");
    assert.deepEqual(parseCleanupFiltersParam(next.get("filters")), [
      "documents",
      "owner_contact",
    ]);
  });

  it("clearing the search preserves filters", () => {
    const base = composePortfolioHealthUrlParams({ filters: ["documents"], query: "831 main" });
    const next = composePortfolioHealthUrlParams({
      filters: ["documents"],
      query: "",
      base: base.toString(),
    });
    assert.equal(next.has("q"), false);
    assert.equal(next.get("filters"), "documents");
  });

  it("clearing filters preserves the search", () => {
    const base = composePortfolioHealthUrlParams({ filters: ["documents"], query: "831 main" });
    const next = composePortfolioHealthUrlParams({
      filters: [],
      query: "831 main",
      base: base.toString(),
    });
    assert.equal(next.has("filters"), false);
    assert.equal(next.get("q"), "831 main");
  });

  it("leaves unrelated params such as cleanupDone untouched", () => {
    const next = composePortfolioHealthUrlParams({
      filters: ["documents"],
      query: "main",
      base: "cleanupDone=1",
    });
    assert.equal(next.get("cleanupDone"), "1");
    assert.equal(next.get("filters"), "documents");
    assert.equal(next.get("q"), "main");
  });

  it("round-trips through the filter parser", () => {
    const params = composePortfolioHealthUrlParams({
      filters: ["tenant_name", "rent_zero"],
      query: "",
    });
    assert.deepEqual(parseCleanupFiltersParam(params.get("filters")), [
      "tenant_name",
      "rent_zero",
    ]);
  });
});
