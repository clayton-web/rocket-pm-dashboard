import {
  parseTenancyDateField,
  parseTenancyMoneyField,
} from "@/lib/validation/tenancy-fields";

export type ConvertTenancyFormInput = {
  leaseStartDate: string;
  moveInDate: string;
  leaseEndDate?: string;
  moveOutDate?: string;
  monthlyRent: number;
  securityDeposit: number;
  petDeposit?: number;
};

function isValidationError(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value;
}

export function parseConvertTenancyFormInput(
  body: unknown,
): ConvertTenancyFormInput | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid form data" };
  }
  const o = body as Record<string, unknown>;

  const leaseStartDate = parseTenancyDateField(o.leaseStartDate, "leaseStartDate", true);
  if (isValidationError(leaseStartDate)) return leaseStartDate;

  const moveInDate = parseTenancyDateField(o.moveInDate, "moveInDate", true);
  if (isValidationError(moveInDate)) return moveInDate;

  const leaseEndDate = parseTenancyDateField(o.leaseEndDate, "leaseEndDate", false);
  if (isValidationError(leaseEndDate)) return leaseEndDate;

  const moveOutDate = parseTenancyDateField(o.moveOutDate, "moveOutDate", false);
  if (isValidationError(moveOutDate)) return moveOutDate;

  const monthlyRent = parseTenancyMoneyField(o.monthlyRent, "monthlyRent", true);
  if (isValidationError(monthlyRent)) return monthlyRent;

  const securityDeposit = parseTenancyMoneyField(o.securityDeposit, "securityDeposit", true);
  if (isValidationError(securityDeposit)) return securityDeposit;

  const petDeposit = parseTenancyMoneyField(o.petDeposit, "petDeposit", false);
  if (isValidationError(petDeposit)) return petDeposit;

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
