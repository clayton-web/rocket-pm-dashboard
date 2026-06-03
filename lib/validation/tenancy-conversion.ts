export type ConvertTenancyFormInput = {
  leaseStartDate: string;
  moveInDate: string;
  leaseEndDate?: string;
  moveOutDate?: string;
  monthlyRent: number;
  securityDeposit: number;
  petDeposit?: number;
};

function parseDateField(
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

function parseMoney(value: unknown, field: string, required: boolean): number | undefined | { error: string } {
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

export function parseConvertTenancyFormInput(
  body: unknown,
): ConvertTenancyFormInput | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid form data" };
  }
  const o = body as Record<string, unknown>;

  const leaseStartDate = parseDateField(o.leaseStartDate, "leaseStartDate", true);
  if (typeof leaseStartDate === "object") return leaseStartDate;

  const moveInDate = parseDateField(o.moveInDate, "moveInDate", true);
  if (typeof moveInDate === "object") return moveInDate;

  const leaseEndDate = parseDateField(o.leaseEndDate, "leaseEndDate", false);
  if (typeof leaseEndDate === "object") return leaseEndDate;

  const moveOutDate = parseDateField(o.moveOutDate, "moveOutDate", false);
  if (typeof moveOutDate === "object") return moveOutDate;

  const monthlyRent = parseMoney(o.monthlyRent, "monthlyRent", true);
  if (typeof monthlyRent === "object") return monthlyRent;

  const securityDeposit = parseMoney(o.securityDeposit, "securityDeposit", true);
  if (typeof securityDeposit === "object") return securityDeposit;

  const petDeposit = parseMoney(o.petDeposit, "petDeposit", false);
  if (typeof petDeposit === "object") return petDeposit;

  return {
    leaseStartDate: leaseStartDate!,
    moveInDate: moveInDate!,
    leaseEndDate,
    moveOutDate,
    monthlyRent: monthlyRent!,
    securityDeposit: securityDeposit!,
    petDeposit,
  };
}

export function convertFormDatesToServiceInput(parsed: ConvertTenancyFormInput): {
  leaseStartDate: Date;
  moveInDate: Date;
  leaseEndDate: Date | null;
  moveOutDate: Date | null;
  monthlyRent: number;
  securityDeposit: number;
  petDeposit: number | null;
} {
  return {
    leaseStartDate: new Date(`${parsed.leaseStartDate}T12:00:00.000Z`),
    moveInDate: new Date(`${parsed.moveInDate}T12:00:00.000Z`),
    leaseEndDate: parsed.leaseEndDate ? new Date(`${parsed.leaseEndDate}T12:00:00.000Z`) : null,
    moveOutDate: parsed.moveOutDate ? new Date(`${parsed.moveOutDate}T12:00:00.000Z`) : null,
    monthlyRent: parsed.monthlyRent,
    securityDeposit: parsed.securityDeposit,
    petDeposit: parsed.petDeposit ?? null,
  };
}
