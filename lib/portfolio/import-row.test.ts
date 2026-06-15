import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCsv } from "./csv";
import {
  getPortfolioImportPlaceholderDateKey,
  hasTenantData,
  isPortfolioImportPlaceholderDate,
  PORTFOLIO_PDF_IMPORT_PLACEHOLDER_DATE_KEY,
  portfolioImportPlaceholderDate,
  splitTenantName,
  validatePortfolioRow,
  validateTenantEmail,
} from "./import-row";

describe("portfolio import row helpers", () => {
  it("splits a two-part tenant name", () => {
    const result = splitTenantName("Taylor Applicant");
    assert.ok(!("error" in result));
    assert.equal(result.firstName, "Taylor");
    assert.equal(result.lastName, "Applicant");
  });

  it("uses a dot last name for single-token tenant names", () => {
    const result = splitTenantName("Madonna");
    assert.ok(!("error" in result));
    assert.equal(result.firstName, "Madonna");
    assert.equal(result.lastName, ".");
  });

  it("normalizes tenant email to lowercase", () => {
    const result = validateTenantEmail("Tenant@Example.COM");
    assert.equal(result, "tenant@example.com");
  });

  it("validates property-only rows without tenant data", () => {
    const result = validatePortfolioRow({
      rowNumber: 2,
      propertyAddress: "123 Main St, Vancouver, BC V6B 1A1",
      tenantName: "",
      tenantEmail: "",
      tenantPhone: "",
      ownerEmail: "owner@example.com",
      ownerPhone: "604-555-0100",
      strataInformation: "Strata corp 123",
    });
    assert.ok(!("error" in result));
    assert.equal(result.tenant, null);
    assert.equal(result.ownerEmail, "owner@example.com");
    assert.equal(result.strataNotes, "Strata corp 123");
  });

  it("requires tenant name and email together", () => {
    const result = validatePortfolioRow({
      rowNumber: 3,
      propertyAddress: "123 Main St, Vancouver, BC V6B 1A1",
      tenantName: "Taylor Applicant",
      tenantEmail: "",
      tenantPhone: "",
      ownerEmail: "",
      ownerPhone: "",
      strataInformation: "",
    });
    assert.ok("error" in result);
  });
});

describe("parseCsv", () => {
  it("parses quoted commas", () => {
    const rows = parseCsv('Property Address,Tenant Name\n"123 Main St, Unit 4, Vancouver, BC V6B 1A1",Taylor');
    assert.equal(rows.length, 2);
    assert.equal(rows[1][0], "123 Main St, Unit 4, Vancouver, BC V6B 1A1");
    assert.equal(rows[1][1], "Taylor");
  });
});

describe("hasTenantData", () => {
  it("detects partial tenant data", () => {
    assert.equal(hasTenantData({ tenantName: "A", tenantEmail: "" } as never), true);
    assert.equal(hasTenantData({ tenantName: "", tenantEmail: "" } as never), false);
  });
});

describe("portfolio import placeholder dates", () => {
  it("detects midnight and noon UTC for the placeholder calendar date", () => {
    const referenceDate = new Date("2026-06-15T12:00:00.000Z");
    const placeholderKey = getPortfolioImportPlaceholderDateKey(referenceDate);

    assert.equal(placeholderKey, "2025-06-01");
    assert.equal(
      isPortfolioImportPlaceholderDate(new Date("2025-06-01T00:00:00.000Z"), referenceDate),
      true,
    );
    assert.equal(
      isPortfolioImportPlaceholderDate(new Date("2025-06-01T12:00:00.000Z"), referenceDate),
      true,
    );
    assert.equal(
      isPortfolioImportPlaceholderDate(portfolioImportPlaceholderDate(), referenceDate),
      true,
    );
    assert.equal(
      isPortfolioImportPlaceholderDate(new Date("2025-07-01T00:00:00.000Z"), referenceDate),
      false,
    );
  });

  it("detects the PDF import sentinel date 2020-03-03", () => {
    assert.equal(
      isPortfolioImportPlaceholderDate(
        new Date(`${PORTFOLIO_PDF_IMPORT_PLACEHOLDER_DATE_KEY}T12:00:00.000Z`),
      ),
      true,
    );
    assert.equal(isPortfolioImportPlaceholderDate(PORTFOLIO_PDF_IMPORT_PLACEHOLDER_DATE_KEY), true);
    assert.equal(isPortfolioImportPlaceholderDate("2020-03-03T00:00:00.000Z"), true);
  });

  it("returns false for invalid or empty values without throwing", () => {
    assert.equal(isPortfolioImportPlaceholderDate(null), false);
    assert.equal(isPortfolioImportPlaceholderDate(undefined), false);
    assert.equal(isPortfolioImportPlaceholderDate(""), false);
    assert.equal(isPortfolioImportPlaceholderDate("   "), false);
    assert.equal(isPortfolioImportPlaceholderDate("not-a-date"), false);
    assert.equal(isPortfolioImportPlaceholderDate("2020-13-40"), false);
    assert.equal(isPortfolioImportPlaceholderDate(new Date("invalid")), false);
    assert.equal(isPortfolioImportPlaceholderDate(new Date(Number.NaN)), false);
  });

  it("accepts ISO date strings and valid Date objects", () => {
    const referenceDate = new Date("2026-06-15T12:00:00.000Z");
    assert.equal(isPortfolioImportPlaceholderDate("2025-06-01", referenceDate), true);
    assert.equal(isPortfolioImportPlaceholderDate("2026-06-15T12:00:00.000Z", referenceDate), false);
    assert.equal(isPortfolioImportPlaceholderDate(new Date("2026-01-01T12:00:00.000Z"), referenceDate), false);
  });
});
