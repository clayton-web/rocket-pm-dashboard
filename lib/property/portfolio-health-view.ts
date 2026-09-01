import type { PortfolioHealthRow } from "@/lib/property/portfolio-health";
import {
  filterPortfolioHealthCleanupQueue,
  normalizeCleanupFilters,
  type PortfolioHealthCleanupFilter,
  type PortfolioHealthFilteredRow,
} from "@/lib/property/portfolio-health-cleanup-filters";
import {
  PORTFOLIO_HEALTH_ATTENTION_STATUS_LABELS,
  PORTFOLIO_HEALTH_DEFAULT_SORT,
  sortPortfolioHealthRows,
  type PortfolioHealthAttentionStatus,
  type PortfolioHealthSort,
} from "@/lib/property/portfolio-health-ranking";
import {
  matchesPortfolioHealthSearch,
  type PortfolioHealthSearchableRow,
} from "@/lib/property/portfolio-health-search";

/**
 * The single ordered pipeline behind the Property Health list:
 *
 *   source rows -> filters (status + cleanup) -> search -> ordering -> render
 *
 * Cleanup filters run first because they also compute the per-row `visible*` narrowing that
 * drives issue display; running search first would mean searching fields the filters were
 * about to hide. Search therefore matches against the units the filters left visible, so a
 * filtered view never returns a property whose only match is a hidden unit. Ordering runs
 * last so it orders exactly what will be rendered.
 *
 * The status filter joins the filter stage rather than forming a fourth one: `attentionStatus`
 * is derived from the property's full issue set, so it is independent of cleanup narrowing and
 * belongs with the other row-level predicates.
 */

/** Coarse triage filter over `attentionStatus`; `all` is the absence of a filter. */
export type PortfolioHealthStatusFilter = "all" | PortfolioHealthAttentionStatus;

export const PORTFOLIO_HEALTH_STATUS_FILTERS: PortfolioHealthStatusFilter[] = [
  "all",
  "needs_attention",
  "minor",
  "clear",
];

export const PORTFOLIO_HEALTH_STATUS_FILTER_LABELS: Record<PortfolioHealthStatusFilter, string> = {
  all: "All",
  ...PORTFOLIO_HEALTH_ATTENTION_STATUS_LABELS,
};

export function parsePortfolioHealthStatusFilter(
  value: string | null | undefined,
): PortfolioHealthStatusFilter {
  const candidate = value?.trim().toLowerCase();
  return PORTFOLIO_HEALTH_STATUS_FILTERS.find((status) => status === candidate) ?? "all";
}

export type PortfolioHealthViewInput = {
  rows: readonly PortfolioHealthRow[];
  filters: readonly PortfolioHealthCleanupFilter[];
  query: string;
  status?: PortfolioHealthStatusFilter;
  sort?: PortfolioHealthSort;
};

export type PortfolioHealthView = {
  rows: PortfolioHealthFilteredRow[];
  /** Rows available before filtering and search, for "showing X of Y". */
  sourceCount: number;
  activeFilters: PortfolioHealthCleanupFilter[];
};

function searchableProjection(row: PortfolioHealthFilteredRow): PortfolioHealthSearchableRow {
  return {
    streetLine1: row.streetLine1,
    streetLine2: row.streetLine2,
    city: row.city,
    province: row.province,
    postalCode: row.postalCode,
    unitSlots: row.visibleUnitSlots,
  };
}

export function buildPortfolioHealthView(input: PortfolioHealthViewInput): PortfolioHealthView {
  const activeFilters = normalizeCleanupFilters(input.filters);
  const status = input.status ?? "all";

  const filtered = filterPortfolioHealthCleanupQueue([...input.rows], activeFilters).filter(
    (row) => status === "all" || row.attentionStatus === status,
  );
  const searched = filtered.filter((row) =>
    matchesPortfolioHealthSearch(searchableProjection(row), input.query),
  );

  return {
    rows: sortPortfolioHealthRows(searched, input.sort ?? PORTFOLIO_HEALTH_DEFAULT_SORT),
    sourceCount: input.rows.length,
    activeFilters,
  };
}
