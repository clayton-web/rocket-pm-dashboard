import { normalizeApplicationEmail } from "@/lib/leasing/application-email";
import {
  parseBcPropertyAddress,
  type ParsedBcPropertyAddress,
} from "@/lib/property/parse-bc-address";

export const PORTFOLIO_CSV_COLUMNS = {
  propertyAddress: "property address",
  tenantName: "tenant name",
  tenantEmail: "tenant email",
  tenantPhone: "tenant phone",
  ownerEmail: "owner email",
  ownerPhone: "owner phone",
  strataInformation: "strata information",
} as const;

export type PortfolioCsvRow = {
  rowNumber: number;
  propertyAddress: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
  ownerEmail: string;
  ownerPhone: string;
  strataInformation: string;
};

export type ParsedTenantName = {
  firstName: string;
  lastName: string;
};

const BASIC_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function splitTenantName(raw: string): ParsedTenantName | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: "Tenant name is required when tenant email is provided" };
  }

  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) {
    return { firstName: trimmed, lastName: "." };
  }

  const firstName = trimmed.slice(0, spaceIndex).trim();
  const lastName = trimmed.slice(spaceIndex + 1).trim();
  if (!firstName || !lastName) {
    return { error: "Tenant name must include a first and last name" };
  }

  return { firstName, lastName };
}

export function validateTenantEmail(raw: string): string | { error: string } {
  const normalized = normalizeApplicationEmail(raw);
  if (!normalized) {
    return { error: "Tenant email is required when tenant name is provided" };
  }
  if (!BASIC_EMAIL_RE.test(normalized)) {
    return { error: "Tenant email format is invalid" };
  }
  return normalized;
}

export function normalizeOptionalEmail(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  return BASIC_EMAIL_RE.test(trimmed) ? trimmed : null;
}

export function normalizeOptionalPhone(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed || null;
}

export function normalizeOptionalStrataNotes(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed || null;
}

export function hasTenantData(row: PortfolioCsvRow): boolean {
  return Boolean(row.tenantName.trim() || row.tenantEmail.trim());
}

export function mapCsvRecord(
  rowNumber: number,
  record: Record<string, string>,
): PortfolioCsvRow {
  return {
    rowNumber,
    propertyAddress: record[PORTFOLIO_CSV_COLUMNS.propertyAddress] ?? "",
    tenantName: record[PORTFOLIO_CSV_COLUMNS.tenantName] ?? "",
    tenantEmail: record[PORTFOLIO_CSV_COLUMNS.tenantEmail] ?? "",
    tenantPhone: record[PORTFOLIO_CSV_COLUMNS.tenantPhone] ?? "",
    ownerEmail: record[PORTFOLIO_CSV_COLUMNS.ownerEmail] ?? "",
    ownerPhone: record[PORTFOLIO_CSV_COLUMNS.ownerPhone] ?? "",
    strataInformation: record[PORTFOLIO_CSV_COLUMNS.strataInformation] ?? "",
  };
}

export type ValidatedPortfolioRow = {
  row: PortfolioCsvRow;
  address: ParsedBcPropertyAddress;
  ownerEmail: string | null;
  ownerPhone: string | null;
  strataNotes: string | null;
  tenant: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  } | null;
};

export function validatePortfolioRow(
  row: PortfolioCsvRow,
): ValidatedPortfolioRow | { error: string } {
  const address = parseBcPropertyAddress(row.propertyAddress);
  if ("error" in address) {
    return { error: address.error };
  }

  const ownerEmail = normalizeOptionalEmail(row.ownerEmail);
  const ownerPhone = normalizeOptionalPhone(row.ownerPhone);
  const strataNotes = normalizeOptionalStrataNotes(row.strataInformation);

  const tenantPresent = hasTenantData(row);
  if (!tenantPresent) {
    return { row, address, ownerEmail, ownerPhone, strataNotes, tenant: null };
  }

  const hasName = Boolean(row.tenantName.trim());
  const hasEmail = Boolean(row.tenantEmail.trim());
  if (hasName !== hasEmail) {
    return { error: "Tenant name and tenant email must both be provided or both be blank" };
  }

  const name = splitTenantName(row.tenantName);
  if ("error" in name) {
    return { error: name.error };
  }

  const email = validateTenantEmail(row.tenantEmail);
  if (typeof email === "object") {
    return { error: email.error };
  }

  return {
    row,
    address,
    ownerEmail,
    ownerPhone,
    strataNotes,
    tenant: {
      firstName: name.firstName,
      lastName: name.lastName,
      email,
      phone: normalizeOptionalPhone(row.tenantPhone),
    },
  };
}

export function portfolioImportPlaceholderDate(): Date {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  d.setUTCMonth(d.getUTCMonth(), 1);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

/** Heuristic for dates written by portfolio CSV import (1st of month, UTC noon, at least one year ago). */
export function isPortfolioImportPlaceholderDate(date: Date | null | undefined): boolean {
  if (!date) return false;
  const now = new Date();
  return (
    date.getUTCDate() === 1 &&
    date.getUTCHours() === 12 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0 &&
    date.getUTCFullYear() <= now.getUTCFullYear() - 1
  );
}
