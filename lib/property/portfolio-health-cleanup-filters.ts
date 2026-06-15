import type {
  PortfolioHealthMissingItemKey,
  PortfolioHealthRow,
  PortfolioHealthUnitSlot,
} from "@/lib/property/portfolio-health";

export type PortfolioHealthCleanupFilter =
  | "tenant_name"
  | "tenant_email"
  | "tenant_phone"
  | "lease_dates"
  | "placeholder_dates"
  | "rent_zero"
  | "deposit_zero"
  | "documents"
  | "missing_postal_code"
  | "missing_city"
  | "owner_contact";

export const PORTFOLIO_HEALTH_TENANT_CLEANUP_FILTERS: PortfolioHealthCleanupFilter[] = [
  "tenant_name",
  "tenant_email",
  "tenant_phone",
  "lease_dates",
  "placeholder_dates",
  "rent_zero",
  "deposit_zero",
];

export const PORTFOLIO_HEALTH_PROPERTY_CLEANUP_FILTERS: PortfolioHealthCleanupFilter[] = [
  "documents",
  "missing_postal_code",
  "missing_city",
  "owner_contact",
];

export const PORTFOLIO_HEALTH_CLEANUP_FILTER_LABELS: Record<PortfolioHealthCleanupFilter, string> = {
  tenant_name: "Missing tenant name",
  tenant_email: "Missing tenant email",
  tenant_phone: "Missing tenant phone",
  lease_dates: "Missing lease dates",
  placeholder_dates: "Placeholder lease dates",
  rent_zero: "Rent = $0",
  deposit_zero: "Deposit = $0",
  documents: "Missing documents",
  missing_postal_code: "Missing postal code",
  missing_city: "Missing city",
  owner_contact: "Missing owner contact",
};

const CLEANUP_FILTER_URL_ALIASES: Record<string, PortfolioHealthCleanupFilter> = {
  tenant_name: "tenant_name",
  tenant_email: "tenant_email",
  tenant_phone: "tenant_phone",
  lease_dates: "lease_dates",
  placeholder_dates: "placeholder_dates",
  placeholder_lease_dates: "placeholder_dates",
  rent_zero: "rent_zero",
  deposit_zero: "deposit_zero",
  documents: "documents",
  missing_postal_code: "missing_postal_code",
  missing_city: "missing_city",
  owner_contact: "owner_contact",
};

const PROPERTY_FILTER_TO_MISSING_KEY: Partial<
  Record<PortfolioHealthCleanupFilter, PortfolioHealthMissingItemKey>
> = {
  documents: "documents",
  missing_postal_code: "missing_postal_code",
  missing_city: "missing_city",
  owner_contact: "owner_contact",
};

export type PortfolioHealthFilteredRow = PortfolioHealthRow & {
  visiblePropertyMissingItemKeys: PortfolioHealthMissingItemKey[];
  visibleUnitSlots: Array<
    PortfolioHealthUnitSlot & { visibleTenantDataFlags: PortfolioHealthMissingItemKey[] }
  >;
};

export function isTenantCleanupFilter(
  filter: PortfolioHealthCleanupFilter,
): filter is PortfolioHealthCleanupFilter {
  return PORTFOLIO_HEALTH_TENANT_CLEANUP_FILTERS.includes(filter);
}

export function isPropertyCleanupFilter(
  filter: PortfolioHealthCleanupFilter,
): filter is PortfolioHealthCleanupFilter {
  return PORTFOLIO_HEALTH_PROPERTY_CLEANUP_FILTERS.includes(filter);
}

export function tenantCleanupFilterMatchesFlag(
  filter: PortfolioHealthCleanupFilter,
  flag: PortfolioHealthMissingItemKey,
): boolean {
  switch (filter) {
    case "tenant_name":
      return flag === "tenant_name";
    case "tenant_email":
      return flag === "tenant_email";
    case "tenant_phone":
      return flag === "tenant_phone";
    case "lease_dates":
      return flag === "lease_start_date" || flag === "move_in_date";
    case "placeholder_dates":
      return flag === "import_placeholder_dates";
    case "rent_zero":
      return flag === "monthly_rent_zero";
    case "deposit_zero":
      return flag === "security_deposit_zero";
    default:
      return false;
  }
}

export function unitMatchesTenantCleanupFilter(
  slot: PortfolioHealthUnitSlot,
  filter: PortfolioHealthCleanupFilter,
): boolean {
  if (slot.isVacant) return false;
  return slot.tenantDataFlags.some((flag) => tenantCleanupFilterMatchesFlag(filter, flag));
}

export function unitMatchesAllTenantCleanupFilters(
  slot: PortfolioHealthUnitSlot,
  filters: PortfolioHealthCleanupFilter[],
): boolean {
  const tenantFilters = filters.filter(isTenantCleanupFilter);
  if (tenantFilters.length === 0) return true;
  return tenantFilters.every((filter) => unitMatchesTenantCleanupFilter(slot, filter));
}

export function propertyMatchesPropertyCleanupFilter(
  row: PortfolioHealthRow,
  filter: PortfolioHealthCleanupFilter,
): boolean {
  const key = PROPERTY_FILTER_TO_MISSING_KEY[filter];
  return key != null && row.propertyMissingItemKeys.includes(key);
}

export function propertyMatchesAllCleanupFilters(
  row: PortfolioHealthRow,
  filters: PortfolioHealthCleanupFilter[],
): boolean {
  if (filters.length === 0) return true;

  const propertyFilters = filters.filter(isPropertyCleanupFilter);
  const tenantFilters = filters.filter(isTenantCleanupFilter);

  const propertyOk = propertyFilters.every((filter) =>
    propertyMatchesPropertyCleanupFilter(row, filter),
  );
  const tenantOk =
    tenantFilters.length === 0 ||
    row.unitSlots.some((slot) => unitMatchesAllTenantCleanupFilters(slot, tenantFilters));

  return propertyOk && tenantOk;
}

export function visibleTenantDataFlagsForSlot(
  slot: PortfolioHealthUnitSlot,
  filters: PortfolioHealthCleanupFilter[],
): PortfolioHealthMissingItemKey[] {
  const tenantFilters = filters.filter(isTenantCleanupFilter);
  if (tenantFilters.length === 0) return slot.tenantDataFlags;
  return slot.tenantDataFlags.filter((flag) =>
    tenantFilters.some((filter) => tenantCleanupFilterMatchesFlag(filter, flag)),
  );
}

export function visiblePropertyMissingKeys(
  row: PortfolioHealthRow,
  filters: PortfolioHealthCleanupFilter[],
): PortfolioHealthMissingItemKey[] {
  const propertyFilters = filters.filter(isPropertyCleanupFilter);
  if (propertyFilters.length === 0) return row.propertyMissingItemKeys;
  return row.propertyMissingItemKeys.filter((key) =>
    propertyFilters.some((filter) => PROPERTY_FILTER_TO_MISSING_KEY[filter] === key),
  );
}

export function filterPortfolioHealthCleanupQueue(
  rows: PortfolioHealthRow[],
  filters: PortfolioHealthCleanupFilter[],
): PortfolioHealthFilteredRow[] {
  const activeFilters = normalizeCleanupFilters(filters);
  if (activeFilters.length === 0) {
    return rows.map((row) => ({
      ...row,
      visiblePropertyMissingItemKeys: row.propertyMissingItemKeys,
      visibleUnitSlots: row.unitSlots.map((slot) => ({
        ...slot,
        visibleTenantDataFlags: slot.tenantDataFlags,
      })),
    }));
  }

  return rows
    .filter((row) => propertyMatchesAllCleanupFilters(row, activeFilters))
    .map((row) => {
      const tenantFilters = activeFilters.filter(isTenantCleanupFilter);
      const visibleUnitSlots =
        tenantFilters.length === 0
          ? row.unitSlots.map((slot) => ({
              ...slot,
              visibleTenantDataFlags: visibleTenantDataFlagsForSlot(slot, activeFilters),
            }))
          : row.unitSlots
              .filter((slot) => unitMatchesAllTenantCleanupFilters(slot, activeFilters))
              .map((slot) => ({
                ...slot,
                visibleTenantDataFlags: visibleTenantDataFlagsForSlot(slot, activeFilters),
              }));

      return {
        ...row,
        visiblePropertyMissingItemKeys: visiblePropertyMissingKeys(row, activeFilters),
        visibleUnitSlots,
      };
    });
}

export function normalizeCleanupFilters(
  filters: Iterable<PortfolioHealthCleanupFilter>,
): PortfolioHealthCleanupFilter[] {
  const seen = new Set<PortfolioHealthCleanupFilter>();
  const normalized: PortfolioHealthCleanupFilter[] = [];
  for (const filter of filters) {
    if (seen.has(filter)) continue;
    seen.add(filter);
    normalized.push(filter);
  }
  return normalized;
}

export function parseCleanupFiltersParam(value: string | null | undefined): PortfolioHealthCleanupFilter[] {
  if (!value?.trim()) return [];
  const parsed: PortfolioHealthCleanupFilter[] = [];
  for (const token of value.split(",")) {
    const filter = CLEANUP_FILTER_URL_ALIASES[token.trim().toLowerCase()];
    if (filter) parsed.push(filter);
  }
  return normalizeCleanupFilters(parsed);
}

export function serializeCleanupFiltersParam(
  filters: PortfolioHealthCleanupFilter[],
): string {
  return normalizeCleanupFilters(filters).join(",");
}

export function propertyNeedsTenantCleanup(row: PortfolioHealthRow): boolean {
  return row.unitSlots.some((slot) => slot.tenantDataFlags.length > 0);
}

export function propertyNeedsPropertyCleanup(row: PortfolioHealthRow): boolean {
  return row.propertyMissingItemKeys.some(
    (key) =>
      key === "documents" ||
      key === "missing_postal_code" ||
      key === "missing_city" ||
      key === "owner_contact" ||
      key === "property_address",
  );
}
