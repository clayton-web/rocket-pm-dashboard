import type { PrismaClient } from "@prisma/client";
import { parseLeaseSetupJson, type LeaseSetupJson } from "@/lib/leasing/lease-setup";
import { deriveRentDueDayFromLeaseStart } from "@/lib/leasing/notice-rules";
import { getTenancyById, updateTenancy } from "@/lib/services/tenancy.service";
import { updateTenancyContact } from "@/lib/services/tenancyContact.service";
import type { StaffContext } from "@/lib/services/staff-context";
import {
  tenancyEditDatesToServiceInput,
  type TenancyEditFormInput,
} from "@/lib/validation/tenancy-edit";

export function mergeTenancyEditLeaseSetupNotes(
  existing: LeaseSetupJson,
  notes: Pick<TenancyEditFormInput, "parkingDescription" | "storageDescription" | "petDetails">,
): LeaseSetupJson {
  return {
    ...existing,
    parkingDescription: notes.parkingDescription || undefined,
    storageDescription: notes.storageDescription || undefined,
    petDetails: notes.petDetails || undefined,
  };
}

export async function applyTenancyDetailsUpdate(
  prisma: PrismaClient,
  ctx: StaffContext,
  tenancyId: string,
  parsed: TenancyEditFormInput,
): Promise<{ propertyId: string }> {
  const tenancy = await getTenancyById(prisma, ctx, tenancyId);
  const contact = await prisma.tenancyContact.findUnique({ where: { id: parsed.contactId } });
  if (!contact || contact.tenancyId !== tenancy.id) {
    throw new Error("Tenant contact does not belong to this tenancy");
  }

  await updateTenancyContact(prisma, ctx, parsed.contactId, {
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    email: parsed.email,
    phone: parsed.phone,
    portalAccessEnabled: parsed.portalAccessEnabled,
  });

  if (tenancy.applicationId) {
    await prisma.application.update({
      where: { id: tenancy.applicationId },
      data: {
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        email: parsed.email,
        phone: parsed.phone,
      },
    });
  }

  const dates = tenancyEditDatesToServiceInput(parsed);
  const existingSetup = parseLeaseSetupJson(tenancy.leaseSetupJson);
  const leaseSetupJson = mergeTenancyEditLeaseSetupNotes(existingSetup, {
    parkingDescription: parsed.parkingDescription,
    storageDescription: parsed.storageDescription,
    petDetails: parsed.petDetails,
  });

  await updateTenancy(prisma, ctx, tenancyId, {
    status: parsed.status,
    leaseStartDate: dates.leaseStartDate,
    moveInDate: dates.moveInDate,
    leaseEndDate: dates.leaseEndDate,
    monthlyRent: parsed.monthlyRent,
    securityDeposit: parsed.securityDeposit,
    rentDueDay: deriveRentDueDayFromLeaseStart(dates.leaseStartDate),
    leaseSetupJson,
  });

  return { propertyId: tenancy.propertyId };
}
