import prisma from "@/lib/db/prisma";
import type { OrganizationLandlordProfile } from "@/lib/leasing/lease-setup";
import type { StaffContext } from "@/lib/services/staff-context";
import { requireOrganizationAdmin } from "@/lib/services/property-access";
import { NotFoundError } from "@/lib/services/errors";
import type { OrganizationLandlordFormInput } from "@/lib/validation/organization-landlord";

export type OrganizationLandlordDetail = OrganizationLandlordProfile & {
  organizationId: string;
  organizationName: string;
};

export async function getOrganizationLandlordProfileForStaff(
  ctx: StaffContext,
): Promise<OrganizationLandlordDetail> {
  const org = await prisma.organization.findUnique({
    where: { id: ctx.organizationId },
    select: {
      id: true,
      name: true,
      landlordLegalName: true,
      landlordServiceStreetLine1: true,
      landlordServiceStreetLine2: true,
      landlordServiceCity: true,
      landlordServiceProvince: true,
      landlordServicePostalCode: true,
      landlordServicePhone: true,
      landlordServiceEmail: true,
      landlordIsAgent: true,
    },
  });
  if (!org) throw new NotFoundError("Organization not found");

  return {
    organizationId: org.id,
    organizationName: org.name,
    landlordLegalName: org.landlordLegalName,
    landlordServiceStreetLine1: org.landlordServiceStreetLine1,
    landlordServiceStreetLine2: org.landlordServiceStreetLine2,
    landlordServiceCity: org.landlordServiceCity,
    landlordServiceProvince: org.landlordServiceProvince,
    landlordServicePostalCode: org.landlordServicePostalCode,
    landlordServicePhone: org.landlordServicePhone,
    landlordServiceEmail: org.landlordServiceEmail,
    landlordIsAgent: org.landlordIsAgent,
  };
}

export async function updateOrganizationLandlordProfile(
  ctx: StaffContext,
  input: OrganizationLandlordFormInput,
): Promise<OrganizationLandlordDetail> {
  requireOrganizationAdmin(ctx);

  const org = await prisma.organization.update({
    where: { id: ctx.organizationId },
    data: {
      landlordLegalName: input.landlordLegalName,
      landlordServiceStreetLine1: input.landlordServiceStreetLine1,
      landlordServiceStreetLine2: input.landlordServiceStreetLine2,
      landlordServiceCity: input.landlordServiceCity,
      landlordServiceProvince: input.landlordServiceProvince,
      landlordServicePostalCode: input.landlordServicePostalCode,
      landlordServicePhone: input.landlordServicePhone,
      landlordServiceEmail: input.landlordServiceEmail,
      landlordIsAgent: input.landlordIsAgent,
    },
    select: {
      id: true,
      name: true,
      landlordLegalName: true,
      landlordServiceStreetLine1: true,
      landlordServiceStreetLine2: true,
      landlordServiceCity: true,
      landlordServiceProvince: true,
      landlordServicePostalCode: true,
      landlordServicePhone: true,
      landlordServiceEmail: true,
      landlordIsAgent: true,
    },
  });

  return {
    organizationId: org.id,
    organizationName: org.name,
    landlordLegalName: org.landlordLegalName,
    landlordServiceStreetLine1: org.landlordServiceStreetLine1,
    landlordServiceStreetLine2: org.landlordServiceStreetLine2,
    landlordServiceCity: org.landlordServiceCity,
    landlordServiceProvince: org.landlordServiceProvince,
    landlordServicePostalCode: org.landlordServicePostalCode,
    landlordServicePhone: org.landlordServicePhone,
    landlordServiceEmail: org.landlordServiceEmail,
    landlordIsAgent: org.landlordIsAgent,
  };
}
