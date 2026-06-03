import prisma from "@/lib/db/prisma";
import { getPublicPortalOrgSlug } from "@/lib/portal/public-org";
import { NotFoundError } from "@/lib/services/errors";

export type LeasingSubmitOption = {
  propertyId: string;
  propertyName: string;
  units: { unitId: string; unitNumber: string }[];
};

async function getPublicPortalOrganization() {
  const slug = getPublicPortalOrgSlug();
  return prisma.organization.findFirst({
    where: { slug },
    select: { id: true },
  });
}

/**
 * Active properties and units in the public portal org.
 * No dedicated "for rent" flag exists — uses `isActive` on property and unit only.
 */
export async function listPublicLeasingSubmitOptions(): Promise<LeasingSubmitOption[]> {
  const org = await getPublicPortalOrganization();
  if (!org) return [];

  const properties = await prisma.property.findMany({
    where: { organizationId: org.id, isActive: true },
    include: {
      units: {
        where: { isActive: true },
        orderBy: { unitNumber: "asc" },
        select: { id: true, unitNumber: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return properties.map((p) => ({
    propertyId: p.id,
    propertyName: p.name,
    units: p.units.map((u) => ({ unitId: u.id, unitNumber: u.unitNumber })),
  }));
}

/** Ensures the property belongs to the public portal org before public intake. */
export async function assertPropertyInPublicPortalOrg(propertyId: string): Promise<void> {
  const org = await getPublicPortalOrganization();
  if (!org) {
    throw new NotFoundError("Property not found or inactive");
  }

  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId: org.id, isActive: true },
    select: { id: true },
  });
  if (!property) {
    throw new NotFoundError("Property not found or inactive");
  }
}

/** Active unit on a public portal property (call after {@link assertPropertyInPublicPortalOrg}). */
export async function assertUnitInPublicPortalProperty(
  propertyId: string,
  unitId: string,
): Promise<void> {
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, propertyId, isActive: true },
    select: { id: true },
  });
  if (!unit) {
    throw new NotFoundError("Unit not found, inactive, or not on this property");
  }
}
