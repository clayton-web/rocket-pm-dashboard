import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assessPortfolioHealthProperty,
  assessPortfolioHealthUnitSlot,
  PORTFOLIO_HEALTH_MISSING_LABELS,
  type PortfolioHealthMissingItemKey,
  type PortfolioHealthPropertyInput,
  type PortfolioHealthUnitInput,
} from "@/lib/property/portfolio-health";
import {
  comparePortfolioHealthRows,
  countPortfolioHealthIssueTiers,
  orderPortfolioHealthIssueKeys,
  parsePortfolioHealthSort,
  PORTFOLIO_HEALTH_DEFAULT_SORT,
  PORTFOLIO_HEALTH_ISSUE_TIERS,
  portfolioHealthAttentionStatusFromKeys,
  portfolioHealthIssueTier,
  rankPortfolioHealthRows,
  resolvePortfolioHealthAttentionStatus,
  sortPortfolioHealthRows,
} from "@/lib/property/portfolio-health-ranking";

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

function vacantUnit(unitId = "unit-1", unitLabel = "Entire Property"): PortfolioHealthUnitInput {
  return { unitId, unitLabel, tenancy: null, contacts: [] };
}

/** Healthy baseline: no issues in any tier. */
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
    units: [occupiedUnit()],
    ...overrides,
  };
}

describe("portfolio health issue tiers", () => {
  it("assigns every known issue key to a tier", () => {
    const labelled = Object.keys(PORTFOLIO_HEALTH_MISSING_LABELS) as PortfolioHealthMissingItemKey[];
    const tiered = Object.keys(PORTFOLIO_HEALTH_ISSUE_TIERS) as PortfolioHealthMissingItemKey[];

    assert.deepEqual([...tiered].sort(), [...labelled].sort());
    for (const key of labelled) {
      assert.ok(
        ["blocking", "operational", "optional"].includes(portfolioHealthIssueTier(key)),
        `${key} has no tier`,
      );
    }
  });

  it("treats missing city and postal code as blocking", () => {
    assert.equal(portfolioHealthIssueTier("missing_city"), "blocking");
    assert.equal(portfolioHealthIssueTier("missing_postal_code"), "blocking");
  });

  it("treats missing documents as operational, not blocking", () => {
    assert.equal(portfolioHealthIssueTier("documents"), "operational");
  });

  it("treats strata notes as optional", () => {
    assert.equal(portfolioHealthIssueTier("strata_notes"), "optional");
  });

  it("classifies the remaining blocking and operational keys as approved", () => {
    for (const key of [
      "property_address",
      "monthly_rent_zero",
      "lease_start_date",
      "move_in_date",
      "tenant_name",
      "tenant_email",
    ] as const) {
      assert.equal(portfolioHealthIssueTier(key), "blocking", key);
    }
    for (const key of [
      "owner_contact",
      "tenant_phone",
      "import_placeholder_dates",
      "security_deposit_zero",
    ] as const) {
      assert.equal(portfolioHealthIssueTier(key), "operational", key);
    }
  });

  it("counts repeated per-unit issues once per occurrence", () => {
    const counts = countPortfolioHealthIssueTiers([
      "monthly_rent_zero",
      "monthly_rent_zero",
      "documents",
      "strata_notes",
    ]);
    assert.deepEqual(counts, { blocking: 2, operational: 1, optional: 1 });
  });

  it("retires the never-emitted active_tenancy key", () => {
    assert.equal(Object.hasOwn(PORTFOLIO_HEALTH_MISSING_LABELS, "active_tenancy"), false);
    assert.equal(Object.hasOwn(PORTFOLIO_HEALTH_ISSUE_TIERS, "active_tenancy"), false);
  });
});

describe("attention status", () => {
  it("reports needs_attention for any blocking issue", () => {
    assert.equal(
      resolvePortfolioHealthAttentionStatus({ blocking: 1, operational: 0, optional: 0 }),
      "needs_attention",
    );
    assert.equal(
      resolvePortfolioHealthAttentionStatus({ blocking: 1, operational: 9, optional: 9 }),
      "needs_attention",
    );
  });

  it("reports minor when only operational issues remain", () => {
    assert.equal(
      resolvePortfolioHealthAttentionStatus({ blocking: 0, operational: 1, optional: 0 }),
      "minor",
    );
  });

  it("reports clear when only optional issues remain", () => {
    assert.equal(
      resolvePortfolioHealthAttentionStatus({ blocking: 0, operational: 0, optional: 3 }),
      "clear",
    );
    assert.equal(portfolioHealthAttentionStatusFromKeys(["strata_notes"]), "clear");
  });

  it("reports clear when there are no issues at all", () => {
    assert.equal(portfolioHealthAttentionStatusFromKeys([]), "clear");
  });
});

describe("attention status on assessed rows", () => {
  it("marks a blocking property-level issue as needs_attention", () => {
    const row = assessPortfolioHealthProperty(baseProperty({ postalCode: "TBD 0T0" }));
    assert.ok(row.missingItemKeys.includes("missing_postal_code"));
    assert.equal(row.attentionStatus, "needs_attention");
    assert.equal(row.overallStatus, "needs_review");
  });

  it("marks a documents-only gap as minor rather than needs_attention", () => {
    const row = assessPortfolioHealthProperty(baseProperty({ documentCount: 0 }));
    assert.deepEqual(row.missingItemKeys, ["documents"]);
    assert.equal(row.attentionStatus, "minor");
  });

  it("marks a strata-notes-only gap as clear", () => {
    const row = assessPortfolioHealthProperty(baseProperty({ strataNotes: null }));
    assert.deepEqual(row.missingItemKeys, ["strata_notes"]);
    assert.equal(row.attentionStatus, "clear");
    assert.equal(row.overallStatus, "complete");
  });

  it("derives overallStatus from attentionStatus alone", () => {
    for (const property of [
      baseProperty(),
      baseProperty({ documentCount: 0 }),
      baseProperty({ postalCode: "TBD 0T0" }),
      baseProperty({ strataNotes: null }),
    ]) {
      const row = assessPortfolioHealthProperty(property);
      assert.equal(
        row.overallStatus,
        row.attentionStatus === "clear" ? "complete" : "needs_review",
      );
    }
  });
});

describe("occupied and vacant unit issues", () => {
  it("raises blocking tenant issues for an occupied unit", () => {
    const row = assessPortfolioHealthProperty(
      baseProperty({
        units: [
          occupiedUnit({
            tenancy: {
              id: "tenancy-1",
              unitId: "unit-1",
              status: "active",
              leaseStartDate: null,
              moveInDate: null,
              monthlyRent: 0,
              securityDeposit: 1200,
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
            },
          }),
        ],
      }),
    );

    assert.equal(row.attentionStatus, "needs_attention");
    assert.deepEqual(countPortfolioHealthIssueTiers(row.missingItemKeys), {
      blocking: 3,
      operational: 0,
      optional: 0,
    });
  });

  it("manufactures no tenant issues for a vacant unit", () => {
    const slot = assessPortfolioHealthUnitSlot(vacantUnit());
    assert.equal(slot.isVacant, true);
    assert.deepEqual(slot.tenantDataFlags, []);

    const row = assessPortfolioHealthProperty(baseProperty({ units: [vacantUnit()] }));
    assert.equal(row.isVacant, true);
    assert.deepEqual(row.missingItemKeys, []);
    assert.equal(row.attentionStatus, "clear");
  });

  it("reports occupancy counts alongside the health assessment", () => {
    const row = assessPortfolioHealthProperty(
      baseProperty({
        units: [occupiedUnit({ unitId: "u1", unitLabel: "Upper" }), vacantUnit("u2", "Lower")],
      }),
    );
    assert.equal(row.unitCount, 2);
    assert.equal(row.occupiedUnitCount, 1);
    assert.equal(row.vacantUnitCount, 1);
    assert.equal(row.isVacant, false);
  });
});

type RankRow = {
  propertyId: string;
  propertyLabel: string;
  missingItemKeys: PortfolioHealthMissingItemKey[];
};

function rankRow(
  propertyId: string,
  propertyLabel: string,
  missingItemKeys: PortfolioHealthMissingItemKey[],
): RankRow {
  return { propertyId, propertyLabel, missingItemKeys };
}

describe("default ranking", () => {
  it("puts blocking properties ahead of operational-only properties", () => {
    const blocking = rankRow("a", "999 Zulu St", ["missing_city"]);
    const operational = rankRow("b", "111 Alpha St", ["documents", "owner_contact"]);

    assert.deepEqual(
      rankPortfolioHealthRows([operational, blocking]).map((row) => row.propertyId),
      ["a", "b"],
    );
  });

  it("sorts a greater blocking count first", () => {
    const two = rankRow("two", "500 Mid St", ["missing_city", "tenant_email"]);
    const one = rankRow("one", "100 Early St", ["missing_city"]);

    assert.deepEqual(
      rankPortfolioHealthRows([one, two]).map((row) => row.propertyId),
      ["two", "one"],
    );
  });

  it("breaks equal blocking counts on operational count", () => {
    const moreOps = rankRow("ops", "500 Mid St", ["missing_city", "documents", "tenant_phone"]);
    const fewerOps = rankRow("plain", "100 Early St", ["missing_city"]);

    assert.deepEqual(
      rankPortfolioHealthRows([fewerOps, moreOps]).map((row) => row.propertyId),
      ["ops", "plain"],
    );
  });

  it("falls back to ascending address for equal severity", () => {
    const rows = [
      rankRow("c", "900 Cedar St", ["documents"]),
      rankRow("a", "100 Alder St", ["documents"]),
      rankRow("b", "400 Birch St", ["documents"]),
    ];
    assert.deepEqual(
      rankPortfolioHealthRows(rows).map((row) => row.propertyId),
      ["a", "b", "c"],
    );
  });

  it("orders street numbers numerically rather than lexically", () => {
    const rows = [
      rankRow("high", "1000 Main St", []),
      rankRow("low", "90 Main St", []),
    ];
    assert.deepEqual(
      rankPortfolioHealthRows(rows).map((row) => row.propertyId),
      ["low", "high"],
    );
  });

  it("stays deterministic when address and severity are identical", () => {
    const rows = [
      rankRow("zzz", "100 Same St", ["documents"]),
      rankRow("aaa", "100 Same St", ["documents"]),
    ];
    assert.deepEqual(
      rankPortfolioHealthRows(rows).map((row) => row.propertyId),
      ["aaa", "zzz"],
    );
    assert.equal(comparePortfolioHealthRows(rows[0]!, rows[0]!), 0);
  });

  it("applies no ranking penalty or boost for vacancy", () => {
    const vacantRow = assessPortfolioHealthProperty(
      baseProperty({ id: "vacant", streetLine1: "200 Beta St", units: [vacantUnit()] }),
    );
    const occupiedRow = assessPortfolioHealthProperty(
      baseProperty({ id: "occupied", streetLine1: "100 Alpha St", units: [occupiedUnit()] }),
    );

    // Same severity (both clear), so ordering is address-only — vacancy is not a factor.
    assert.deepEqual(
      rankPortfolioHealthRows([vacantRow, occupiedRow]).map((row) => row.propertyId),
      ["occupied", "vacant"],
    );

    const vacantWithBlocking = assessPortfolioHealthProperty(
      baseProperty({
        id: "vacant-blocking",
        streetLine1: "900 Omega St",
        postalCode: "TBD 0T0",
        units: [vacantUnit()],
      }),
    );
    assert.deepEqual(
      rankPortfolioHealthRows([occupiedRow, vacantWithBlocking]).map((row) => row.propertyId),
      ["vacant-blocking", "occupied"],
    );
  });

  it("does not mutate the input array", () => {
    const rows = [rankRow("b", "900 Cedar St", []), rankRow("a", "100 Alder St", [])];
    const ranked = rankPortfolioHealthRows(rows);
    assert.deepEqual(rows.map((row) => row.propertyId), ["b", "a"]);
    assert.notEqual(ranked, rows);
  });
});

describe("issue display ordering", () => {
  it("puts blocking issues before operational before optional", () => {
    assert.deepEqual(
      orderPortfolioHealthIssueKeys(["strata_notes", "documents", "tenant_email"]),
      ["tenant_email", "documents", "strata_notes"],
    );
  });

  it("collapses repeats so a duplex does not show the same chip twice", () => {
    assert.deepEqual(
      orderPortfolioHealthIssueKeys(["monthly_rent_zero", "monthly_rent_zero", "tenant_name"]),
      ["tenant_name", "monthly_rent_zero"],
    );
  });

  it("is deterministic for issues of equal severity", () => {
    const forwards = orderPortfolioHealthIssueKeys(["missing_city", "tenant_email", "tenant_name"]);
    const backwards = orderPortfolioHealthIssueKeys(["tenant_name", "tenant_email", "missing_city"]);
    assert.deepEqual(forwards, backwards);
  });

  it("returns nothing for a clear property", () => {
    assert.deepEqual(orderPortfolioHealthIssueKeys([]), []);
  });

  it("does not mutate its input", () => {
    const keys: PortfolioHealthMissingItemKey[] = ["strata_notes", "tenant_email"];
    orderPortfolioHealthIssueKeys(keys);
    assert.deepEqual(keys, ["strata_notes", "tenant_email"]);
  });
});

describe("alternate sorts", () => {
  const sortRow = (
    propertyId: string,
    propertyLabel: string,
    updatedAt: string | null,
    missingItemKeys: PortfolioHealthMissingItemKey[] = [],
  ) => ({ propertyId, propertyLabel, missingItemKeys, updatedAt });

  const rows = [
    sortRow("b", "200 Bravo St", "2026-08-01T00:00:00.000Z", ["missing_city"]),
    sortRow("a", "100 Alpha St", "2026-06-01T00:00:00.000Z"),
    sortRow("c", "300 Charlie St", null),
  ];

  it("falls back to health priority for the default sort", () => {
    assert.deepEqual(
      sortPortfolioHealthRows(rows).map((row) => row.propertyId),
      rankPortfolioHealthRows(rows).map((row) => row.propertyId),
    );
  });

  it("sorts addresses naturally rather than lexically", () => {
    const numbered = [
      sortRow("x", "20 Main St", null),
      sortRow("y", "3 Main St", null),
      sortRow("z", "100 Main St", null),
    ];
    assert.deepEqual(
      sortPortfolioHealthRows(numbered, "address").map((row) => row.propertyId),
      ["y", "x", "z"],
    );
  });

  it("ignores health when sorting by address", () => {
    assert.deepEqual(
      sortPortfolioHealthRows(rows, "address").map((row) => row.propertyId),
      ["a", "b", "c"],
    );
  });

  it("sorts newest first and pushes undated rows to the end", () => {
    assert.deepEqual(
      sortPortfolioHealthRows(rows, "updated").map((row) => row.propertyId),
      ["b", "a", "c"],
    );
  });

  it("breaks equal timestamps by address", () => {
    const sameDay = [
      sortRow("later", "900 Zulu St", "2026-08-01T00:00:00.000Z"),
      sortRow("earlier", "100 Alpha St", "2026-08-01T00:00:00.000Z"),
    ];
    assert.deepEqual(
      sortPortfolioHealthRows(sameDay, "updated").map((row) => row.propertyId),
      ["earlier", "later"],
    );
  });

  it("treats an unparseable timestamp as undated rather than throwing", () => {
    const withGarbage = [sortRow("bad", "500 Mid St", "not-a-date"), rows[0]!];
    assert.deepEqual(
      sortPortfolioHealthRows(withGarbage, "updated").map((row) => row.propertyId),
      ["b", "bad"],
    );
  });

  it("never mutates the input", () => {
    const input = [...rows];
    sortPortfolioHealthRows(input, "address");
    assert.deepEqual(input.map((row) => row.propertyId), ["b", "a", "c"]);
  });
});

describe("sort URL parsing", () => {
  it("accepts the known sorts and falls back to the approved default", () => {
    assert.equal(parsePortfolioHealthSort("address"), "address");
    assert.equal(parsePortfolioHealthSort("UPDATED"), "updated");
    assert.equal(parsePortfolioHealthSort("nonsense"), PORTFOLIO_HEALTH_DEFAULT_SORT);
    assert.equal(parsePortfolioHealthSort(null), "health");
  });
});
