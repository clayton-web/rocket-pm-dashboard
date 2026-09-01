import {
  parseCleanupFiltersParam,
  serializeCleanupFiltersParam,
  type PortfolioHealthCleanupFilter,
} from "@/lib/property/portfolio-health-cleanup-filters";
import {
  parsePortfolioHealthSort,
  PORTFOLIO_HEALTH_DEFAULT_SORT,
  type PortfolioHealthSort,
} from "@/lib/property/portfolio-health-ranking";
import {
  composePortfolioHealthUrlParams,
  parseSearchQueryParam,
} from "@/lib/property/portfolio-health-search";
import {
  parsePortfolioHealthStatusFilter,
  type PortfolioHealthStatusFilter,
} from "@/lib/property/portfolio-health-view";

export const PORTFOLIO_HEALTH_RETURN_PATH = "/properties/health";

/**
 * Everything that makes one staff member's Property Health worklist different from another's.
 *
 * Edit round trips carry this whole object rather than four unrelated query-string fragments,
 * because the failure mode of the previous contract was silent and asymmetric: it preserved
 * `filters` and dropped `q`, `status` and `sort`, so returning from an edit quietly widened the
 * worklist and staff lost their place.
 */
export type HealthViewState = {
  filters: PortfolioHealthCleanupFilter[];
  query: string;
  status: PortfolioHealthStatusFilter;
  sort: PortfolioHealthSort;
};

/** @deprecated Name retained for existing imports; this is the full view state now. */
export type HealthCleanupContext = HealthViewState;

export function emptyHealthViewState(): HealthViewState {
  return { filters: [], query: "", status: "all", sort: PORTFOLIO_HEALTH_DEFAULT_SORT };
}

/**
 * Parameter names on the *edit* page, deliberately prefixed.
 *
 * A tenancy or property page has its own notion of `q` and `sort`; namespacing the health
 * context means adding one later cannot silently collide with the carried worklist state.
 */
const CONTEXT_PARAM = {
  flag: "fromHealth",
  filters: "healthFilters",
  query: "healthQ",
  status: "healthStatus",
  sort: "healthSort",
} as const;

type ParamReader = Record<string, string | string[] | undefined> | URLSearchParams;

function readParam(source: ParamReader, key: string): string | null {
  if (source instanceof URLSearchParams) return source.get(key);
  const value = source[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

/**
 * Every field is re-parsed through its own whitelist rather than copied, so a hostile or stale
 * link cannot inject an unknown filter token, an oversized query, or an invalid sort.
 */
function parseViewStateFrom(
  read: (key: string) => string | null,
  keys: { filters: string; query: string; status: string; sort: string },
): HealthViewState {
  return {
    filters: parseCleanupFiltersParam(read(keys.filters)),
    query: parseSearchQueryParam(read(keys.query)),
    status: parsePortfolioHealthStatusFilter(read(keys.status)),
    sort: parsePortfolioHealthSort(read(keys.sort)),
  };
}

/**
 * Validates an untrusted return path and rebuilds it from sanitized parts.
 *
 * The guards below are unchanged from the hardened original; the only difference is that the
 * rebuilt URL now carries the whole worklist state instead of just `filters`. It still never
 * echoes the caller's string back — every component is re-derived.
 */
export function parseSafeHealthReturnPath(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  if (trimmed.includes("\\")) return null;
  if (trimmed.includes("@")) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed, "http://localhost");
  } catch {
    return null;
  }

  if (parsed.origin !== "http://localhost") return null;
  if (parsed.pathname !== PORTFOLIO_HEALTH_RETURN_PATH) return null;
  if (parsed.username || parsed.password) return null;

  // Read the health page's own parameter names here: this is a link back to that page.
  const state = parseViewStateFrom((key) => parsed.searchParams.get(key), {
    filters: "filters",
    query: "q",
    status: "status",
    sort: "sort",
  });

  return buildHealthReturnUrl(state);
}

/**
 * Builds a link back to the worklist. `extraParams` exists for `cleanupDone=1` and cannot
 * overwrite the state parameters it is layered onto.
 */
export function buildHealthReturnUrl(
  state: HealthViewState,
  extraParams?: Record<string, string>,
): string {
  const params = composePortfolioHealthUrlParams({
    filters: state.filters,
    query: state.query,
    status: state.status,
    sort: state.sort,
  });

  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      if (key === "filters" || key === "q" || key === "status" || key === "sort") continue;
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `${PORTFOLIO_HEALTH_RETURN_PATH}?${query}` : PORTFOLIO_HEALTH_RETURN_PATH;
}

function writeContextParams(params: URLSearchParams, state: HealthViewState): void {
  params.set(CONTEXT_PARAM.flag, "1");

  const filters = serializeCleanupFiltersParam(state.filters);
  if (filters) params.set(CONTEXT_PARAM.filters, filters);

  const query = state.query.trim();
  if (query) params.set(CONTEXT_PARAM.query, query);

  if (state.status !== "all") params.set(CONTEXT_PARAM.status, state.status);
  if (state.sort !== PORTFOLIO_HEALTH_DEFAULT_SORT) params.set(CONTEXT_PARAM.sort, state.sort);
}

export function buildHealthEditTenancyHref(tenancyId: string, state: HealthViewState): string {
  const params = new URLSearchParams();
  writeContextParams(params, state);
  return `/leasing/tenancies/${tenancyId}?${params.toString()}#edit-tenancy`;
}

/**
 * Deep link into the canonical Property Detail page, carrying the worklist state.
 *
 * `anchor` is the fragment to land on and `field` the optional control to focus. Both are plain
 * strings: this module composes URLs and deliberately does not know which anchors exist. The
 * mapping from a health issue to a section and field lives in `portfolio-health-edit-targets.ts`.
 */
export function buildHealthEditPropertyHref(
  propertyId: string,
  state: HealthViewState,
  target?: { anchor?: string | null; field?: string | null },
): string {
  const params = new URLSearchParams();
  writeContextParams(params, state);
  if (target?.field) params.set("focus", target.field);
  const hash = target?.anchor ? `#${target.anchor}` : "";
  return `/properties/${propertyId}?${params.toString()}${hash}`;
}

/**
 * Reads the carried worklist state on an edit page. Returns null when the visitor did not
 * arrive from Property Health, which is what suppresses the save-and-return controls.
 *
 * Links written before this slice carried only `healthFilters`; those still parse, with the
 * remaining fields falling back to their defaults.
 */
export function parseHealthCleanupContext(searchParams: ParamReader): HealthViewState | null {
  const read = (key: string) => readParam(searchParams, key);
  if (read(CONTEXT_PARAM.flag) !== "1") return null;

  return parseViewStateFrom(read, {
    filters: CONTEXT_PARAM.filters,
    query: CONTEXT_PARAM.query,
    status: CONTEXT_PARAM.status,
    sort: CONTEXT_PARAM.sort,
  });
}

/** Optional focus target carried alongside the health context. */
export function parseHealthFocusField(searchParams: ParamReader): string | null {
  const raw = readParam(searchParams, "focus");
  if (!raw) return null;
  const trimmed = raw.trim();
  // Field names are identifiers; anything else is not ours and is discarded.
  return /^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(trimmed) ? trimmed : null;
}

/** Prefers a validated caller-supplied return path, else rebuilds from the carried state. */
export function appendHealthContextToReturnPath(
  returnPath: string,
  state: HealthViewState,
): string {
  return parseSafeHealthReturnPath(returnPath) ?? buildHealthReturnUrl(state);
}
