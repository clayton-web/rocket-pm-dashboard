import type { PrismaClient } from "@prisma/client";
import { formatPropertyAddress, propertyDisplaySelect } from "@/lib/property/display";

export type LeaseSigningEmailRecipient = {
  email: string;
  tenantName: string;
  propertyName: string | null;
  unitLabel: string | null;
};

export async function loadLeaseSigningEmailRecipient(
  prisma: PrismaClient,
  tenancyId: string,
): Promise<LeaseSigningEmailRecipient | null> {
  const tenancy = await prisma.tenancy.findUnique({
    where: { id: tenancyId },
    select: {
      property: { select: propertyDisplaySelect },
      unit: { select: { unitNumber: true } },
      contacts: {
        where: { contactType: { in: ["tenant", "co_tenant"] } },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  const contact = tenancy?.contacts[0];
  if (!contact?.email?.trim()) {
    return null;
  }

  const tenantName = `${contact.firstName} ${contact.lastName}`.trim() || "Tenant";

  return {
    email: contact.email.trim(),
    tenantName,
    propertyName: tenancy?.property ? formatPropertyAddress(tenancy.property) : null,
    unitLabel: tenancy?.unit?.unitNumber ?? null,
  };
}
