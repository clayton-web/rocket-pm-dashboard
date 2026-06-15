import { isPortfolioImportPlaceholderDate } from "@/lib/portfolio/import-row";
import {
  isPortfolioImportUnknownCity,
  isPortfolioImportUnknownPostal,
} from "@/lib/portfolio/parse-portfolio-address";
import { formatPropertyAddress, formatUnitLabelOrDash } from "@/lib/property/display";

export type PortfolioHealthOverallStatus = "complete" | "needs_review";

export type PortfolioHealthCategoryStatus = "ok" | "missing" | "recommended" | "not_applicable";

export type PortfolioHealthMissingItemKey =
  | "property_address"
  | "owner_contact"
  | "active_tenancy"
  | "tenant_name"
  | "tenant_email"
  | "tenant_phone"
  | "monthly_rent_zero"
  | "security_deposit_zero"
  | "lease_start_date"
  | "move_in_date"
  | "documents"
  | "strata_notes"
  | "import_placeholder_dates"
  | "missing_postal_code"
  | "missing_city";

export const PORTFOLIO_HEALTH_MISSING_LABELS: Record<PortfolioHealthMissingItemKey, string> = {
  property_address: "Missing property address",
  owner_contact: "Missing owner email/phone",
  active_tenancy: "Missing active tenancy",
  tenant_name: "Missing tenant name",
  tenant_email: "Missing tenant email",
  tenant_phone: "Missing tenant phone",
  monthly_rent_zero: "Monthly rent is still $0",
  security_deposit_zero: "Security deposit is still $0",
  lease_start_date: "Missing lease start date",
  move_in_date: "Missing move-in date",
  documents: "Missing uploaded documents",
  strata_notes: "Missing strata notes",
  import_placeholder_dates: "Placeholder lease dates",
  missing_postal_code: "Missing postal code",
  missing_city: "Missing city",
};

export type PortfolioHealthFilter =
  | "all"
  | "complete"
  | "needs_review"
  | "missing_documents"
  | "missing_owner"
  | "missing_tenant"
  | "missing_rent_lease"
  | "vacant";

export type PortfolioHealthTenancyInput = {
  id?: string;
  unitId?: string;
  status: string;
  leaseStartDate: Date | null;
  moveInDate: Date | null;
  monthlyRent: number;
  securityDeposit: number;
  createdAt: Date;
};

export type PortfolioHealthTenantContactInput = {
  contactType: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
};

export type PortfolioHealthUnitInput = {
  unitId: string;
  unitLabel: string;
  tenancy: PortfolioHealthTenancyInput | null;
  contacts: PortfolioHealthTenantContactInput[];
};

export type PortfolioHealthPropertyInput = {
  id: string;
  name: string;
  streetLine1: string;
  streetLine2: string | null;
  city: string;
  province: string;
  postalCode: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  strataNotes: string | null;
  documentCount: number;
  units: PortfolioHealthUnitInput[];
};

export type PortfolioHealthUnitSlot = {
  unitId: string;
  unitLabel: string;
  tenancyId: string | null;
  tenantName: string | null;
  tenantEmail: string | null;
  tenantPhone: string | null;
  monthlyRent: number | null;
  securityDeposit: number | null;
  leaseStartDate: string | null;
  moveInDate: string | null;
  isVacant: boolean;
  tenantDataFlags: PortfolioHealthMissingItemKey[];
};

export type PortfolioHealthRow = {
  propertyId: string;
  propertyLabel: string;
  cityLine: string;
  isVacant: boolean;
  overallStatus: PortfolioHealthOverallStatus;
  ownerInfoStatus: PortfolioHealthCategoryStatus;
  strataNotesStatus: PortfolioHealthCategoryStatus;
  activeTenantStatus: PortfolioHealthCategoryStatus;
  tenantContactStatus: PortfolioHealthCategoryStatus;
  leaseRentStatus: PortfolioHealthCategoryStatus;
  documentsStatus: PortfolioHealthCategoryStatus;
  missingItems: string[];
  missingItemKeys: PortfolioHealthMissingItemKey[];
  propertyMissingItemKeys: PortfolioHealthMissingItemKey[];
  unitSlots: PortfolioHealthUnitSlot[];
  hasImportPlaceholders: boolean;
  missingDocuments: boolean;
  missingOwnerContact: boolean;
  missingTenantInfo: boolean;
  missingRentLeaseInfo: boolean;
};

export type {
  PortfolioHealthIssueSnapshot,
  PortfolioHealthPropertyIssueCounts,
  PortfolioHealthSummary,
  PortfolioHealthTenantIssueCounts,
} from "@/lib/property/portfolio-health-metrics";
export {
  PORTFOLIO_HEALTH_SNAPSHOT_LABELS,
  summarizePortfolioHealth,
} from "@/lib/property/portfolio-health-metrics";

const CURRENT_TENANCY_STATUSES = new Set([
  "pending_move_in",
  "active",
  "notice_received",
  "move_out_scheduled",
  "inspection_scheduled",
  "inspection_completed",
]);

const TENANCY_STATUS_PRIORITY: Record<string, number> = {
  active: 0,
  pending_move_in: 1,
  notice_received: 2,
  move_out_scheduled: 3,
  inspection_scheduled: 4,
  inspection_completed: 5,
};

const PROPERTY_LEVEL_MISSING_KEYS = new Set<PortfolioHealthMissingItemKey>([
  "property_address",
  "owner_contact",
  "documents",
  "strata_notes",
  "missing_postal_code",
  "missing_city",
]);

const UNIT_LEVEL_MISSING_KEYS = new Set<PortfolioHealthMissingItemKey>([
  "active_tenancy",
  "tenant_name",
  "tenant_email",
  "tenant_phone",
  "monthly_rent_zero",
  "security_deposit_zero",
  "lease_start_date",
  "move_in_date",
  "import_placeholder_dates",
]);

function isNonEmpty(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasPropertyAddress(property: PortfolioHealthPropertyInput): boolean {
  return isNonEmpty(property.streetLine1);
}

function hasOwnerContact(property: PortfolioHealthPropertyInput): boolean {
  return isNonEmpty(property.ownerEmail) || isNonEmpty(property.ownerPhone);
}

export function pickPrimaryTenancy(
  tenancies: PortfolioHealthTenancyInput[],
): PortfolioHealthTenancyInput | null {
  if (tenancies.length === 0) return null;
  return [...tenancies].sort((a, b) => {
    const priorityDiff =
      (TENANCY_STATUS_PRIORITY[a.status] ?? 99) - (TENANCY_STATUS_PRIORITY[b.status] ?? 99);
    if (priorityDiff !== 0) return priorityDiff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  })[0]!;
}

function getTenantContact(
  contacts: PortfolioHealthTenantContactInput[],
): PortfolioHealthTenantContactInput | null {
  return contacts.find((contact) => contact.contactType === "tenant") ?? contacts[0] ?? null;
}

function hasTenantName(contact: PortfolioHealthTenantContactInput | null): boolean {
  if (!contact) return false;
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  return name.length > 0 && name !== ".";
}

function hasTenantEmail(contact: PortfolioHealthTenantContactInput | null): boolean {
  if (!contact) return false;
  return isNonEmpty(contact.email);
}

function hasImportPlaceholderDates(tenancy: PortfolioHealthTenancyInput | null): boolean {
  if (!tenancy) return false;
  return (
    isPortfolioImportPlaceholderDate(tenancy.leaseStartDate) ||
    isPortfolioImportPlaceholderDate(tenancy.moveInDate)
  );
}

function formatIsoDate(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function formatTenantDisplayName(contact: PortfolioHealthTenantContactInput | null): string | null {
  if (!contact) return null;
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  return name || null;
}

export function isRequiredPortfolioHealthMissingKey(key: PortfolioHealthMissingItemKey): boolean {
  return (
    key !== "strata_notes" &&
    key !== "tenant_phone" &&
    key !== "security_deposit_zero" &&
    key !== "import_placeholder_dates" &&
    key !== "missing_postal_code" &&
    key !== "missing_city"
  );
}

export function assessPortfolioHealthUnitSlot(unit: PortfolioHealthUnitInput): PortfolioHealthUnitSlot {
  const tenancy = unit.tenancy;
  const tenantContact = tenancy ? getTenantContact(unit.contacts) : null;
  const tenantDataFlags: PortfolioHealthMissingItemKey[] = [];

  if (!tenancy) {
    return {
      unitId: unit.unitId,
      unitLabel: unit.unitLabel,
      tenancyId: null,
      tenantName: null,
      tenantEmail: null,
      tenantPhone: null,
      monthlyRent: null,
      securityDeposit: null,
      leaseStartDate: null,
      moveInDate: null,
      isVacant: true,
      tenantDataFlags,
    };
  }

  if (!hasTenantName(tenantContact)) {
    tenantDataFlags.push("tenant_name");
  }
  if (!hasTenantEmail(tenantContact)) {
    tenantDataFlags.push("tenant_email");
  }
  if (!isNonEmpty(tenantContact?.phone)) {
    tenantDataFlags.push("tenant_phone");
  }
  if (!tenancy.leaseStartDate) {
    tenantDataFlags.push("lease_start_date");
  }
  if (!tenancy.moveInDate) {
    tenantDataFlags.push("move_in_date");
  }
  if (tenancy.monthlyRent <= 0) {
    tenantDataFlags.push("monthly_rent_zero");
  }
  if (tenancy.securityDeposit <= 0) {
    tenantDataFlags.push("security_deposit_zero");
  }
  if (hasImportPlaceholderDates(tenancy)) {
    tenantDataFlags.push("import_placeholder_dates");
  }

  return {
    unitId: unit.unitId,
    unitLabel: unit.unitLabel,
    tenancyId: tenancy.id ?? null,
    tenantName: formatTenantDisplayName(tenantContact),
    tenantEmail: tenantContact?.email.trim() ? tenantContact.email.trim() : null,
    tenantPhone: tenantContact?.phone?.trim() || null,
    monthlyRent: tenancy.monthlyRent,
    securityDeposit: tenancy.securityDeposit,
    leaseStartDate: formatIsoDate(tenancy.leaseStartDate),
    moveInDate: formatIsoDate(tenancy.moveInDate),
    isVacant: false,
    tenantDataFlags,
  };
}

function assessUnitTenantContactStatus(
  slot: PortfolioHealthUnitSlot,
): PortfolioHealthCategoryStatus {
  if (slot.isVacant) return "not_applicable";
  if (hasTenantNameFromSlot(slot) && isNonEmpty(slot.tenantEmail)) {
    return isNonEmpty(slot.tenantPhone) ? "ok" : "recommended";
  }
  return "missing";
}

function assessUnitLeaseRentStatus(slot: PortfolioHealthUnitSlot): PortfolioHealthCategoryStatus {
  if (slot.isVacant) return "not_applicable";
  if (
    slot.leaseStartDate &&
    slot.moveInDate &&
    (slot.monthlyRent ?? 0) > 0
  ) {
    return slot.tenantDataFlags.includes("import_placeholder_dates") ? "recommended" : "ok";
  }
  return "missing";
}

function hasTenantNameFromSlot(slot: PortfolioHealthUnitSlot): boolean {
  const name = slot.tenantName?.trim();
  return Boolean(name && name !== ".");
}

function worstCategoryStatus(
  statuses: PortfolioHealthCategoryStatus[],
): PortfolioHealthCategoryStatus {
  if (statuses.some((status) => status === "missing")) return "missing";
  if (statuses.some((status) => status === "recommended")) return "recommended";
  if (statuses.every((status) => status === "not_applicable")) return "not_applicable";
  return "ok";
}

function assessPropertyLevelMissingKeys(
  property: PortfolioHealthPropertyInput,
): PortfolioHealthMissingItemKey[] {
  const missingItemKeys: PortfolioHealthMissingItemKey[] = [];

  if (!hasPropertyAddress(property)) {
    missingItemKeys.push("property_address");
  }
  if (!hasOwnerContact(property)) {
    missingItemKeys.push("owner_contact");
  }
  if (property.documentCount <= 0) {
    missingItemKeys.push("documents");
  }
  if (!isNonEmpty(property.strataNotes)) {
    missingItemKeys.push("strata_notes");
  }
  if (isPortfolioImportUnknownPostal(property.postalCode)) {
    missingItemKeys.push("missing_postal_code");
  }
  if (isPortfolioImportUnknownCity(property.city)) {
    missingItemKeys.push("missing_city");
  }

  return missingItemKeys;
}

function formatCityLine(property: PortfolioHealthPropertyInput): string {
  return `${property.city}, ${property.province} ${property.postalCode}`;
}

export function assessPortfolioHealthProperty(
  property: PortfolioHealthPropertyInput,
): PortfolioHealthRow {
  const unitSlots = property.units.map((unit) => assessPortfolioHealthUnitSlot(unit));
  const propertyMissingItemKeys = assessPropertyLevelMissingKeys(property);
  const unitMissingItemKeys = unitSlots.flatMap((slot) => slot.tenantDataFlags);
  const missingItemKeys = [...propertyMissingItemKeys, ...unitMissingItemKeys];

  const occupiedSlots = unitSlots.filter((slot) => !slot.isVacant);
  const isVacant = unitSlots.length === 0 || unitSlots.every((slot) => slot.isVacant);

  const requiredMissingKeys = missingItemKeys.filter(isRequiredPortfolioHealthMissingKey);

  const ownerInfoStatus: PortfolioHealthCategoryStatus = hasOwnerContact(property)
    ? "ok"
    : "missing";
  const strataNotesStatus: PortfolioHealthCategoryStatus = isNonEmpty(property.strataNotes)
    ? "ok"
    : "recommended";
  const activeTenantStatus: PortfolioHealthCategoryStatus = isVacant
    ? "not_applicable"
    : occupiedSlots.length > 0
      ? "ok"
      : "missing";
  const tenantContactStatus = worstCategoryStatus(
    unitSlots.map((slot) => assessUnitTenantContactStatus(slot)),
  );
  const leaseRentStatus = worstCategoryStatus(
    unitSlots.map((slot) => assessUnitLeaseRentStatus(slot)),
  );
  const documentsStatus: PortfolioHealthCategoryStatus =
    property.documentCount > 0 ? "ok" : "missing";

  const missingDocuments = missingItemKeys.includes("documents");
  const missingOwnerContact = missingItemKeys.includes("owner_contact");
  const missingTenantInfo = unitMissingItemKeys.some(
    (key) => key === "tenant_name" || key === "tenant_email" || key === "tenant_phone",
  );
  const missingRentLeaseInfo = unitMissingItemKeys.some(
    (key) =>
      key === "monthly_rent_zero" ||
      key === "security_deposit_zero" ||
      key === "lease_start_date" ||
      key === "move_in_date" ||
      key === "import_placeholder_dates",
  );

  return {
    propertyId: property.id,
    propertyLabel: formatPropertyAddress(property),
    cityLine: formatCityLine(property),
    isVacant,
    overallStatus: requiredMissingKeys.length === 0 ? "complete" : "needs_review",
    ownerInfoStatus,
    strataNotesStatus,
    activeTenantStatus,
    tenantContactStatus,
    leaseRentStatus,
    documentsStatus,
    missingItems: missingItemKeys.map((key) => PORTFOLIO_HEALTH_MISSING_LABELS[key]),
    missingItemKeys,
    propertyMissingItemKeys,
    unitSlots,
    hasImportPlaceholders: unitMissingItemKeys.includes("import_placeholder_dates"),
    missingDocuments,
    missingOwnerContact,
    missingTenantInfo,
    missingRentLeaseInfo,
  };
}

/** @deprecated Legacy single-select filter. Use portfolio-health-cleanup-filters instead. */
export function filterPortfolioHealthRows(
  rows: PortfolioHealthRow[],
  filter: PortfolioHealthFilter,
): PortfolioHealthRow[] {
  switch (filter) {
    case "all":
      return rows;
    case "complete":
      return rows.filter((row) => row.overallStatus === "complete");
    case "needs_review":
      return rows.filter((row) => row.overallStatus === "needs_review");
    case "missing_documents":
      return rows.filter((row) => row.missingDocuments);
    case "missing_owner":
      return rows.filter((row) => row.missingOwnerContact);
    case "missing_tenant":
      return rows.filter((row) => row.missingTenantInfo);
    case "missing_rent_lease":
      return rows.filter((row) => row.missingRentLeaseInfo);
    case "vacant":
      return rows.filter((row) => row.isVacant);
    default:
      return rows;
  }
}

export function formatPortfolioHealthCategoryStatus(
  status: PortfolioHealthCategoryStatus,
): string {
  switch (status) {
    case "ok":
      return "OK";
    case "missing":
      return "Missing";
    case "recommended":
      return "Recommended";
    case "not_applicable":
      return "N/A";
    default:
      return status;
  }
}

export function formatPortfolioHealthMissingLabels(
  keys: PortfolioHealthMissingItemKey[],
): string[] {
  return keys.map((key) => PORTFOLIO_HEALTH_MISSING_LABELS[key]);
}

export function isPropertyLevelMissingKey(key: PortfolioHealthMissingItemKey): boolean {
  return PROPERTY_LEVEL_MISSING_KEYS.has(key);
}

export function isUnitLevelMissingKey(key: PortfolioHealthMissingItemKey): boolean {
  return UNIT_LEVEL_MISSING_KEYS.has(key);
}

export function buildPortfolioHealthUnitInput(
  unitId: string,
  unitNumber: string,
  tenancies: PortfolioHealthTenancyInput[],
  contactsByTenancyId: Map<string, PortfolioHealthTenantContactInput[]>,
): PortfolioHealthUnitInput {
  const unitTenancies = tenancies.filter(
    (tenancy) => tenancy.unitId === unitId && CURRENT_TENANCY_STATUSES.has(tenancy.status),
  );
  const primaryTenancy = pickPrimaryTenancy(unitTenancies);

  return {
    unitId,
    unitLabel: formatUnitLabelOrDash(unitNumber),
    tenancy: primaryTenancy,
    contacts:
      primaryTenancy?.id != null
        ? (contactsByTenancyId.get(primaryTenancy.id) ?? [])
        : [],
  };
}
