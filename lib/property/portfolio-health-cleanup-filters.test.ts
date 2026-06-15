import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PORTFOLIO_PDF_IMPORT_PLACEHOLDER_DATE_KEY } from "@/lib/portfolio/import-row";
import {
  assessPortfolioHealthProperty,
  assessPortfolioHealthUnitSlot,
  type PortfolioHealthRow,
  type PortfolioHealthUnitInput,
} from "@/lib/property/portfolio-health";
import {
  filterPortfolioHealthCleanupQueue,
  parseCleanupFiltersParam,
  propertyMatchesAllCleanupFilters,
  serializeCleanupFiltersParam,
  unitMatchesAllTenantCleanupFilters,
  unitMatchesTenantCleanupFilter,
} from "@/lib/property/portfolio-health-cleanup-filters";

function occupiedUnit(
  overrides: {
    unitId?: string;
    unitLabel?: string;
    tenancy?: Partial<NonNullable<PortfolioHealthUnitInput["tenancy"]>>;
    contacts?: PortfolioHealthUnitInput["contacts"];
  } = {},
): PortfolioHealthUnitInput {
  return {
    unitId: overrides.unitId ?? "unit-upper",
    unitLabel: overrides.unitLabel ?? "Upper",
    tenancy: {
      id: "tenancy-upper",
      unitId: overrides.unitId ?? "unit-upper",
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
        firstName: "Upper",
        lastName: "Tenant",
        email: "upper@example.com",
        phone: null,
      },
    ],
  };
}

function build831Row(): PortfolioHealthRow {
  return assessPortfolioHealthProperty({
    id: "prop-831",
    name: "831 W 24th Ave",
    streetLine1: "831 W 24th Ave",
    streetLine2: null,
    city: "Vancouver",
    province: "BC",
    postalCode: "V6P 2C2",
    ownerEmail: "owner@example.com",
    ownerPhone: "604-555-0100",
    strataNotes: "Strata notes",
    documentCount: 1,
    units: [
      occupiedUnit({
        unitId: "unit-upper",
        unitLabel: "Upper",
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
            email: "",
            phone: "604-555-0300",
          },
        ],
      }),
    ],
  });
}

describe("portfolio health cleanup filters", () => {
  it("matches a single tenant filter", () => {
    const row = build831Row();
    assert.equal(propertyMatchesAllCleanupFilters(row, ["tenant_phone"]), true);
    assert.equal(propertyMatchesAllCleanupFilters(row, ["tenant_email"]), true);
    assert.equal(propertyMatchesAllCleanupFilters(row, ["rent_zero"]), true);
  });

  it("uses AND logic across multiple tenant filters on the same unit", () => {
    const row = build831Row();
    assert.equal(
      propertyMatchesAllCleanupFilters(row, ["tenant_email", "placeholder_dates"]),
      true,
    );
    assert.equal(
      propertyMatchesAllCleanupFilters(row, ["tenant_phone", "placeholder_dates"]),
      false,
    );
  });

  it("uses AND logic across tenant and property filters", () => {
    const row = build831Row();
    const withPostalIssue = assessPortfolioHealthProperty({
      id: row.propertyId,
      name: row.propertyLabel,
      streetLine1: "831 W 24th Ave",
      streetLine2: null,
      city: "Vancouver",
      province: "BC",
      postalCode: "TBD 0T0",
      ownerEmail: row.propertyMissingItemKeys.includes("owner_contact") ? null : "owner@example.com",
      ownerPhone: "604-555-0100",
      strataNotes: "Strata notes",
      documentCount: 1,
      units: [
        occupiedUnit({
          unitId: "unit-upper",
          unitLabel: "Upper",
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
              email: "",
              phone: "604-555-0300",
            },
          ],
        }),
      ],
    });

    assert.equal(
      propertyMatchesAllCleanupFilters(withPostalIssue, ["missing_postal_code", "tenant_email"]),
      true,
    );
    assert.equal(
      propertyMatchesAllCleanupFilters(withPostalIssue, ["missing_postal_code", "documents"]),
      false,
    );
  });

  it("shows only matching units and issue badges for a mixed multi-unit property", () => {
    const filtered = filterPortfolioHealthCleanupQueue([build831Row()], ["tenant_phone"]);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.visibleUnitSlots.length, 1);
    assert.equal(filtered[0]?.visibleUnitSlots[0]?.unitLabel, "Upper");
    assert.deepEqual(filtered[0]?.visibleUnitSlots[0]?.visibleTenantDataFlags, ["tenant_phone"]);
  });

  it("shows only units matching all selected tenant filters", () => {
    const filtered = filterPortfolioHealthCleanupQueue(
      [build831Row()],
      ["tenant_email", "placeholder_dates"],
    );
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.visibleUnitSlots.length, 1);
    assert.equal(filtered[0]?.visibleUnitSlots[0]?.unitLabel, "Lower");
    assert.ok(filtered[0]?.visibleUnitSlots[0]?.visibleTenantDataFlags.includes("tenant_email"));
    assert.ok(
      filtered[0]?.visibleUnitSlots[0]?.visibleTenantDataFlags.includes("import_placeholder_dates"),
    );
  });

  it("treats empty-string email as missing for tenant email filter", () => {
    const slot = assessPortfolioHealthUnitSlot(
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
    assert.equal(unitMatchesTenantCleanupFilter(slot, "tenant_email"), true);
  });

  it("matches placeholder date filter for the PDF sentinel date", () => {
    const slot = assessPortfolioHealthUnitSlot(
      occupiedUnit({
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
        contacts: [
          {
            contactType: "tenant",
            firstName: "Legacy",
            lastName: "Tenant",
            email: "tenant@example.com",
            phone: "604-555-0100",
          },
        ],
      }),
    );
    assert.equal(unitMatchesTenantCleanupFilter(slot, "placeholder_dates"), true);
    assert.equal(
      unitMatchesAllTenantCleanupFilters(slot, ["placeholder_dates", "tenant_phone"]),
      false,
    );
  });

  it("parses and serializes cleanup filter URL params", () => {
    assert.deepEqual(parseCleanupFiltersParam("tenant_email,placeholder_dates"), [
      "tenant_email",
      "placeholder_dates",
    ]);
    assert.deepEqual(parseCleanupFiltersParam("tenant_email,tenant_email"), ["tenant_email"]);
    assert.equal(
      serializeCleanupFiltersParam(["tenant_email", "placeholder_dates"]),
      "tenant_email,placeholder_dates",
    );
  });

  it("returns all rows and units when no filters are selected", () => {
    const row = build831Row();
    const filtered = filterPortfolioHealthCleanupQueue([row], []);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.visibleUnitSlots.length, 2);
  });
});
