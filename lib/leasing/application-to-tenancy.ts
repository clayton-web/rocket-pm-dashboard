import type { Application } from "@prisma/client";
import type { CreateTenancyContactInput } from "@/lib/services/tenancyContact.service";
import type { LeaseSetupJson } from "./lease-setup";

export function buildInitialLeaseSetupFromApplication(
  application: Pick<
    Application,
    "occupantCount" | "hasPets" | "petDetails"
  >,
  leaseEndDate: Date | null,
): LeaseSetupJson {
  const setup: LeaseSetupJson = {
    occupantCount: application.occupantCount ?? undefined,
    hasPets: application.hasPets,
    petDetails: application.petDetails ?? undefined,
    petDepositNotApplicable: !application.hasPets,
    rentPeriod: "month",
  };

  if (leaseEndDate) {
    setup.tenancyType = "fixed_term";
  }

  return setup;
}

export function buildEmergencyContactFromApplication(
  application: Pick<
    Application,
    | "emergencyContactFirstName"
    | "emergencyContactLastName"
    | "emergencyContactPhone"
    | "emergencyContactEmail"
    | "email"
  >,
): CreateTenancyContactInput | null {
  const firstName = application.emergencyContactFirstName?.trim() ?? "";
  const lastName = application.emergencyContactLastName?.trim() ?? "";
  const phone = application.emergencyContactPhone?.trim() ?? "";

  if (!firstName || !lastName || !phone) {
    return null;
  }

  const email =
    application.emergencyContactEmail?.trim() ||
    application.email?.trim() ||
    "";

  if (!email) {
    return null;
  }

  return {
    firstName,
    lastName,
    email,
    phone,
    contactType: "emergency_contact",
    portalAccessEnabled: false,
  };
}
