import {
  parseCleanupFiltersParam,
  serializeCleanupFiltersParam,
  type PortfolioHealthCleanupFilter,
} from "@/lib/property/portfolio-health-cleanup-filters";

export const PORTFOLIO_HEALTH_RETURN_PATH = "/properties/health";

export type HealthCleanupContext = {
  filters: PortfolioHealthCleanupFilter[];
};

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

  const safeFilters = parseCleanupFiltersParam(parsed.searchParams.get("filters"));
  const params = new URLSearchParams();
  const serialized = serializeCleanupFiltersParam(safeFilters);
  if (serialized) params.set("filters", serialized);
  const query = params.toString();
  return query ? `${PORTFOLIO_HEALTH_RETURN_PATH}?${query}` : PORTFOLIO_HEALTH_RETURN_PATH;
}

export function buildHealthReturnUrl(
  filters: PortfolioHealthCleanupFilter[],
  extraParams?: Record<string, string>,
): string {
  const params = new URLSearchParams();
  const serialized = serializeCleanupFiltersParam(filters);
  if (serialized) params.set("filters", serialized);
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      if (key !== "filters") params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `${PORTFOLIO_HEALTH_RETURN_PATH}?${query}` : PORTFOLIO_HEALTH_RETURN_PATH;
}

export function buildHealthEditTenancyHref(
  tenancyId: string,
  filters: PortfolioHealthCleanupFilter[],
): string {
  const params = new URLSearchParams();
  params.set("fromHealth", "1");
  const serialized = serializeCleanupFiltersParam(filters);
  if (serialized) params.set("healthFilters", serialized);
  const query = params.toString();
  return `/leasing/tenancies/${tenancyId}?${query}#edit-tenancy`;
}

export function parseHealthCleanupContext(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams,
): HealthCleanupContext | null {
  const read = (key: string): string | null => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key);
    }
    const value = searchParams[key];
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value[0] ?? null;
    return null;
  };

  if (read("fromHealth") !== "1") return null;
  return {
    filters: parseCleanupFiltersParam(read("healthFilters")),
  };
}

export function appendHealthContextToReturnPath(
  returnPath: string,
  filters: PortfolioHealthCleanupFilter[],
): string {
  const safe = parseSafeHealthReturnPath(returnPath);
  const base = safe ?? buildHealthReturnUrl(filters);
  return base;
}
