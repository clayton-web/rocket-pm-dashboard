import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PORTFOLIO_PDF_IMPORT_PLACEHOLDER_DATE_KEY } from "@/lib/portfolio/import-row";
import { PORTFOLIO_IMPORT_UNKNOWN_CITY } from "@/lib/portfolio/parse-portfolio-address";
import {
  assessPortfolioHealthProperty,
  type PortfolioHealthUnitInput,
} from "@/lib/property/portfolio-health";
import { filterPortfolioHealthCleanupQueue } from "@/lib/property/portfolio-health-cleanup-filters";
import {
  flattenHealthCleanupPropertyQueue,
  flattenHealthCleanupTenancyQueue,
  selectNextPropertyInCleanupQueue,
  selectNextTenancyInCleanupQueue,
} from "@/lib/property/portfolio-health-cleanup-queue";
import {
  buildHealthReturnUrl,
  emptyHealthViewState,
} from "@/lib/property/portfolio-health-return";

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

/** A clean, editable property; each override introduces exactly one property-level issue. */
function editableRow(
  overrides: {
    id?: string;
    city?: string;
    postalCode?: string;
    ownerEmail?: string | null;
    ownerPhone?: string | null;
    strataNotes?: string | null;
    documentCount?: number;
  } = {},
) {
  return assessPortfolioHealthProperty({
    id: overrides.id ?? "prop-editable",
    name: "100 Oak St",
    streetLine1: "100 Oak St",
    streetLine2: null,
    city: overrides.city ?? "Vancouver",
    province: "BC",
    postalCode: overrides.postalCode ?? "V6P 2C2",
    ownerEmail: overrides.ownerEmail === undefined ? "owner@example.com" : overrides.ownerEmail,
    ownerPhone: overrides.ownerPhone === undefined ? "604-555-0100" : overrides.ownerPhone,
    strataNotes: overrides.strataNotes === undefined ? "Strata notes" : overrides.strataNotes,
    documentCount: overrides.documentCount ?? 1,
    canEdit: true,
    units: [occupiedUnit()],
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
      buildHealthReturnUrl(
        { ...emptyHealthViewState(), filters: ["tenant_email"] },
        { cleanupDone: "1" },
      ),
      "/properties/health?filters=tenant_email&cleanupDone=1",
    );
  });

  it("queues editable properties in list order and carries their repairable issues", () => {
    const rows = filterPortfolioHealthCleanupQueue(
      [
        editableRow({ id: "prop-a", city: PORTFOLIO_IMPORT_UNKNOWN_CITY }),
        editableRow({ id: "prop-b", ownerEmail: null, ownerPhone: null }),
      ],
      [],
    );
    const queue = flattenHealthCleanupPropertyQueue(rows);

    assert.deepEqual(
      queue.map((entry) => entry.propertyId),
      ["prop-a", "prop-b"],
    );
    assert.ok(queue[0]?.editableIssueKeys.includes("missing_city"));
    assert.ok(queue[1]?.editableIssueKeys.includes("owner_contact"));
  });

  it("omits properties the viewer cannot edit", () => {
    const rows = filterPortfolioHealthCleanupQueue(
      [
        { ...editableRow({ id: "prop-readonly", city: PORTFOLIO_IMPORT_UNKNOWN_CITY }), canEdit: false },
        editableRow({ id: "prop-editable", city: PORTFOLIO_IMPORT_UNKNOWN_CITY }),
      ],
      [],
    );

    assert.deepEqual(
      flattenHealthCleanupPropertyQueue(rows).map((entry) => entry.propertyId),
      ["prop-editable"],
    );
  });

  it("omits properties whose only issue is repaired outside the property editor", () => {
    // Missing documents is an upload workflow, and tenant data belongs to the tenancy editor.
    const rows = filterPortfolioHealthCleanupQueue(
      [editableRow({ id: "prop-docs", documentCount: 0 })],
      [],
    );

    assert.equal(flattenHealthCleanupPropertyQueue(rows).length, 0);
  });

  it("narrows the property queue to the active cleanup filter", () => {
    const rows = filterPortfolioHealthCleanupQueue(
      [
        editableRow({ id: "prop-city", city: PORTFOLIO_IMPORT_UNKNOWN_CITY }),
        editableRow({ id: "prop-owner", ownerEmail: null, ownerPhone: null }),
      ],
      ["missing_city"],
    );

    assert.deepEqual(
      flattenHealthCleanupPropertyQueue(rows).map((entry) => entry.propertyId),
      ["prop-city"],
    );
  });

  it("advances through the property queue and reports exhaustion", () => {
    const rows = filterPortfolioHealthCleanupQueue(
      [
        editableRow({ id: "prop-a", city: PORTFOLIO_IMPORT_UNKNOWN_CITY }),
        editableRow({ id: "prop-b", city: PORTFOLIO_IMPORT_UNKNOWN_CITY }),
      ],
      [],
    );
    const queue = flattenHealthCleanupPropertyQueue(rows);

    assert.equal(selectNextPropertyInCleanupQueue(queue, "prop-a")?.propertyId, "prop-b");
    assert.equal(selectNextPropertyInCleanupQueue(queue, "prop-b"), null);
    // Already fixed and no longer in the queue: restart from the front rather than dead-end.
    assert.equal(selectNextPropertyInCleanupQueue(queue, "prop-gone")?.propertyId, "prop-a");
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
