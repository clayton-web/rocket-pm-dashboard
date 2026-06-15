import { isPortfolioImportPlaceholderDate } from "@/lib/portfolio/import-row";
import { formatPropertyAddress } from "@/lib/property/display";

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
  | "import_placeholder_dates";

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
  import_placeholder_dates: "Lease/move-in dates look like import placeholders",
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
  tenancies: PortfolioHealthTenancyInput[];
  contacts: PortfolioHealthTenantContactInput[];
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
  hasImportPlaceholders: boolean;
  missingDocuments: boolean;
  missingOwnerContact: boolean;
  missingTenantInfo: boolean;
  missingRentLeaseInfo: boolean;
};

export type PortfolioHealthSummary = {
  total: number;
  complete: number;
  needsReview: number;
  missingDocuments: number;
  missingOwnerContact: number;
  missingTenantInfo: number;
  vacant: number;
};

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

function isNonEmpty(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasPropertyAddress(property: PortfolioHealthPropertyInput): boolean {
  return isNonEmpty(property.streetLine1);
}

function hasOwnerContact(property: PortfolioHealthPropertyInput): boolean {
  return isNonEmpty(property.ownerEmail) || isNonEmpty(property.ownerPhone);
}

function getCurrentTenancies(property: PortfolioHealthPropertyInput): PortfolioHealthTenancyInput[] {
  return property.tenancies.filter((tenancy) => CURRENT_TENANCY_STATUSES.has(tenancy.status));
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

function hasImportPlaceholderDates(tenancy: PortfolioHealthTenancyInput | null): boolean {
  if (!tenancy) return false;
  return (
    isPortfolioImportPlaceholderDate(tenancy.leaseStartDate) ||
    isPortfolioImportPlaceholderDate(tenancy.moveInDate)
  );
}

function formatCityLine(property: PortfolioHealthPropertyInput): string {
  return `${property.city}, ${property.province} ${property.postalCode}`;
}

export function assessPortfolioHealthProperty(
  property: PortfolioHealthPropertyInput,
): PortfolioHealthRow {
  const currentTenancies = getCurrentTenancies(property);
  const primaryTenancy = pickPrimaryTenancy(currentTenancies);
  const tenantContact = primaryTenancy ? getTenantContact(property.contacts) : null;
  const isVacant = currentTenancies.length === 0;
  const occupied = !isVacant;

  const missingItemKeys: PortfolioHealthMissingItemKey[] = [];

  if (!hasPropertyAddress(property)) {
    missingItemKeys.push("property_address");
  }
  if (!hasOwnerContact(property)) {
    missingItemKeys.push("owner_contact");
  }
  if (occupied && !primaryTenancy) {
    missingItemKeys.push("active_tenancy");
  }
  if (occupied) {
    if (!hasTenantName(tenantContact)) {
      missingItemKeys.push("tenant_name");
    }
    if (!isNonEmpty(tenantContact?.email)) {
      missingItemKeys.push("tenant_email");
    }
    if (!isNonEmpty(tenantContact?.phone)) {
      missingItemKeys.push("tenant_phone");
    }
    if (!primaryTenancy?.leaseStartDate) {
      missingItemKeys.push("lease_start_date");
    }
    if (!primaryTenancy?.moveInDate) {
      missingItemKeys.push("move_in_date");
    }
    if ((primaryTenancy?.monthlyRent ?? 0) <= 0) {
      missingItemKeys.push("monthly_rent_zero");
    }
    if ((primaryTenancy?.securityDeposit ?? 0) <= 0) {
      missingItemKeys.push("security_deposit_zero");
    }
    if (hasImportPlaceholderDates(primaryTenancy)) {
      missingItemKeys.push("import_placeholder_dates");
    }
  }
  if (property.documentCount <= 0) {
    missingItemKeys.push("documents");
  }
  if (!isNonEmpty(property.strataNotes)) {
    missingItemKeys.push("strata_notes");
  }

  const requiredMissingKeys = missingItemKeys.filter(
    (key) =>
      key !== "strata_notes" &&
      key !== "tenant_phone" &&
      key !== "security_deposit_zero" &&
      key !== "import_placeholder_dates",
  );

  const ownerInfoStatus: PortfolioHealthCategoryStatus = hasOwnerContact(property)
    ? "ok"
    : "missing";
  const strataNotesStatus: PortfolioHealthCategoryStatus = isNonEmpty(property.strataNotes)
    ? "ok"
    : "recommended";
  const activeTenantStatus: PortfolioHealthCategoryStatus = isVacant
    ? "not_applicable"
    : primaryTenancy
      ? "ok"
      : "missing";
  const tenantContactStatus: PortfolioHealthCategoryStatus = !occupied
    ? "not_applicable"
    : hasTenantName(tenantContact) && isNonEmpty(tenantContact?.email)
      ? isNonEmpty(tenantContact?.phone)
        ? "ok"
        : "recommended"
      : "missing";
  const leaseRentStatus: PortfolioHealthCategoryStatus = !occupied
    ? "not_applicable"
    : primaryTenancy &&
        primaryTenancy.leaseStartDate &&
        primaryTenancy.moveInDate &&
        primaryTenancy.monthlyRent > 0
      ? hasImportPlaceholderDates(primaryTenancy)
        ? "recommended"
        : "ok"
      : "missing";
  const documentsStatus: PortfolioHealthCategoryStatus =
    property.documentCount > 0 ? "ok" : "missing";

  const missingDocuments = missingItemKeys.includes("documents");
  const missingOwnerContact = missingItemKeys.includes("owner_contact");
  const missingTenantInfo =
    occupied &&
    (missingItemKeys.includes("tenant_name") ||
      missingItemKeys.includes("tenant_email") ||
      missingItemKeys.includes("tenant_phone") ||
      missingItemKeys.includes("active_tenancy"));
  const missingRentLeaseInfo =
    occupied &&
    (missingItemKeys.includes("monthly_rent_zero") ||
      missingItemKeys.includes("security_deposit_zero") ||
      missingItemKeys.includes("lease_start_date") ||
      missingItemKeys.includes("move_in_date") ||
      missingItemKeys.includes("import_placeholder_dates"));

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
    hasImportPlaceholders: missingItemKeys.includes("import_placeholder_dates"),
    missingDocuments,
    missingOwnerContact,
    missingTenantInfo,
    missingRentLeaseInfo,
  };
}

export function summarizePortfolioHealth(rows: PortfolioHealthRow[]): PortfolioHealthSummary {
  return {
    total: rows.length,
    complete: rows.filter((row) => row.overallStatus === "complete").length,
    needsReview: rows.filter((row) => row.overallStatus === "needs_review").length,
    missingDocuments: rows.filter((row) => row.missingDocuments).length,
    missingOwnerContact: rows.filter((row) => row.missingOwnerContact).length,
    missingTenantInfo: rows.filter((row) => row.missingTenantInfo).length,
    vacant: rows.filter((row) => row.isVacant).length,
  };
}

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
