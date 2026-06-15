import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PORTFOLIO_IMPORT_UNKNOWN_CITY } from "@/lib/portfolio/parse-portfolio-address";
import { PORTFOLIO_PDF_IMPORT_PLACEHOLDER_DATE_KEY } from "@/lib/portfolio/import-row";
import {
  assessPortfolioHealthProperty,
  type PortfolioHealthPropertyInput,
  type PortfolioHealthRow,
  type PortfolioHealthUnitInput,
} from "@/lib/property/portfolio-health";
import {
  buildPortfolioHealthIssueSnapshot,
  countActiveTenancies,
  countOccupiedUnitsWithIssue,
  countPropertiesWithIssue,
  propertyNeedsTenantCleanup,
  summarizePortfolioHealth,
} from "@/lib/property/portfolio-health-metrics";

function vacantUnit(unitId: string, unitLabel: string): PortfolioHealthUnitInput {
  return { unitId, unitLabel, tenancy: null, contacts: [] };
}

function occupiedUnit(
  unitId: string,
  unitLabel: string,
  overrides: {
    tenancy?: Partial<NonNullable<PortfolioHealthUnitInput["tenancy"]>>;
    contacts?: PortfolioHealthUnitInput["contacts"];
  } = {},
): PortfolioHealthUnitInput {
  return {
    unitId,
    unitLabel,
    tenancy: {
      id: `tenancy-${unitId}`,
      unitId,
      status: "active",
      leaseStartDate: new Date("2026-01-01T12:00:00.000Z"),
      moveInDate: new Date("2026-01-01T12:00:00.000Z"),
      monthlyRent: 2500,
      securityDeposit: 1250,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      ...overrides.tenancy,
    },
    contacts: overrides.contacts ?? [
      {
        contactType: "tenant",
        firstName: "Taylor",
        lastName: "Tenant",
        email: "tenant@example.com",
        phone: "604-555-0200",
      },
    ],
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

describe("portfolio health metrics", () => {
  it("counts tenant cleanup once per property even when multiple units need cleanup", () => {
    const row = assessPortfolioHealthProperty(
      baseProperty({
        id: "prop-831",
        streetLine1: "831 W 24th Ave",
        units: [
          occupiedUnit("unit-upper", "Upper", {
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
          occupiedUnit("unit-lower", "Lower", {
            contacts: [
              {
                contactType: "tenant",
                firstName: "Lower",
                lastName: "Tenant",
                email: "lower@example.com",
                phone: null,
              },
            ],
          }),
        ],
      }),
    );

    assert.equal(propertyNeedsTenantCleanup(row), true);
    const summary = summarizePortfolioHealth([row]);
    assert.equal(summary.needsTenantCleanup, 1);
    assert.equal(summary.issueSnapshot.tenantIssues.missingTenantPhone, 2);
  });

  it("excludes vacant units from tenant cleanup metrics", () => {
    const row = assessPortfolioHealthProperty(
      baseProperty({
        units: [
          vacantUnit("unit-front", "Front"),
          occupiedUnit("unit-upper", "Upper", {
            contacts: [
              {
                contactType: "tenant",
                firstName: "Upper",
                lastName: "Tenant",
                email: "",
                phone: "604-555-0100",
              },
            ],
          }),
        ],
      }),
    );

    assert.equal(countActiveTenancies([row]), 1);
    assert.equal(countOccupiedUnitsWithIssue([row], "tenant_email"), 1);
    assert.equal(countOccupiedUnitsWithIssue([row], "tenant_phone"), 0);
    assert.equal(row.unitSlots.find((slot) => slot.unitLabel === "Front")?.tenantDataFlags.length, 0);
  });

  it("counts missing lease dates once per occupied unit when both dates are missing", () => {
    const row = assessPortfolioHealthProperty(
      baseProperty({
        units: [
          occupiedUnit("unit-1", "Upper", {
            tenancy: {
              id: "tenancy-1",
              unitId: "unit-1",
              status: "active",
              leaseStartDate: null,
              moveInDate: null,
              monthlyRent: 2500,
              securityDeposit: 1250,
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
            },
          }),
        ],
      }),
    );

    const snapshot = buildPortfolioHealthIssueSnapshot([row]);
    assert.equal(snapshot.tenantIssues.missingLeaseDates, 1);
  });

  it("does not count archived tenancy data when rows only include active current tenancies", () => {
    const activeRow = assessPortfolioHealthProperty(
      baseProperty({
        units: [
          occupiedUnit("unit-1", "Upper"),
          vacantUnit("unit-2", "Lower"),
        ],
      }),
    );

    const summary = summarizePortfolioHealth([activeRow]);
    assert.equal(summary.activeTenancies, 1);
    assert.equal(summary.activeProperties, 1);
  });

  it("builds property issue counters at the property level", () => {
    const rows: PortfolioHealthRow[] = [
      assessPortfolioHealthProperty(
        baseProperty({
          id: "prop-docs",
          documentCount: 0,
          postalCode: "TBD 0T0",
          city: PORTFOLIO_IMPORT_UNKNOWN_CITY,
          ownerEmail: null,
          ownerPhone: null,
        }),
      ),
      assessPortfolioHealthProperty(
        baseProperty({
          id: "prop-ok",
          documentCount: 2,
        }),
      ),
    ];

    assert.equal(countPropertiesWithIssue(rows, "documents"), 1);
    assert.equal(countPropertiesWithIssue(rows, "missing_postal_code"), 1);
    assert.equal(countPropertiesWithIssue(rows, "missing_city"), 1);
    assert.equal(countPropertiesWithIssue(rows, "owner_contact"), 1);

    const summary = summarizePortfolioHealth(rows);
    assert.equal(summary.activeProperties, 2);
    assert.equal(summary.issueSnapshot.propertyIssues.missingDocuments, 1);
    assert.equal(summary.needsPropertyCleanup, 1);
  });

  it("counts placeholder dates on occupied units only", () => {
    const row = assessPortfolioHealthProperty(
      baseProperty({
        units: [
          vacantUnit("unit-front", "Front"),
          occupiedUnit("unit-lower", "Lower", {
            tenancy: {
              id: "tenancy-lower",
              unitId: "unit-lower",
              status: "active",
              leaseStartDate: new Date(`${PORTFOLIO_PDF_IMPORT_PLACEHOLDER_DATE_KEY}T12:00:00.000Z`),
              moveInDate: new Date(`${PORTFOLIO_PDF_IMPORT_PLACEHOLDER_DATE_KEY}T12:00:00.000Z`),
              monthlyRent: 2500,
              securityDeposit: 1250,
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
            },
          }),
        ],
      }),
    );

    const summary = summarizePortfolioHealth([row]);
    assert.equal(summary.issueSnapshot.tenantIssues.placeholderLeaseDates, 1);
    assert.equal(summary.needsTenantCleanup, 1);
  });

  it("summarizes complete properties separately from cleanup queues", () => {
    const complete = assessPortfolioHealthProperty(baseProperty({ id: "prop-complete" }));
    const incomplete = assessPortfolioHealthProperty(
      baseProperty({
        id: "prop-incomplete",
        documentCount: 0,
        units: [
          occupiedUnit("unit-1", "Upper", {
            contacts: [
              {
                contactType: "tenant",
                firstName: "Legacy",
                lastName: "Tenant",
                email: "",
                phone: null,
              },
            ],
          }),
        ],
      }),
    );

    const summary = summarizePortfolioHealth([complete, incomplete]);
    assert.equal(summary.complete, 1);
    assert.equal(summary.needsReview, 1);
    assert.equal(summary.needsTenantCleanup, 1);
    assert.equal(summary.needsPropertyCleanup, 1);
    assert.equal(summary.issueSnapshot.tenantIssues.missingTenantEmail, 1);
  });
});
