const BASIC_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseTenancyDateField(
  value: unknown,
  field: string,
  required: boolean,
): string | undefined | { error: string } {
  if (value === undefined || value === null || value === "") {
    if (required) return { error: `${field} is required` };
    return undefined;
  }
  if (typeof value !== "string") return { error: `Invalid ${field}` };
  const trimmed = value.trim();
  if (!trimmed) {
    if (required) return { error: `${field} is required` };
    return undefined;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { error: `${field} must be YYYY-MM-DD` };
  }
  const d = new Date(`${trimmed}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return { error: `Invalid ${field}` };
  return trimmed;
}

export function parseTenancyMoneyField(
  value: unknown,
  field: string,
  required: boolean,
): number | undefined | { error: string } {
  if (value === undefined || value === null || value === "") {
    if (required) return { error: `${field} is required` };
    return undefined;
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return { error: `${field} must be a non-negative number` };
  }
  return n;
}

export function parseTenancyNotesField(
  value: unknown,
  field: string,
  maxLen: number,
): string | { error: string } {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return { error: `Invalid ${field}` };
  const trimmed = value.trim();
  if (trimmed.length > maxLen) return { error: `${field} is too long` };
  return trimmed;
}

export function parseTenancyOptionalEmail(value: unknown): string | { error: string } {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return { error: "Invalid tenant email" };
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  if (!BASIC_EMAIL_RE.test(trimmed)) {
    return { error: "Tenant email format is invalid" };
  }
  return trimmed;
}

export function parseTenancyOptionalPhone(value: unknown): string | null | { error: string } {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return { error: "Invalid tenant phone" };
  const trimmed = value.trim();
  return trimmed || null;
}

export function parseTenancyTenantNameFields(
  firstNameRaw: unknown,
  lastNameRaw: unknown,
): { firstName: string; lastName: string } | { error: string } {
  if (typeof firstNameRaw !== "string" || typeof lastNameRaw !== "string") {
    return { error: "Tenant name is required" };
  }
  const firstName = firstNameRaw.trim();
  const lastName = lastNameRaw.trim();
  if (!firstName) return { error: "First name is required" };
  if (!lastName) return { error: "Last name is required" };
  return { firstName, lastName };
}

export function parseTenancyPortalAccess(value: unknown): boolean | { error: string } {
  if (value === true || value === "true" || value === "on") return true;
  if (value === false || value === "false" || value === "off" || value === "") return false;
  return { error: "Invalid portal access value" };
}
