import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assessPortfolioHealthProperty,
  type PortfolioHealthPropertyInput,
  type PortfolioHealthUnitInput,
} from "@/lib/property/portfolio-health";
import {
  buildPortfolioHealthView,
  parsePortfolioHealthStatusFilter,
} from "@/lib/property/portfolio-health-view";

function occupiedUnit(overrides: {
  unitId: string;
  unitLabel: string;
  tenantFirstName?: string;
  tenantLastName?: string;
  tenantEmail?: string;
  tenantPhone?: string | null;
}): PortfolioHealthUnitInput {
  return {
    unitId: overrides.unitId,
    unitLabel: overrides.unitLabel,
    tenancy: {
      id: `tenancy-${overrides.unitId}`,
      unitId: overrides.unitId,
      status: "active",
      leaseStartDate: new Date("2026-01-01T12:00:00.000Z"),
      moveInDate: new Date("2026-01-01T12:00:00.000Z"),
      monthlyRent: 2400,
      securityDeposit: 1200,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    contacts: [
      {
        contactType: "tenant",
        firstName: overrides.tenantFirstName ?? "Taylor",
        lastName: overrides.tenantLastName ?? "Applicant",
        email: overrides.tenantEmail ?? "tenant@example.com",
        phone: overrides.tenantPhone === undefined ? "604-555-0200" : overrides.tenantPhone,
      },
    ],
  };
}

function property(
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
    units: [occupiedUnit({ unitId: "u1", unitLabel: "Entire Property" })],
    ...overrides,
  };
}

const blockingRow = assessPortfolioHealthProperty(
  property({ id: "blocking", streetLine1: "900 Zulu St", postalCode: "TBD 0T0" }),
);
const operationalRow = assessPortfolioHealthProperty(
  property({ id: "operational", streetLine1: "100 Alpha St", documentCount: 0 }),
);
const clearRow = assessPortfolioHealthProperty(
  property({ id: "clear", streetLine1: "500 Mid St", city: "Burnaby", postalCode: "V5H 2K3" }),
);

describe("buildPortfolioHealthView", () => {
  it("ranks rows by default with no filters or search", () => {
    const view = buildPortfolioHealthView({
      rows: [clearRow, operationalRow, blockingRow],
      filters: [],
      query: "",
    });

    assert.deepEqual(view.rows.map((row) => row.propertyId), [
      "blocking",
      "operational",
      "clear",
    ]);
    assert.equal(view.sourceCount, 3);
  });

  it("applies filters, then search, then ranking", () => {
    const view = buildPortfolioHealthView({
      rows: [clearRow, operationalRow, blockingRow],
      filters: ["documents"],
      query: "alpha",
    });

    assert.deepEqual(view.rows.map((row) => row.propertyId), ["operational"]);
  });

  it("returns nothing when the filter and search disagree", () => {
    const view = buildPortfolioHealthView({
      rows: [clearRow, operationalRow, blockingRow],
      filters: ["documents"],
      query: "zulu",
    });

    assert.deepEqual(view.rows, []);
    assert.equal(view.sourceCount, 3);
  });

  it("preserves the filter issue-chip narrowing through search and ranking", () => {
    const view = buildPortfolioHealthView({
      rows: [operationalRow],
      filters: ["documents"],
      query: "alpha",
    });

    const row = view.rows[0]!;
    assert.deepEqual(row.visiblePropertyMissingItemKeys, ["documents"]);
    assert.ok("visibleUnitSlots" in row);
  });

  it("searches only the units the filters left visible", () => {
    // Upper is missing a tenant phone; Lower is complete. A tenant filter hides Lower, so
    // searching Lower's tenant name must not resurrect the property.
    const duplex = assessPortfolioHealthProperty(
      property({
        id: "duplex",
        streetLine1: "831 W 24th Ave",
        units: [
          occupiedUnit({
            unitId: "upper",
            unitLabel: "Upper",
            tenantFirstName: "Alex",
            tenantLastName: "Upper",
            tenantPhone: null,
          }),
          occupiedUnit({
            unitId: "lower",
            unitLabel: "Lower",
            tenantFirstName: "Jordan",
            tenantLastName: "Lower",
          }),
        ],
      }),
    );

    const unfiltered = buildPortfolioHealthView({
      rows: [duplex],
      filters: [],
      query: "Jordan",
    });
    assert.equal(unfiltered.rows.length, 1);

    const filtered = buildPortfolioHealthView({
      rows: [duplex],
      filters: ["tenant_phone"],
      query: "Jordan",
    });
    assert.deepEqual(
      filtered.rows.map((row) => row.propertyId),
      [],
      "Lower is hidden by the tenant_phone filter, so its tenant name must not match",
    );

    const filteredOnVisible = buildPortfolioHealthView({
      rows: [duplex],
      filters: ["tenant_phone"],
      query: "Alex",
    });
    assert.deepEqual(filteredOnVisible.rows.map((row) => row.propertyId), ["duplex"]);
  });

  it("normalizes and reports the active filters it applied", () => {
    const view = buildPortfolioHealthView({
      rows: [operationalRow],
      filters: ["documents", "documents"],
      query: "",
    });
    assert.deepEqual(view.activeFilters, ["documents"]);
  });

  it("does not mutate the source rows", () => {
    const rows = [clearRow, operationalRow, blockingRow];
    buildPortfolioHealthView({ rows, filters: [], query: "" });
    assert.deepEqual(rows.map((row) => row.propertyId), [
      "clear",
      "operational",
      "blocking",
    ]);
  });
});

describe("portfolio health status filter", () => {
  const rows = [clearRow, operationalRow, blockingRow];

  it("defaults to every row", () => {
    assert.equal(buildPortfolioHealthView({ rows, filters: [], query: "" }).rows.length, 3);
    assert.equal(
      buildPortfolioHealthView({ rows, filters: [], query: "", status: "all" }).rows.length,
      3,
    );
  });

  it("narrows to a single attention status", () => {
    for (const [status, expected] of [
      ["needs_attention", "blocking"],
      ["minor", "operational"],
      ["clear", "clear"],
    ] as const) {
      const view = buildPortfolioHealthView({ rows, filters: [], query: "", status });
      assert.deepEqual(view.rows.map((row) => row.propertyId), [expected]);
    }
  });

  it("combines with cleanup filters and search", () => {
    assert.deepEqual(
      buildPortfolioHealthView({
        rows,
        filters: ["documents"],
        query: "alpha",
        status: "minor",
      }).rows.map((row) => row.propertyId),
      ["operational"],
    );

    // The same row, asked for under the wrong status, must disappear.
    assert.deepEqual(
      buildPortfolioHealthView({
        rows,
        filters: ["documents"],
        query: "alpha",
        status: "needs_attention",
      }).rows,
      [],
    );
  });

  it("reports the full source count regardless of the status filter", () => {
    const view = buildPortfolioHealthView({ rows, filters: [], query: "", status: "clear" });
    assert.equal(view.sourceCount, 3);
  });

  it("parses only known values from the URL", () => {
    assert.equal(parsePortfolioHealthStatusFilter("needs_attention"), "needs_attention");
    assert.equal(parsePortfolioHealthStatusFilter("MINOR"), "minor");
    assert.equal(parsePortfolioHealthStatusFilter("nonsense"), "all");
    assert.equal(parsePortfolioHealthStatusFilter(null), "all");
  });
});

describe("portfolio health ordering through the view", () => {
  const dated = (id: string, street: string, updatedAt: Date | null) =>
    assessPortfolioHealthProperty(
      property({ id, streetLine1: street, updatedAt, city: "Burnaby", postalCode: "V5H 2K3" }),
    );

  const rows = [
    dated("b", "200 Bravo St", new Date("2026-08-01T00:00:00.000Z")),
    dated("a", "100 Alpha St", new Date("2026-06-01T00:00:00.000Z")),
    dated("c", "300 Charlie St", null),
  ];

  it("keeps health priority as the default order", () => {
    const view = buildPortfolioHealthView({ rows: [clearRow, blockingRow], filters: [], query: "" });
    assert.deepEqual(view.rows.map((row) => row.propertyId), ["blocking", "clear"]);
  });

  it("sorts by address when asked", () => {
    const view = buildPortfolioHealthView({ rows, filters: [], query: "", sort: "address" });
    assert.deepEqual(view.rows.map((row) => row.propertyId), ["a", "b", "c"]);
  });

  it("sorts by most recently updated, with undated rows last", () => {
    const view = buildPortfolioHealthView({ rows, filters: [], query: "", sort: "updated" });
    assert.deepEqual(view.rows.map((row) => row.propertyId), ["b", "a", "c"]);
  });

  it("still applies filters and search under an alternate sort", () => {
    const view = buildPortfolioHealthView({
      rows,
      filters: [],
      query: "alpha",
      sort: "address",
    });
    assert.deepEqual(view.rows.map((row) => row.propertyId), ["a"]);
  });
});
