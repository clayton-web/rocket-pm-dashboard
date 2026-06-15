import type { TenancyStatus } from "@prisma/client";
import {
  parseTenancyDateField,
  parseTenancyMoneyField,
  parseTenancyNotesField,
  parseTenancyOptionalEmail,
  parseTenancyOptionalPhone,
  parseTenancyPortalAccess,
  parseTenancyTenantNameFields,
} from "@/lib/validation/tenancy-fields";

const EDITABLE_TENANCY_STATUSES: ReadonlySet<TenancyStatus> = new Set([
  "pending_move_in",
  "active",
  "notice_received",
  "move_out_scheduled",
  "inspection_scheduled",
  "inspection_completed",
  "ended",
  "archived",
]);

export type TenancyEditFormInput = {
  contactId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  portalAccessEnabled: boolean;
  monthlyRent: number;
  securityDeposit: number;
  leaseStartDate: string;
  moveInDate: string;
  leaseEndDate: string | null;
  status: TenancyStatus;
  parkingDescription: string;
  storageDescription: string;
  petDetails: string;
};

function isValidationError(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value;
}

function parseTenancyStatusField(value: unknown): TenancyStatus | { error: string } {
  if (typeof value !== "string" || !value.trim()) {
    return { error: "Tenancy status is required" };
  }
  const status = value.trim() as TenancyStatus;
  if (!EDITABLE_TENANCY_STATUSES.has(status)) {
    return { error: "Invalid tenancy status" };
  }
  return status;
}

export function parseTenancyEditFormInput(
  body: unknown,
): TenancyEditFormInput | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid form data" };
  }
  const o = body as Record<string, unknown>;

  const contactId = typeof o.contactId === "string" ? o.contactId.trim() : "";
  if (!contactId) return { error: "Tenant contact is required" };

  const name = parseTenancyTenantNameFields(o.firstName, o.lastName);
  if (isValidationError(name)) return name;

  const email = parseTenancyOptionalEmail(o.email);
  if (isValidationError(email)) return email;

  const phone = parseTenancyOptionalPhone(o.phone);
  if (isValidationError(phone)) return phone;

  const portalAccessEnabled = parseTenancyPortalAccess(o.portalAccessEnabled);
  if (isValidationError(portalAccessEnabled)) return portalAccessEnabled;

  const leaseStartDate = parseTenancyDateField(o.leaseStartDate, "Lease start date", true);
  if (isValidationError(leaseStartDate)) return leaseStartDate;

  const moveInDate = parseTenancyDateField(o.moveInDate, "Move-in date", true);
  if (isValidationError(moveInDate)) return moveInDate;

  const leaseEndDate = parseTenancyDateField(o.leaseEndDate, "Lease end date", false);
  if (isValidationError(leaseEndDate)) return leaseEndDate;

  const monthlyRent = parseTenancyMoneyField(o.monthlyRent, "Monthly rent", true);
  if (isValidationError(monthlyRent)) return monthlyRent;

  const securityDeposit = parseTenancyMoneyField(o.securityDeposit, "Security deposit", true);
  if (isValidationError(securityDeposit)) return securityDeposit;

  const status = parseTenancyStatusField(o.status);
  if (isValidationError(status)) return status;

  const parkingDescription = parseTenancyNotesField(o.parkingDescription, "Parking notes", 500);
  if (isValidationError(parkingDescription)) return parkingDescription;

  const storageDescription = parseTenancyNotesField(o.storageDescription, "Storage notes", 500);
  if (isValidationError(storageDescription)) return storageDescription;

  const petDetails = parseTenancyNotesField(o.petDetails, "Pet notes", 2000);
  if (isValidationError(petDetails)) return petDetails;

  return {
    contactId,
    firstName: name.firstName,
    lastName: name.lastName,
    email,
    phone,
    portalAccessEnabled,
    monthlyRent: monthlyRent!,
    securityDeposit: securityDeposit!,
    leaseStartDate: leaseStartDate!,
    moveInDate: moveInDate!,
    leaseEndDate: leaseEndDate ?? null,
    status,
    parkingDescription,
    storageDescription,
    petDetails,
  };
}

export function tenancyEditDatesToServiceInput(parsed: TenancyEditFormInput): {
  leaseStartDate: Date;
  moveInDate: Date;
  leaseEndDate: Date | null;
} {
  return {
    leaseStartDate: new Date(`${parsed.leaseStartDate}T12:00:00.000Z`),
    moveInDate: new Date(`${parsed.moveInDate}T12:00:00.000Z`),
    leaseEndDate: parsed.leaseEndDate
      ? new Date(`${parsed.leaseEndDate}T12:00:00.000Z`)
      : null,
  };
}
