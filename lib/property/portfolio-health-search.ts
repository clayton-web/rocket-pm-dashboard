import { normalizeStreetLineKey } from "@/lib/integrations/pm-context/normalize-address-hint";
import {
  serializeCleanupFiltersParam,
  type PortfolioHealthCleanupFilter,
} from "@/lib/property/portfolio-health-cleanup-filters";
import type { PortfolioHealthRow } from "@/lib/property/portfolio-health";

/**
 * Address-aware search over already-loaded Property Health rows.
 *
 * Street fields are indexed twice: once as plain text and once through the shared
 * `normalizeStreetLineKey` used by the PM-context resolver, so "123 main st" also finds
 * "123 Main Street". Postal codes are indexed with separators stripped so "v6b1a1" and
 * "V6B 1A1" both match. These normalizations are read-only search keys and never feed
 * storage, matching, or dedup.
 */

export type PortfolioHealthSearchableRow = Pick<
  PortfolioHealthRow,
  "streetLine1" | "streetLine2" | "city" | "province" | "postalCode" | "unitSlots"
>;

/** Lowercase, drop punctuation, collapse whitespace. No street-type expansion. */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lowercase alphanumerics only, so postal codes match with or without the separator. */
export function normalizePostalSearchKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function pushIfPresent(target: string[], value: string | null | undefined): void {
  if (!value) return;
  const trimmed = value.trim();
  if (trimmed) target.push(trimmed);
}

/** Every normalized string a query may match against, for one row. */
export function buildPortfolioHealthSearchIndex(row: PortfolioHealthSearchableRow): string[] {
  const streetParts: string[] = [];
  pushIfPresent(streetParts, row.streetLine1);
  pushIfPresent(streetParts, row.streetLine2);

  const plainParts: string[] = [...streetParts];
  pushIfPresent(plainParts, row.city);
  pushIfPresent(plainParts, row.province);
  for (const slot of row.unitSlots) {
    pushIfPresent(plainParts, slot.unitLabel);
    pushIfPresent(plainParts, slot.tenantName);
  }

  const index = new Set<string>();
  for (const part of plainParts) {
    const text = normalizeSearchText(part);
    if (text) index.add(text);
  }
  for (const part of streetParts) {
    const streetKey = normalizeStreetLineKey(part);
    if (streetKey) index.add(streetKey);
  }
  const postalKey = normalizePostalSearchKey(row.postalCode ?? "");
  if (postalKey) index.add(postalKey);

  return [...index];
}

/**
 * The normalized forms a raw query should be tried under. Returns nothing when the query holds
 * no alphanumeric characters, so a blank or punctuation-only box matches every row.
 * `normalizeStreetLineKey` preserves some punctuation (dashes carry unit information), which is
 * why emptiness is decided by the plain-text normalization rather than per-term.
 */
export function buildPortfolioHealthSearchTerms(rawQuery: string): string[] {
  if (!normalizeSearchText(rawQuery)) return [];

  const terms = new Set<string>();
  for (const term of [
    normalizeSearchText(rawQuery),
    normalizeStreetLineKey(rawQuery),
    normalizePostalSearchKey(rawQuery),
  ]) {
    if (term) terms.add(term);
  }
  return [...terms];
}

export function matchesPortfolioHealthSearch(
  row: PortfolioHealthSearchableRow,
  rawQuery: string,
): boolean {
  const terms = buildPortfolioHealthSearchTerms(rawQuery);
  if (terms.length === 0) return true;

  const index = buildPortfolioHealthSearchIndex(row);
  return terms.some((term) => index.some((entry) => entry.includes(term)));
}

/** A blank or punctuation-only query returns every row. Never mutates the input. */
export function searchPortfolioHealthRows<T extends PortfolioHealthSearchableRow>(
  rows: readonly T[],
  rawQuery: string,
): T[] {
  const terms = buildPortfolioHealthSearchTerms(rawQuery);
  if (terms.length === 0) return [...rows];

  return rows.filter((row) => {
    const index = buildPortfolioHealthSearchIndex(row);
    return terms.some((term) => index.some((entry) => entry.includes(term)));
  });
}

export const PORTFOLIO_HEALTH_SEARCH_PARAM = "q";

export function parseSearchQueryParam(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().slice(0, 200);
}

export function serializeSearchQueryParam(query: string): string {
  return query.trim();
}

export const PORTFOLIO_HEALTH_STATUS_PARAM = "status";
export const PORTFOLIO_HEALTH_SORT_PARAM = "sort";

/**
 * Single place that composes every Property Health URL parameter, so changing the search never
 * drops active filters and changing filters never drops the search. Any other parameters on
 * `base` are carried through untouched.
 *
 * `status` and `sort` are written only when they differ from their defaults, keeping the common
 * URL short and making a bare `/properties/health` unambiguously the default view. Omitting one,
 * or passing its default sentinel, removes it — the same contract `filters` and `query` already
 * have for `[]` and `""`. The sentinels are literals here so this module does not have to import
 * the status and sort vocabularies it only ever round-trips as text.
 */
export function composePortfolioHealthUrlParams(input: {
  filters: PortfolioHealthCleanupFilter[];
  query: string;
  status?: string;
  sort?: string;
  base?: URLSearchParams | string;
}): URLSearchParams {
  const params = new URLSearchParams(input.base ?? undefined);

  if (input.status && input.status !== "all") params.set(PORTFOLIO_HEALTH_STATUS_PARAM, input.status);
  else params.delete(PORTFOLIO_HEALTH_STATUS_PARAM);

  if (input.sort && input.sort !== "health") params.set(PORTFOLIO_HEALTH_SORT_PARAM, input.sort);
  else params.delete(PORTFOLIO_HEALTH_SORT_PARAM);

  const filters = serializeCleanupFiltersParam(input.filters);
  if (filters) params.set("filters", filters);
  else params.delete("filters");

  const query = serializeSearchQueryParam(input.query);
  if (query) params.set(PORTFOLIO_HEALTH_SEARCH_PARAM, query);
  else params.delete(PORTFOLIO_HEALTH_SEARCH_PARAM);

  return params;
}
