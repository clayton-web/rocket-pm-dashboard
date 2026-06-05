import { auth } from "@/auth";
import { PropertyList, type PropertyListRow } from "@/components/properties/property-list";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import prisma from "@/lib/db/prisma";
import { ENTIRE_PROPERTY_UNIT_NUMBER } from "@/lib/property/entire-property-unit";
import { hasOrgWidePropertyRights } from "@/lib/services/property-access";
import { listPropertiesForUser } from "@/lib/services/property.service";
import { redirect } from "next/navigation";

export default async function PropertiesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return (
      <PropertyList properties={[]} canCreate={false} loadError="Select an active organization to view properties." />
    );
  }

  try {
    const properties = await listPropertiesForUser(prisma, ctx);
    const unitCounts = await prisma.unit.groupBy({
      by: ["propertyId"],
      where: {
        propertyId: { in: properties.map((p) => p.id) },
        unitNumber: { not: ENTIRE_PROPERTY_UNIT_NUMBER },
      },
      _count: { _all: true },
    });
    const countByProperty = new Map(unitCounts.map((row) => [row.propertyId, row._count._all]));

    const rows: PropertyListRow[] = properties.map((property) => {
      const additionalUnitCount = countByProperty.get(property.id) ?? 0;
      return {
        id: property.id,
        name: property.name,
        streetLine1: property.streetLine1,
        streetLine2: property.streetLine2,
        city: property.city,
        province: property.province,
        postalCode: property.postalCode,
        additionalUnitCount: additionalUnitCount > 0 ? additionalUnitCount : null,
      };
    });

    return (
      <PropertyList
        properties={rows}
        canCreate={hasOrgWidePropertyRights(ctx)}
        loadError={null}
      />
    );
  } catch {
    return (
      <PropertyList properties={[]} canCreate={false} loadError="Could not load properties." />
    );
  }
}
