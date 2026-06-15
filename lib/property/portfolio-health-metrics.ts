import type {
  PortfolioHealthMissingItemKey,
  PortfolioHealthRow,
  PortfolioHealthUnitSlot,
} from "@/lib/property/portfolio-health";

export type PortfolioHealthPropertyIssueCounts = {
  missingDocuments: number;
  missingPostalCode: number;
  missingCity: number;
  missingOwnerContact: number;
};

export type PortfolioHealthTenantIssueCounts = {
  missingTenantName: number;
  missingTenantEmail: number;
  missingTenantPhone: number;
  missingLeaseDates: number;
  placeholderLeaseDates: number;
  rentZero: number;
  depositZero: number;
};

export type PortfolioHealthIssueSnapshot = {
  propertyIssues: PortfolioHealthPropertyIssueCounts;
  tenantIssues: PortfolioHealthTenantIssueCounts;
};

export type PortfolioHealthSummary = {
  /** Active (non-archived) properties in scope. Same as `total`. */
  activeProperties: number;
  /** Occupied units with a current tenancy. Excludes vacant units and archived tenancies. */
  activeTenancies: number;
  total: number;
  complete: number;
  needsReview: number;
  missingDocuments: number;
  missingOwnerContact: number;
  missingTenantInfo: number;
  vacant: number;
  /** Properties with at least one occupied unit needing tenant cleanup. Counted once per property. */
  needsTenantCleanup: number;
  /** Properties with at least one property-level cleanup issue. Counted once per property. */
  needsPropertyCleanup: number;
  issueSnapshot: PortfolioHealthIssueSnapshot;
};

/**
 * Property-level cleanup counters count each property at most once.
 * Issue snapshot tenant counters count occupied units (suites), so a duplex with
 * two missing-phone tenancies contributes 2 to missingTenantPhone but 1 to
 * needsTenantCleanup.
 */
export function occupiedUnitSlots(rows: PortfolioHealthRow[]): PortfolioHealthUnitSlot[] {
  return rows.flatMap((row) => row.unitSlots.filter((slot) => !slot.isVacant));
}

export function propertyNeedsTenantCleanup(row: PortfolioHealthRow): boolean {
  return row.unitSlots.some((slot) => !slot.isVacant && slot.tenantDataFlags.length > 0);
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

export function propertyHasIssue(
  row: PortfolioHealthRow,
  key: PortfolioHealthMissingItemKey,
): boolean {
  return row.propertyMissingItemKeys.includes(key);
}

export function occupiedUnitHasIssue(
  slot: PortfolioHealthUnitSlot,
  key: PortfolioHealthMissingItemKey,
): boolean {
  return !slot.isVacant && slot.tenantDataFlags.includes(key);
}

export function occupiedUnitHasMissingLeaseDates(slot: PortfolioHealthUnitSlot): boolean {
  return (
    !slot.isVacant &&
    (slot.tenantDataFlags.includes("lease_start_date") ||
      slot.tenantDataFlags.includes("move_in_date"))
  );
}

export function countPropertiesWithIssue(
  rows: PortfolioHealthRow[],
  key: PortfolioHealthMissingItemKey,
): number {
  return rows.filter((row) => propertyHasIssue(row, key)).length;
}

export function countOccupiedUnitsWithIssue(
  rows: PortfolioHealthRow[],
  key: PortfolioHealthMissingItemKey,
): number {
  return occupiedUnitSlots(rows).filter((slot) => occupiedUnitHasIssue(slot, key)).length;
}

export function countOccupiedUnitsWithMissingLeaseDates(rows: PortfolioHealthRow[]): number {
  return occupiedUnitSlots(rows).filter((slot) => occupiedUnitHasMissingLeaseDates(slot)).length;
}

export function countActiveTenancies(rows: PortfolioHealthRow[]): number {
  return occupiedUnitSlots(rows).length;
}

export function buildPortfolioHealthIssueSnapshot(
  rows: PortfolioHealthRow[],
): PortfolioHealthIssueSnapshot {
  return {
    propertyIssues: {
      missingDocuments: countPropertiesWithIssue(rows, "documents"),
      missingPostalCode: countPropertiesWithIssue(rows, "missing_postal_code"),
      missingCity: countPropertiesWithIssue(rows, "missing_city"),
      missingOwnerContact: countPropertiesWithIssue(rows, "owner_contact"),
    },
    tenantIssues: {
      missingTenantName: countOccupiedUnitsWithIssue(rows, "tenant_name"),
      missingTenantEmail: countOccupiedUnitsWithIssue(rows, "tenant_email"),
      missingTenantPhone: countOccupiedUnitsWithIssue(rows, "tenant_phone"),
      missingLeaseDates: countOccupiedUnitsWithMissingLeaseDates(rows),
      placeholderLeaseDates: countOccupiedUnitsWithIssue(rows, "import_placeholder_dates"),
      rentZero: countOccupiedUnitsWithIssue(rows, "monthly_rent_zero"),
      depositZero: countOccupiedUnitsWithIssue(rows, "security_deposit_zero"),
    },
  };
}

export function summarizePortfolioHealth(rows: PortfolioHealthRow[]): PortfolioHealthSummary {
  const issueSnapshot = buildPortfolioHealthIssueSnapshot(rows);

  return {
    activeProperties: rows.length,
    activeTenancies: countActiveTenancies(rows),
    total: rows.length,
    complete: rows.filter((row) => row.overallStatus === "complete").length,
    needsReview: rows.filter((row) => row.overallStatus === "needs_review").length,
    needsTenantCleanup: rows.filter((row) => propertyNeedsTenantCleanup(row)).length,
    needsPropertyCleanup: rows.filter((row) => propertyNeedsPropertyCleanup(row)).length,
    missingDocuments: issueSnapshot.propertyIssues.missingDocuments,
    missingOwnerContact: issueSnapshot.propertyIssues.missingOwnerContact,
    missingTenantInfo: rows.filter((row) => row.missingTenantInfo).length,
    vacant: rows.filter((row) => row.isVacant).length,
    issueSnapshot,
  };
}

export function emptyPortfolioHealthSummary(): PortfolioHealthSummary {
  return summarizePortfolioHealth([]);
}

export const PORTFOLIO_HEALTH_SNAPSHOT_LABELS: Array<{
  label: string;
  value: (snapshot: PortfolioHealthIssueSnapshot) => number;
}> = [
  { label: "Missing tenant name", value: (s) => s.tenantIssues.missingTenantName },
  { label: "Missing tenant email", value: (s) => s.tenantIssues.missingTenantEmail },
  { label: "Missing tenant phone", value: (s) => s.tenantIssues.missingTenantPhone },
  { label: "Missing lease dates", value: (s) => s.tenantIssues.missingLeaseDates },
  { label: "Placeholder lease dates", value: (s) => s.tenantIssues.placeholderLeaseDates },
  { label: "Rent = $0", value: (s) => s.tenantIssues.rentZero },
  { label: "Deposit = $0", value: (s) => s.tenantIssues.depositZero },
  { label: "Missing documents", value: (s) => s.propertyIssues.missingDocuments },
  { label: "Missing postal code", value: (s) => s.propertyIssues.missingPostalCode },
  { label: "Missing city", value: (s) => s.propertyIssues.missingCity },
  { label: "Missing owner contact", value: (s) => s.propertyIssues.missingOwnerContact },
];
