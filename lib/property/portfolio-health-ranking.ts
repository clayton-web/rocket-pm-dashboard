import type {
  PortfolioHealthMissingItemKey,
  PortfolioHealthRow,
} from "@/lib/property/portfolio-health";

/**
 * Severity model for Property Health.
 *
 * `blocking` issues make a property require primary attention. `operational` issues are real
 * work but do not gate the primary status. `optional` issues never affect the primary status.
 *
 * Deliberately not a weighted or percentage score: staff need to know *which* field is wrong,
 * and a tiered count is explainable in the UI ("2 blocking, 1 operational") in a way a
 * normalized score is not.
 */
export type PortfolioHealthIssueTier = "blocking" | "operational" | "optional";

export type PortfolioHealthAttentionStatus = "needs_attention" | "minor" | "clear";

export type PortfolioHealthIssueTierCounts = {
  blocking: number;
  operational: number;
  optional: number;
};

/**
 * Exhaustive by construction: adding a `PortfolioHealthMissingItemKey` without assigning a tier
 * is a type error, which is the guarantee this table exists to provide.
 *
 * Unit-level keys only ever reach this map for occupied units — `assessPortfolioHealthUnitSlot`
 * emits no tenant flags for a vacant unit — so vacant properties cannot accrue tenant issues.
 */
export const PORTFOLIO_HEALTH_ISSUE_TIERS: Record<
  PortfolioHealthMissingItemKey,
  PortfolioHealthIssueTier
> = {
  property_address: "blocking",
  missing_city: "blocking",
  missing_postal_code: "blocking",
  tenant_name: "blocking",
  tenant_email: "blocking",
  lease_start_date: "blocking",
  move_in_date: "blocking",
  monthly_rent_zero: "blocking",

  owner_contact: "operational",
  tenant_phone: "operational",
  security_deposit_zero: "operational",
  import_placeholder_dates: "operational",
  documents: "operational",

  strata_notes: "optional",
};

export function portfolioHealthIssueTier(
  key: PortfolioHealthMissingItemKey,
): PortfolioHealthIssueTier {
  return PORTFOLIO_HEALTH_ISSUE_TIERS[key];
}

/**
 * Counts occurrences rather than distinct keys: a duplex with two suites at $0 rent is twice
 * the work of a single suite, and the default ranking should reflect that.
 */
export function countPortfolioHealthIssueTiers(
  keys: readonly PortfolioHealthMissingItemKey[],
): PortfolioHealthIssueTierCounts {
  const counts: PortfolioHealthIssueTierCounts = { blocking: 0, operational: 0, optional: 0 };
  for (const key of keys) {
    counts[portfolioHealthIssueTier(key)] += 1;
  }
  return counts;
}

export function resolvePortfolioHealthAttentionStatus(
  counts: PortfolioHealthIssueTierCounts,
): PortfolioHealthAttentionStatus {
  if (counts.blocking > 0) return "needs_attention";
  if (counts.operational > 0) return "minor";
  return "clear";
}

export function portfolioHealthAttentionStatusFromKeys(
  keys: readonly PortfolioHealthMissingItemKey[],
): PortfolioHealthAttentionStatus {
  return resolvePortfolioHealthAttentionStatus(countPortfolioHealthIssueTiers(keys));
}

export const PORTFOLIO_HEALTH_ATTENTION_STATUS_LABELS: Record<
  PortfolioHealthAttentionStatus,
  string
> = {
  needs_attention: "Needs attention",
  minor: "Minor issues",
  clear: "Clear",
};

const TIER_RANK: Record<PortfolioHealthIssueTier, number> = {
  blocking: 0,
  operational: 1,
  optional: 2,
};

/**
 * Declaration order of `PORTFOLIO_HEALTH_ISSUE_TIERS`, used as the within-tier tiebreaker so
 * issue chips never reorder between renders for two issues of equal severity.
 */
const KEY_ORDER = new Map<PortfolioHealthMissingItemKey, number>(
  (Object.keys(PORTFOLIO_HEALTH_ISSUE_TIERS) as PortfolioHealthMissingItemKey[]).map(
    (key, index) => [key, index],
  ),
);

/**
 * Severity-first, deterministic ordering for *display*, de-duplicated.
 *
 * Ranking counts every occurrence (a duplex with two $0 rents outranks one), but a chip list
 * repeating "Monthly rent is still $0" three times is noise rather than information, so the
 * display collapses to distinct issues.
 */
export function orderPortfolioHealthIssueKeys(
  keys: readonly PortfolioHealthMissingItemKey[],
): PortfolioHealthMissingItemKey[] {
  return [...new Set(keys)].sort((a, b) => {
    const byTier = TIER_RANK[portfolioHealthIssueTier(a)] - TIER_RANK[portfolioHealthIssueTier(b)];
    if (byTier !== 0) return byTier;
    return (KEY_ORDER.get(a) ?? 0) - (KEY_ORDER.get(b) ?? 0);
  });
}

type RankableRow = Pick<PortfolioHealthRow, "propertyId" | "propertyLabel" | "missingItemKeys">;

export function portfolioHealthRowTierCounts(row: RankableRow): PortfolioHealthIssueTierCounts {
  return countPortfolioHealthIssueTiers(row.missingItemKeys);
}

function compareAddress(a: RankableRow, b: RankableRow): number {
  const byLabel = a.propertyLabel.localeCompare(b.propertyLabel, "en", {
    numeric: true,
    sensitivity: "base",
  });
  if (byLabel !== 0) return byLabel;
  // Guarantees a total order so equal addresses never reorder between renders.
  return a.propertyId.localeCompare(b.propertyId);
}

/**
 * Approved default ordering:
 *   1. properties with blocking issues before those without
 *   2. blocking count descending
 *   3. operational count descending
 *   4. address ascending (stable final tiebreaker)
 *
 * Vacancy is deliberately not a factor — vacant properties rank by exactly these rules.
 */
export function comparePortfolioHealthRows(a: RankableRow, b: RankableRow): number {
  const aCounts = portfolioHealthRowTierCounts(a);
  const bCounts = portfolioHealthRowTierCounts(b);

  const aBlocked = aCounts.blocking > 0 ? 1 : 0;
  const bBlocked = bCounts.blocking > 0 ? 1 : 0;
  if (aBlocked !== bBlocked) return bBlocked - aBlocked;

  if (aCounts.blocking !== bCounts.blocking) return bCounts.blocking - aCounts.blocking;
  if (aCounts.operational !== bCounts.operational) {
    return bCounts.operational - aCounts.operational;
  }

  return compareAddress(a, b);
}

/** Returns a new array; never mutates the caller's rows. */
export function rankPortfolioHealthRows<T extends RankableRow>(rows: readonly T[]): T[] {
  return [...rows].sort(comparePortfolioHealthRows);
}

/**
 * The three orders a triage user actually asks for. Deliberately not a sort builder: every
 * option here answers a question staff already ask ("what is worst", "find this street",
 * "what changed"), and `health` stays the approved default.
 */
export type PortfolioHealthSort = "health" | "address" | "updated";

export const PORTFOLIO_HEALTH_DEFAULT_SORT: PortfolioHealthSort = "health";

export const PORTFOLIO_HEALTH_SORT_LABELS: Record<PortfolioHealthSort, string> = {
  health: "Most attention first",
  address: "Address A–Z",
  updated: "Recently updated",
};

export const PORTFOLIO_HEALTH_SORTS: PortfolioHealthSort[] = ["health", "address", "updated"];

export function parsePortfolioHealthSort(value: string | null | undefined): PortfolioHealthSort {
  const candidate = value?.trim().toLowerCase();
  return PORTFOLIO_HEALTH_SORTS.find((sort) => sort === candidate) ?? PORTFOLIO_HEALTH_DEFAULT_SORT;
}

type SortableRow = RankableRow & Pick<PortfolioHealthRow, "updatedAt">;

function updatedAtMillis(row: SortableRow): number | null {
  if (!row.updatedAt) return null;
  const parsed = Date.parse(row.updatedAt);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Rows the loader could not date sort last rather than first: an unknown timestamp is not
 * evidence of recent work, and floating them to the top would bury the rows staff came for.
 */
function compareUpdatedDescending(a: SortableRow, b: SortableRow): number {
  const aTime = updatedAtMillis(a);
  const bTime = updatedAtMillis(b);
  if (aTime === bTime) return compareAddress(a, b);
  if (aTime === null) return 1;
  if (bTime === null) return -1;
  return bTime - aTime;
}

export function sortPortfolioHealthRows<T extends SortableRow>(
  rows: readonly T[],
  sort: PortfolioHealthSort = PORTFOLIO_HEALTH_DEFAULT_SORT,
): T[] {
  switch (sort) {
    case "address":
      return [...rows].sort(compareAddress);
    case "updated":
      return [...rows].sort(compareUpdatedDescending);
    case "health":
    default:
      return rankPortfolioHealthRows(rows);
  }
}
