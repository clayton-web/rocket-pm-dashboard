import {
  RTB_SERVICE_KEYS,
  type FixedTermEndBehavior,
  type LeaseSetupJson,
  type RentPeriod,
  type RtbServiceKey,
  type TenancyType,
} from "@/lib/leasing/lease-setup";

export type LeaseSetupFormInput = LeaseSetupJson & {
  tenancyType: TenancyType;
  rentPeriod: RentPeriod;
  servicesIncluded: Record<RtbServiceKey, boolean>;
};

function parseOptionalString(
  value: unknown,
  field: string,
  maxLen: number,
): string | undefined | { error: string } {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return { error: `Invalid ${field}` };
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLen) return { error: `${field} is too long` };
  return trimmed;
}

function parseDateField(value: unknown, field: string): string | undefined | { error: string } {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return { error: `Invalid ${field}` };
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { error: `${field} must be YYYY-MM-DD` };
  }
  const d = new Date(`${trimmed}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return { error: `Invalid ${field}` };
  return trimmed;
}

function parseOptionalInt(
  value: unknown,
  field: string,
): number | undefined | { error: string } {
  if (value === undefined || value === null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    return { error: `${field} must be a non-negative integer` };
  }
  return n;
}

function parseTenancyType(value: unknown): TenancyType | { error: string } {
  if (value === "month_to_month" || value === "fixed_term") return value;
  return { error: "Tenancy type is required" };
}

function parseRentPeriod(value: unknown): RentPeriod | { error: string } {
  if (value === "day" || value === "week" || value === "month") return value;
  return { error: "Rent period is required" };
}

function parseFixedTermEndBehavior(
  value: unknown,
): FixedTermEndBehavior | undefined | { error: string } {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === "continue" || value === "vacate") return value;
  return { error: "Invalid fixed-term end behavior" };
}

function parseServicesIncluded(
  value: unknown,
): Record<RtbServiceKey, boolean> | { error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { error: "Services and utilities confirmation is required" };
  }
  const raw = value as Record<string, unknown>;
  const services = {} as Record<RtbServiceKey, boolean>;
  for (const key of RTB_SERVICE_KEYS) {
    const v = raw[key];
    services[key] = v === true || v === "true";
  }
  return services;
}

export function parseLeaseSetupFormInput(
  body: unknown,
): LeaseSetupFormInput | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid form data" };
  }
  const raw = body as Record<string, unknown>;

  const tenancyType = parseTenancyType(raw.tenancyType);
  if (typeof tenancyType === "object") return tenancyType;

  const rentPeriod = parseRentPeriod(raw.rentPeriod);
  if (typeof rentPeriod === "object") return rentPeriod;

  const servicesIncluded = parseServicesIncluded(raw.servicesIncluded);
  if ("error" in servicesIncluded) return servicesIncluded;

  const fixedTermEndBehavior = parseFixedTermEndBehavior(raw.fixedTermEndBehavior);
  if (typeof fixedTermEndBehavior === "object" && fixedTermEndBehavior !== undefined && "error" in fixedTermEndBehavior) {
    return fixedTermEndBehavior;
  }

  const securityDepositDueDate = parseDateField(
    raw.securityDepositDueDate,
    "Security deposit due date",
  );
  if (typeof securityDepositDueDate === "object" && securityDepositDueDate !== undefined && "error" in securityDepositDueDate) {
    return securityDepositDueDate;
  }

  const petDepositDueDate = parseDateField(raw.petDepositDueDate, "Pet deposit due date");
  if (typeof petDepositDueDate === "object" && petDepositDueDate !== undefined && "error" in petDepositDueDate) {
    return petDepositDueDate;
  }

  const vacateReason = parseOptionalString(raw.vacateReason, "Vacate reason", 2000);
  if (typeof vacateReason === "object" && vacateReason !== undefined && "error" in vacateReason) {
    return vacateReason;
  }

  const vacateRtrSection = parseOptionalString(raw.vacateRtrSection, "RTA section", 200);
  if (typeof vacateRtrSection === "object" && vacateRtrSection !== undefined && "error" in vacateRtrSection) {
    return vacateRtrSection;
  }

  const parkingDescription = parseOptionalString(raw.parkingDescription, "Parking details", 500);
  if (typeof parkingDescription === "object" && parkingDescription !== undefined && "error" in parkingDescription) {
    return parkingDescription;
  }

  const storageDescription = parseOptionalString(raw.storageDescription, "Storage details", 500);
  if (typeof storageDescription === "object" && storageDescription !== undefined && "error" in storageDescription) {
    return storageDescription;
  }

  const addendumPageCount = parseOptionalInt(raw.addendumPageCount, "Addendum page count");
  if (typeof addendumPageCount === "object" && addendumPageCount !== undefined && "error" in addendumPageCount) {
    return addendumPageCount;
  }

  const addendumTermCount = parseOptionalInt(raw.addendumTermCount, "Addendum term count");
  if (typeof addendumTermCount === "object" && addendumTermCount !== undefined && "error" in addendumTermCount) {
    return addendumTermCount;
  }

  const petDepositNotApplicable =
    raw.petDepositNotApplicable === true || raw.petDepositNotApplicable === "true";
  const vacateClauseAttested =
    raw.vacateClauseAttested === true || raw.vacateClauseAttested === "true";
  const addendumAttached = raw.addendumAttached === true || raw.addendumAttached === "true";

  return {
    tenancyType,
    rentPeriod,
    servicesIncluded,
    fixedTermEndBehavior,
    vacateReason,
    vacateRtrSection,
    vacateClauseAttested: vacateClauseAttested || undefined,
    securityDepositDueDate,
    petDepositDueDate,
    petDepositNotApplicable: petDepositNotApplicable || undefined,
    parkingDescription,
    storageDescription,
    addendumAttached: addendumAttached || undefined,
    addendumPageCount,
    addendumTermCount,
  };
}

export function leaseSetupFormToJson(parsed: LeaseSetupFormInput): LeaseSetupJson {
  return {
    tenancyType: parsed.tenancyType,
    rentPeriod: parsed.rentPeriod,
    fixedTermEndBehavior: parsed.fixedTermEndBehavior,
    vacateReason: parsed.vacateReason,
    vacateRtrSection: parsed.vacateRtrSection,
    vacateClauseAttested: parsed.vacateClauseAttested,
    securityDepositDueDate: parsed.securityDepositDueDate,
    petDepositDueDate: parsed.petDepositDueDate,
    petDepositNotApplicable: parsed.petDepositNotApplicable,
    servicesIncluded: parsed.servicesIncluded,
    parkingDescription: parsed.parkingDescription,
    storageDescription: parsed.storageDescription,
    addendumAttached: parsed.addendumAttached,
    addendumPageCount: parsed.addendumPageCount,
    addendumTermCount: parsed.addendumTermCount,
  };
}
