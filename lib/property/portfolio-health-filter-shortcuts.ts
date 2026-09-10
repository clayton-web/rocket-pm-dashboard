import type {
  PortfolioHealthIssueSnapshot,
  PortfolioHealthMissingItemKey,
} from "@/lib/property/portfolio-health";
import {
  PORTFOLIO_HEALTH_CLEANUP_FILTER_LABELS,
  type PortfolioHealthCleanupFilter,
} from "@/lib/property/portfolio-health-cleanup-filters";
import {
  portfolioHealthIssueTier,
  type PortfolioHealthIssueTier,
} from "@/lib/property/portfolio-health-ranking";

/**
 * The cleanup-queue snapshot and the cleanup filters were already the same eleven issues
 * described twice — `PORTFOLIO_HEALTH_SNAPSHOT_LABELS` and
 * `PORTFOLIO_HEALTH_CLEANUP_FILTER_LABELS` hold byte-identical strings in the same order.
 *
 * This module states that correspondence once so the summary strip can render a count *and*
 * apply the matching filter. It is a mapping over the existing filter system, not a second
 * one: every shortcut resolves to a `PortfolioHealthCleanupFilter` the existing toggle,
 * URL encoding and AND semantics already handle.
 */

/** Representative issue key per filter, used for severity treatment only. */
const FILTER_REPRESENTATIVE_KEY: Record<
  PortfolioHealthCleanupFilter,
  PortfolioHealthMissingItemKey
> = {
  tenant_name: "tenant_name",
  tenant_email: "tenant_email",
  tenant_phone: "tenant_phone",
  // A tenancy missing either date is blocking; the start date stands in for the pair.
  lease_dates: "lease_start_date",
  placeholder_dates: "import_placeholder_dates",
  rent_zero: "monthly_rent_zero",
  deposit_zero: "security_deposit_zero",
  documents: "documents",
  missing_postal_code: "missing_postal_code",
  missing_city: "missing_city",
  owner_contact: "owner_contact",
};

const SNAPSHOT_COUNTS: Record<
  PortfolioHealthCleanupFilter,
  (snapshot: PortfolioHealthIssueSnapshot) => number
> = {
  tenant_name: (s) => s.tenantIssues.missingTenantName,
  tenant_email: (s) => s.tenantIssues.missingTenantEmail,
  tenant_phone: (s) => s.tenantIssues.missingTenantPhone,
  lease_dates: (s) => s.tenantIssues.missingLeaseDates,
  placeholder_dates: (s) => s.tenantIssues.placeholderLeaseDates,
  rent_zero: (s) => s.tenantIssues.rentZero,
  deposit_zero: (s) => s.tenantIssues.depositZero,
  documents: (s) => s.propertyIssues.missingDocuments,
  missing_postal_code: (s) => s.propertyIssues.missingPostalCode,
  missing_city: (s) => s.propertyIssues.missingCity,
  owner_contact: (s) => s.propertyIssues.missingOwnerContact,
};

/** Declaration order of the mapping, used as the final deterministic tiebreaker. */
const FILTER_ORDER = new Map<PortfolioHealthCleanupFilter, number>(
  (Object.keys(SNAPSHOT_COUNTS) as PortfolioHealthCleanupFilter[]).map((filter, index) => [
    filter,
    index,
  ]),
);

const TIER_RANK: Record<PortfolioHealthIssueTier, number> = {
  blocking: 0,
  operational: 1,
  optional: 2,
};

export type PortfolioHealthFilterShortcut = {
  filter: PortfolioHealthCleanupFilter;
  label: string;
  count: number;
  tier: PortfolioHealthIssueTier;
};

export function portfolioHealthSnapshotCount(
  snapshot: PortfolioHealthIssueSnapshot,
  filter: PortfolioHealthCleanupFilter,
): number {
  return SNAPSHOT_COUNTS[filter](snapshot);
}

export function portfolioHealthFilterTier(
  filter: PortfolioHealthCleanupFilter,
): PortfolioHealthIssueTier {
  return portfolioHealthIssueTier(FILTER_REPRESENTATIVE_KEY[filter]);
}

/**
 * Ordered largest pile first, because the shortcut answers "where is the bulk of the work".
 * Ties fall back to severity and then declaration order so the strip never reshuffles.
 *
 * Zero-count issues are omitted: a shortcut that guarantees an empty result is not a shortcut.
 */
export function buildPortfolioHealthFilterShortcuts(
  snapshot: PortfolioHealthIssueSnapshot,
): PortfolioHealthFilterShortcut[] {
  return (Object.keys(SNAPSHOT_COUNTS) as PortfolioHealthCleanupFilter[])
    .map((filter) => ({
      filter,
      label: PORTFOLIO_HEALTH_CLEANUP_FILTER_LABELS[filter],
      count: portfolioHealthSnapshotCount(snapshot, filter),
      tier: portfolioHealthFilterTier(filter),
    }))
    .filter((shortcut) => shortcut.count > 0)
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      const byTier = TIER_RANK[a.tier] - TIER_RANK[b.tier];
      if (byTier !== 0) return byTier;
      return (FILTER_ORDER.get(a.filter) ?? 0) - (FILTER_ORDER.get(b.filter) ?? 0);
    });
}
