import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPortfolioImportPlaceholderDate, portfolioImportPlaceholderDate } from "@/lib/portfolio/import-row";
import {
  assessPortfolioHealthProperty,
  filterPortfolioHealthRows,
  summarizePortfolioHealth,
  type PortfolioHealthPropertyInput,
} from "@/lib/property/portfolio-health";

function baseProperty(
  overrides: Partial<PortfolioHealthPropertyInput> = {},
): PortfolioHealthPropertyInput {
  return {
    id: "prop-1",
    name: "123 Main St",
    streetLine1: "123 Main St",
    streetLine2: null,
    city: "Vancouver",
    province: "BC",
    postalCode: "V6B 1A1",
    ownerEmail: "owner@example.com",
    ownerPhone: "604-555-0100",
    strataNotes: "Strata corp 123",
    documentCount: 1,
    tenancies: [],
    contacts: [],
    ...overrides,
  };
}

describe("assessPortfolioHealthProperty", () => {
  it("marks a vacant property complete when required fields are present", () => {
    const row = assessPortfolioHealthProperty(baseProperty());
    assert.equal(row.isVacant, true);
    assert.equal(row.overallStatus, "complete");
    assert.equal(row.activeTenantStatus, "not_applicable");
  });

  it("flags missing owner contact and documents", () => {
    const row = assessPortfolioHealthProperty(
      baseProperty({
        ownerEmail: null,
        ownerPhone: null,
        documentCount: 0,
      }),
    );
    assert.equal(row.overallStatus, "needs_review");
    assert.ok(row.missingItemKeys.includes("owner_contact"));
    assert.ok(row.missingItemKeys.includes("documents"));
  });

  it("requires tenant and lease details for occupied properties", () => {
    const row = assessPortfolioHealthProperty(
      baseProperty({
        documentCount: 2,
        tenancies: [
          {
            status: "active",
            leaseStartDate: new Date("2026-01-01T12:00:00.000Z"),
            moveInDate: new Date("2026-01-01T12:00:00.000Z"),
            monthlyRent: 2400,
            securityDeposit: 1200,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
        contacts: [
          {
            contactType: "tenant",
            firstName: "Taylor",
            lastName: "Applicant",
            email: "tenant@example.com",
            phone: "604-555-0200",
          },
        ],
      }),
    );

    assert.equal(row.isVacant, false);
    assert.equal(row.overallStatus, "complete");
    assert.equal(row.tenantContactStatus, "ok");
    assert.equal(row.leaseRentStatus, "ok");
  });

  it("flags import placeholder rent, deposit, and dates without blocking on optional fields", () => {
    const placeholderDate = portfolioImportPlaceholderDate();
    const row = assessPortfolioHealthProperty(
      baseProperty({
        documentCount: 1,
        tenancies: [
          {
            status: "active",
            leaseStartDate: placeholderDate,
            moveInDate: placeholderDate,
            monthlyRent: 0,
            securityDeposit: 0,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
        contacts: [
          {
            contactType: "tenant",
            firstName: "Taylor",
            lastName: "Applicant",
            email: "tenant@example.com",
            phone: null,
          },
        ],
      }),
    );

    assert.equal(row.overallStatus, "needs_review");
    assert.equal(row.hasImportPlaceholders, true);
    assert.ok(row.missingItemKeys.includes("monthly_rent_zero"));
    assert.ok(row.missingItemKeys.includes("security_deposit_zero"));
    assert.ok(row.missingItemKeys.includes("import_placeholder_dates"));
    assert.ok(row.missingItemKeys.includes("tenant_phone"));
    assert.ok(row.missingItems.includes("Missing tenant phone"));
  });

  it("treats strata notes as recommended only", () => {
    const row = assessPortfolioHealthProperty(
      baseProperty({
        strataNotes: null,
      }),
    );
    assert.equal(row.overallStatus, "complete");
    assert.equal(row.strataNotesStatus, "recommended");
    assert.ok(row.missingItemKeys.includes("strata_notes"));
  });
});

describe("portfolio health helpers", () => {
  it("summarizes portfolio counts", () => {
    const rows = [
      assessPortfolioHealthProperty(baseProperty()),
      assessPortfolioHealthProperty(
        baseProperty({
          id: "prop-2",
          ownerEmail: null,
          ownerPhone: null,
          documentCount: 0,
        }),
      ),
    ];
    const summary = summarizePortfolioHealth(rows);
    assert.equal(summary.total, 2);
    assert.equal(summary.complete, 1);
    assert.equal(summary.needsReview, 1);
    assert.equal(summary.missingDocuments, 1);
    assert.equal(summary.missingOwnerContact, 1);
    assert.equal(summary.vacant, 2);
  });

  it("filters rows by category", () => {
    const complete = assessPortfolioHealthProperty(baseProperty());
    const incomplete = assessPortfolioHealthProperty(
      baseProperty({
        id: "prop-2",
        documentCount: 0,
      }),
    );
    const rows = [complete, incomplete];

    assert.equal(filterPortfolioHealthRows(rows, "missing_documents").length, 1);
    assert.equal(filterPortfolioHealthRows(rows, "complete").length, 1);
    assert.equal(filterPortfolioHealthRows(rows, "vacant").length, 2);
  });
});

describe("isPortfolioImportPlaceholderDate", () => {
  it("matches the portfolio import placeholder pattern", () => {
    const placeholder = portfolioImportPlaceholderDate();
    assert.equal(isPortfolioImportPlaceholderDate(placeholder), true);
    assert.equal(isPortfolioImportPlaceholderDate(new Date("2026-06-15T12:00:00.000Z")), false);
  });
});
