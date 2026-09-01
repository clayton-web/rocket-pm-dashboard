import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PORTFOLIO_HEALTH_SNAPSHOT_LABELS,
  type PortfolioHealthIssueSnapshot,
} from "@/lib/property/portfolio-health";
import {
  PORTFOLIO_HEALTH_CLEANUP_FILTER_LABELS,
  PORTFOLIO_HEALTH_PROPERTY_CLEANUP_FILTERS,
  PORTFOLIO_HEALTH_TENANT_CLEANUP_FILTERS,
} from "@/lib/property/portfolio-health-cleanup-filters";
import {
  buildPortfolioHealthFilterShortcuts,
  portfolioHealthFilterTier,
  portfolioHealthSnapshotCount,
} from "@/lib/property/portfolio-health-filter-shortcuts";

function snapshot(
  overrides: {
    property?: Partial<PortfolioHealthIssueSnapshot["propertyIssues"]>;
    tenant?: Partial<PortfolioHealthIssueSnapshot["tenantIssues"]>;
  } = {},
): PortfolioHealthIssueSnapshot {
  return {
    propertyIssues: {
      missingDocuments: 0,
      missingPostalCode: 0,
      missingCity: 0,
      missingOwnerContact: 0,
      ...overrides.property,
    },
    tenantIssues: {
      missingTenantName: 0,
      missingTenantEmail: 0,
      missingTenantPhone: 0,
      missingLeaseDates: 0,
      placeholderLeaseDates: 0,
      rentZero: 0,
      depositZero: 0,
      ...overrides.tenant,
    },
  };
}

describe("snapshot to cleanup-filter mapping", () => {
  it("covers every cleanup filter", () => {
    const allFilters = [
      ...PORTFOLIO_HEALTH_TENANT_CLEANUP_FILTERS,
      ...PORTFOLIO_HEALTH_PROPERTY_CLEANUP_FILTERS,
    ];
    for (const filter of allFilters) {
      assert.equal(
        typeof portfolioHealthSnapshotCount(snapshot(), filter),
        "number",
        `${filter} has no snapshot count`,
      );
    }
  });

  /**
   * The strip's whole premise is that the snapshot and the filters describe the same issues.
   * If someone adds a snapshot metric with no filter, this fails rather than silently shipping
   * a count nobody can act on.
   */
  it("labels every shortcut with the existing filter wording, matching the snapshot wording", () => {
    const filterLabels = new Set(Object.values(PORTFOLIO_HEALTH_CLEANUP_FILTER_LABELS));
    for (const { label } of PORTFOLIO_HEALTH_SNAPSHOT_LABELS) {
      assert.ok(filterLabels.has(label), `snapshot label "${label}" has no matching filter`);
    }
  });

  it("reads each count from the right corner of the snapshot", () => {
    const s = snapshot({ property: { missingDocuments: 4 }, tenant: { rentZero: 7 } });
    assert.equal(portfolioHealthSnapshotCount(s, "documents"), 4);
    assert.equal(portfolioHealthSnapshotCount(s, "rent_zero"), 7);
    assert.equal(portfolioHealthSnapshotCount(s, "tenant_name"), 0);
  });

  it("carries the severity of the underlying issue", () => {
    assert.equal(portfolioHealthFilterTier("tenant_email"), "blocking");
    assert.equal(portfolioHealthFilterTier("lease_dates"), "blocking");
    assert.equal(portfolioHealthFilterTier("documents"), "operational");
    assert.equal(portfolioHealthFilterTier("tenant_phone"), "operational");
  });
});

describe("buildPortfolioHealthFilterShortcuts", () => {
  it("omits issues with no open work", () => {
    assert.deepEqual(buildPortfolioHealthFilterShortcuts(snapshot()), []);
  });

  it("orders by largest pile first", () => {
    const shortcuts = buildPortfolioHealthFilterShortcuts(
      snapshot({
        property: { missingDocuments: 9 },
        tenant: { missingTenantPhone: 3, rentZero: 12 },
      }),
    );
    assert.deepEqual(
      shortcuts.map((shortcut) => [shortcut.filter, shortcut.count]),
      [
        ["rent_zero", 12],
        ["documents", 9],
        ["tenant_phone", 3],
      ],
    );
  });

  it("breaks count ties by severity so blocking work is offered first", () => {
    const shortcuts = buildPortfolioHealthFilterShortcuts(
      snapshot({ property: { missingDocuments: 5 }, tenant: { missingTenantEmail: 5 } }),
    );
    assert.deepEqual(shortcuts.map((shortcut) => shortcut.filter), ["tenant_email", "documents"]);
  });

  it("uses the existing filter label so wording is never duplicated", () => {
    const [shortcut] = buildPortfolioHealthFilterShortcuts(
      snapshot({ property: { missingOwnerContact: 1 } }),
    );
    assert.equal(shortcut?.label, PORTFOLIO_HEALTH_CLEANUP_FILTER_LABELS.owner_contact);
  });
});
