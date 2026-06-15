import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PORTFOLIO_PDF_IMPORT_PLACEHOLDER_DATE_KEY } from "@/lib/portfolio/import-row";
import {
  assessPortfolioHealthProperty,
  type PortfolioHealthUnitInput,
} from "@/lib/property/portfolio-health";
import { filterPortfolioHealthCleanupQueue } from "@/lib/property/portfolio-health-cleanup-filters";
import {
  flattenHealthCleanupTenancyQueue,
  selectNextTenancyInCleanupQueue,
} from "@/lib/property/portfolio-health-cleanup-queue";
import { buildHealthReturnUrl } from "@/lib/property/portfolio-health-return";

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

function buildTwoTenantEmailIssuesRow() {
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
        tenancy: { id: "tenancy-upper", unitId: "unit-upper" },
        contacts: [
          {
            contactType: "tenant",
            firstName: "Upper",
            lastName: "Tenant",
            email: "",
            phone: "604-555-0101",
          },
        ],
      }),
      occupiedUnit({
        unitId: "unit-lower",
        unitLabel: "Lower",
        tenancy: {
          id: "tenancy-lower",
          unitId: "unit-lower",
          leaseStartDate: new Date(`${PORTFOLIO_PDF_IMPORT_PLACEHOLDER_DATE_KEY}T12:00:00.000Z`),
          moveInDate: new Date(`${PORTFOLIO_PDF_IMPORT_PLACEHOLDER_DATE_KEY}T12:00:00.000Z`),
          monthlyRent: 0,
          securityDeposit: 0,
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

describe("portfolio health cleanup queue", () => {
  it("flattens occupied tenancies from filtered health rows in order", () => {
    const filtered = filterPortfolioHealthCleanupQueue([buildTwoTenantEmailIssuesRow()], ["tenant_email"]);
    const queue = flattenHealthCleanupTenancyQueue(filtered);

    assert.equal(queue.length, 2);
    assert.equal(queue[0]?.tenancyId, "tenancy-upper");
    assert.equal(queue[1]?.tenancyId, "tenancy-lower");
  });

  it("selects the first remaining tenancy after excluding the current one", () => {
    const filtered = filterPortfolioHealthCleanupQueue([buildTwoTenantEmailIssuesRow()], ["tenant_email"]);
    const queue = flattenHealthCleanupTenancyQueue(filtered);

    assert.equal(selectNextTenancyInCleanupQueue(queue, "tenancy-upper")?.tenancyId, "tenancy-lower");
    assert.equal(selectNextTenancyInCleanupQueue(queue, "tenancy-lower"), null);
  });

  it("returns the first queue item when the edited tenancy no longer matches", () => {
    const filtered = filterPortfolioHealthCleanupQueue([buildTwoTenantEmailIssuesRow()], ["tenant_email"]);
    const queue = flattenHealthCleanupTenancyQueue(filtered);

    assert.equal(selectNextTenancyInCleanupQueue(queue, "tenancy-missing")?.tenancyId, "tenancy-upper");
  });

  it("builds health return url with cleanupDone when queue is exhausted", () => {
    assert.equal(
      buildHealthReturnUrl(["tenant_email"], { cleanupDone: "1" }),
      "/properties/health?filters=tenant_email&cleanupDone=1",
    );
  });

  it("skips vacant units without tenancy ids", () => {
    const row = assessPortfolioHealthProperty({
      id: "prop-vacant",
      name: "Vacant Property",
      streetLine1: "1 Main St",
      streetLine2: null,
      city: "Vancouver",
      province: "BC",
      postalCode: "V6P 2C2",
      ownerEmail: "owner@example.com",
      ownerPhone: "604-555-0100",
      strataNotes: "Strata notes",
      documentCount: 1,
      units: [
        {
          unitId: "unit-empty",
          unitLabel: "Main",
          tenancy: null,
          contacts: [],
        },
      ],
    });

    const queue = flattenHealthCleanupTenancyQueue(filterPortfolioHealthCleanupQueue([row], []));
    assert.equal(queue.length, 0);
  });
});
