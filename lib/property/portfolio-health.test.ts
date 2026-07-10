import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPortfolioImportPlaceholderDate,
  PORTFOLIO_PDF_IMPORT_PLACEHOLDER_DATE_KEY,
  portfolioImportPlaceholderDate,
} from "@/lib/portfolio/import-row";
import {
  assessPortfolioHealthProperty,
  assessPortfolioHealthUnitSlot,
  filterPortfolioHealthRows,
  summarizePortfolioHealth,
  type PortfolioHealthPropertyInput,
  type PortfolioHealthUnitInput,
} from "@/lib/property/portfolio-health";

function occupiedUnit(
  overrides: {
    unitId?: string;
    unitLabel?: string;
    tenancy?: Partial<NonNullable<PortfolioHealthUnitInput["tenancy"]>>;
    contacts?: PortfolioHealthUnitInput["contacts"];
  } = {},
): PortfolioHealthUnitInput {
  return {
    unitId: overrides.unitId ?? "unit-1",
    unitLabel: overrides.unitLabel ?? "Entire Property",
    tenancy: {
      id: "tenancy-1",
      unitId: overrides.unitId ?? "unit-1",
      status: "active",
      leaseStartDate: new Date("2026-01-01T12:00:00.000Z"),
      moveInDate: new Date("2026-01-01T12:00:00.000Z"),
      monthlyRent: 2400,
      securityDeposit: 1200,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      ...overrides.tenancy,
    },
    contacts: overrides.contacts ?? [
      {
        contactType: "tenant",
        firstName: "Taylor",
        lastName: "Applicant",
        email: "tenant@example.com",
        phone: "604-555-0200",
      },
    ],
  };
}

function vacantUnit(unitId: string, unitLabel: string): PortfolioHealthUnitInput {
  return {
    unitId,
    unitLabel,
    tenancy: null,
    contacts: [],
  };
}

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
    units: [vacantUnit("unit-1", "Entire Property")],
    ...overrides,
  };
}

describe("assessPortfolioHealthUnitSlot", () => {
  it("treats null, undefined, and empty-string email as missing", () => {
    const blankEmail = assessPortfolioHealthUnitSlot(
      occupiedUnit({
        contacts: [
          {
            contactType: "tenant",
            firstName: "Legacy",
            lastName: "Tenant",
            email: "",
            phone: "604-555-0100",
          },
        ],
      }),
    );
    assert.ok(blankEmail.tenantDataFlags.includes("tenant_email"));

    const clearedEmail = assessPortfolioHealthUnitSlot(
      occupiedUnit({
        contacts: [
          {
            contactType: "tenant",
            firstName: "PDF",
            lastName: "Corrected",
            email: "   ",
            phone: null,
          },
        ],
      }),
    );
    assert.ok(clearedEmail.tenantDataFlags.includes("tenant_email"));
    assert.ok(clearedEmail.tenantDataFlags.includes("tenant_phone"));
  });

  it("flags the PDF sentinel date 2020-03-03 as a placeholder", () => {
    const slot = assessPortfolioHealthUnitSlot(
      occupiedUnit({
        tenancy: {
          id: "tenancy-charland",
          unitId: "unit-1",
          status: "active",
          leaseStartDate: new Date(`${PORTFOLIO_PDF_IMPORT_PLACEHOLDER_DATE_KEY}T12:00:00.000Z`),
          moveInDate: new Date(`${PORTFOLIO_PDF_IMPORT_PLACEHOLDER_DATE_KEY}T12:00:00.000Z`),
          monthlyRent: 2500,
          securityDeposit: 1250,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      }),
    );
    assert.ok(slot.tenantDataFlags.includes("import_placeholder_dates"));
  });
});

describe("assessPortfolioHealthProperty", () => {
  it("marks a fully vacant property complete when required property fields are present", () => {
    const row = assessPortfolioHealthProperty(baseProperty());
    assert.equal(row.isVacant, true);
    assert.equal(row.overallStatus, "complete");
    assert.equal(row.activeTenantStatus, "not_applicable");
    assert.equal(row.unitSlots.length, 1);
    assert.equal(row.unitSlots[0]?.isVacant, true);
  });

  it("flags missing owner contact and documents at the property level", () => {
    const row = assessPortfolioHealthProperty(
      baseProperty({
        ownerEmail: null,
        ownerPhone: null,
        documentCount: 0,
      }),
    );
    assert.equal(row.overallStatus, "needs_review");
    assert.ok(row.propertyMissingItemKeys.includes("owner_contact"));
    assert.ok(row.propertyMissingItemKeys.includes("documents"));
  });

  it("requires tenant and lease details per occupied unit", () => {
    const row = assessPortfolioHealthProperty(
      baseProperty({
        documentCount: 2,
        units: [occupiedUnit()],
      }),
    );

    assert.equal(row.isVacant, false);
    assert.equal(row.overallStatus, "complete");
    assert.equal(row.tenantContactStatus, "ok");
    assert.equal(row.leaseRentStatus, "ok");
  });

  it("evaluates upper and lower suites independently", () => {
    const row = assessPortfolioHealthProperty(
      baseProperty({
        id: "prop-831",
        streetLine1: "831 W 24th Ave",
        units: [
          occupiedUnit({
            unitId: "unit-upper",
            unitLabel: "Upper",
            tenancy: {
              id: "tenancy-upper",
              unitId: "unit-upper",
              status: "active",
              leaseStartDate: new Date("2026-01-01T12:00:00.000Z"),
              moveInDate: new Date("2026-01-01T12:00:00.000Z"),
              monthlyRent: 2500,
              securityDeposit: 1250,
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
            },
            contacts: [
              {
                contactType: "tenant",
                firstName: "Upper",
                lastName: "Tenant",
                email: "upper@example.com",
                phone: null,
              },
            ],
          }),
          occupiedUnit({
            unitId: "unit-lower",
            unitLabel: "Lower",
            tenancy: {
              id: "tenancy-lower",
              unitId: "unit-lower",
              status: "active",
              leaseStartDate: new Date(`${PORTFOLIO_PDF_IMPORT_PLACEHOLDER_DATE_KEY}T12:00:00.000Z`),
              moveInDate: new Date(`${PORTFOLIO_PDF_IMPORT_PLACEHOLDER_DATE_KEY}T12:00:00.000Z`),
              monthlyRent: 0,
              securityDeposit: 0,
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
            },
            contacts: [
              {
                contactType: "tenant",
                firstName: "Lower",
                lastName: "Tenant",
                email: "lower@example.com",
                phone: "604-555-0300",
              },
            ],
          }),
        ],
      }),
    );

    assert.equal(row.unitSlots.length, 2);
    assert.equal(row.unitSlots[0]?.unitLabel, "Upper");
    assert.ok(row.unitSlots[0]?.tenantDataFlags.includes("tenant_phone"));
    assert.equal(row.unitSlots[1]?.unitLabel, "Lower");
    assert.ok(row.unitSlots[1]?.tenantDataFlags.includes("import_placeholder_dates"));
    assert.ok(row.unitSlots[1]?.tenantDataFlags.includes("monthly_rent_zero"));
    assert.equal(row.overallStatus, "needs_review");
    assert.equal(row.missingTenantInfo, true);
    assert.equal(row.missingRentLeaseInfo, true);
  });

  it("shows front, upper, and back units separately for consolidated properties", () => {
    const row = assessPortfolioHealthProperty(
      baseProperty({
        id: "prop-8431",
        streetLine1: "8431 Government",
        units: [
          vacantUnit("unit-front", "Front"),
          occupiedUnit({
            unitId: "unit-upper",
            unitLabel: "Upper",
            tenancy: {
              id: "tenancy-upper",
              unitId: "unit-upper",
              status: "active",
              leaseStartDate: new Date("2026-01-01T12:00:00.000Z"),
              moveInDate: new Date("2026-01-01T12:00:00.000Z"),
              monthlyRent: 1800,
              securityDeposit: 900,
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
            },
          }),
          vacantUnit("unit-back", "Back"),
        ],
      }),
    );

    assert.deepEqual(
      row.unitSlots.map((slot) => [slot.unitLabel, slot.isVacant]),
      [
        ["Front", true],
        ["Upper", false],
        ["Back", true],
      ],
    );
    assert.equal(row.isVacant, false);
  });

  it("flags import placeholder rent, deposit, and dates without blocking on optional fields", () => {
    const placeholderDate = portfolioImportPlaceholderDate();
    const row = assessPortfolioHealthProperty(
      baseProperty({
        documentCount: 1,
        units: [
          occupiedUnit({
            tenancy: {
              id: "tenancy-1",
              unitId: "unit-1",
              status: "active",
              leaseStartDate: placeholderDate,
              moveInDate: placeholderDate,
              monthlyRent: 0,
              securityDeposit: 0,
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
            },
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
        ],
      }),
    );

    assert.equal(row.overallStatus, "needs_review");
    assert.equal(row.hasImportPlaceholders, true);
    assert.ok(row.missingItemKeys.includes("monthly_rent_zero"));
    assert.ok(row.missingItemKeys.includes("security_deposit_zero"));
    assert.ok(row.missingItemKeys.includes("import_placeholder_dates"));
    assert.ok(row.missingItemKeys.includes("tenant_phone"));
  });

  it("treats strata notes as recommended only", () => {
    const row = assessPortfolioHealthProperty(
      baseProperty({
        strataNotes: null,
      }),
    );
    assert.equal(row.overallStatus, "complete");
    assert.equal(row.strataNotesStatus, "recommended");
    assert.ok(row.propertyMissingItemKeys.includes("strata_notes"));
  });

  it("aggregates unit issues into property needs review while keeping property issues separate", () => {
    const row = assessPortfolioHealthProperty(
      baseProperty({
        postalCode: "TBD 0T0",
        units: [
          occupiedUnit({
            contacts: [
              {
                contactType: "tenant",
                firstName: "Only",
                lastName: "Name",
                email: "",
                phone: null,
              },
            ],
          }),
        ],
      }),
    );

    assert.equal(row.overallStatus, "needs_review");
    assert.ok(row.propertyMissingItemKeys.includes("missing_postal_code"));
    assert.ok(row.unitSlots[0]?.tenantDataFlags.includes("tenant_email"));
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
    assert.equal(summary.activeProperties, 2);
    assert.equal(summary.complete, 1);
    assert.equal(summary.needsReview, 1);
    assert.equal(summary.missingDocuments, 1);
    assert.equal(summary.missingOwnerContact, 1);
    assert.equal(summary.vacant, 2);
    assert.equal(summary.needsTenantCleanup, 0);
    assert.equal(summary.needsPropertyCleanup, 1);
    assert.equal(summary.issueSnapshot.propertyIssues.missingDocuments, 1);
  });

  it("filters rows by category using aggregated unit and property issues", () => {
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
  it("matches noon and midnight UTC timestamps for the placeholder calendar date", () => {
    const referenceDate = new Date("2026-06-15T12:00:00.000Z");
    const placeholder = portfolioImportPlaceholderDate(referenceDate);
    const placeholderKey = placeholder.toISOString().slice(0, 10);

    assert.equal(isPortfolioImportPlaceholderDate(placeholder, referenceDate), true);
    assert.equal(
      isPortfolioImportPlaceholderDate(new Date(`${placeholderKey}T00:00:00.000Z`), referenceDate),
      true,
    );
    assert.equal(
      isPortfolioImportPlaceholderDate(new Date(`${placeholderKey}T12:00:00.000Z`), referenceDate),
      true,
    );
    assert.equal(isPortfolioImportPlaceholderDate(new Date("2026-06-15T12:00:00.000Z"), referenceDate), false);
    assert.equal(isPortfolioImportPlaceholderDate(new Date("2025-07-01T00:00:00.000Z"), referenceDate), false);
  });

  it("matches the PDF import sentinel date 2020-03-03", () => {
    assert.equal(
      isPortfolioImportPlaceholderDate(
        new Date(`${PORTFOLIO_PDF_IMPORT_PLACEHOLDER_DATE_KEY}T12:00:00.000Z`),
      ),
      true,
    );
  });

  it("flags midnight UTC placeholder dates on the health assessment", () => {
    const placeholderKey = portfolioImportPlaceholderDate().toISOString().slice(0, 10);
    const midnightPlaceholder = new Date(`${placeholderKey}T00:00:00.000Z`);

    const row = assessPortfolioHealthProperty(
      baseProperty({
        documentCount: 1,
        units: [
          occupiedUnit({
            tenancy: {
              id: "tenancy-1",
              unitId: "unit-1",
              status: "active",
              leaseStartDate: midnightPlaceholder,
              moveInDate: midnightPlaceholder,
              monthlyRent: 2400,
              securityDeposit: 1200,
              createdAt: new Date("2026-06-15T00:00:00.000Z"),
            },
          }),
        ],
      }),
    );

    assert.equal(isPortfolioImportPlaceholderDate(midnightPlaceholder), true);
    assert.equal(row.hasImportPlaceholders, true);
    assert.ok(row.missingItemKeys.includes("import_placeholder_dates"));
  });
});
