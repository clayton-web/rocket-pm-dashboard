import prisma from "@/lib/db/prisma";
import {
  assessPortfolioHealthProperty,
  buildPortfolioHealthUnitInput,
  summarizePortfolioHealth,
  type PortfolioHealthPropertyInput,
  type PortfolioHealthRow,
  type PortfolioHealthSummary,
  type PortfolioHealthTenancyInput,
  type PortfolioHealthTenantContactInput,
} from "@/lib/property/portfolio-health";
import { listPropertiesForUser } from "@/lib/services/property.service";
import type { StaffContext } from "@/lib/services/staff-context";

export function filterPropertiesForPortfolioHealth<T extends { isActive: boolean }>(
  properties: T[],
): T[] {
  return properties.filter((property) => property.isActive);
}

const CURRENT_TENANCY_STATUSES = [
  "pending_move_in",
  "active",
  "notice_received",
  "move_out_scheduled",
  "inspection_scheduled",
  "inspection_completed",
] as const;

export type PortfolioHealthPageData = {
  rows: PortfolioHealthRow[];
  summary: PortfolioHealthSummary;
};

export async function loadPortfolioHealthForStaff(
  ctx: StaffContext,
): Promise<PortfolioHealthPageData> {
  const allProperties = await listPropertiesForUser(prisma, ctx);
  const properties = filterPropertiesForPortfolioHealth(allProperties);
  const propertyIds = properties.map((property) => property.id);

  if (propertyIds.length === 0) {
    return { rows: [], summary: summarizePortfolioHealth([]) };
  }

  const [documentCounts, units, tenancies] = await Promise.all([
    prisma.document.groupBy({
      by: ["propertyId"],
      where: { propertyId: { in: propertyIds } },
      _count: { _all: true },
    }),
    prisma.unit.findMany({
      where: { propertyId: { in: propertyIds }, isActive: true },
      select: {
        id: true,
        propertyId: true,
        unitNumber: true,
      },
      orderBy: [{ propertyId: "asc" }, { unitNumber: "asc" }],
    }),
    prisma.tenancy.findMany({
      where: {
        propertyId: { in: propertyIds },
        status: { in: [...CURRENT_TENANCY_STATUSES] },
      },
      select: {
        id: true,
        propertyId: true,
        unitId: true,
        status: true,
        leaseStartDate: true,
        moveInDate: true,
        monthlyRent: true,
        securityDeposit: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  const tenancyIds = tenancies.map((tenancy) => tenancy.id);
  const contacts =
    tenancyIds.length === 0
      ? []
      : await prisma.tenancyContact.findMany({
          where: { tenancyId: { in: tenancyIds } },
          select: {
            tenancyId: true,
            contactType: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
          orderBy: [{ contactType: "asc" }, { lastName: "asc" }],
        });

  const documentCountByProperty = new Map(
    documentCounts.map((row) => [row.propertyId, row._count._all]),
  );
  const unitsByProperty = new Map<string, typeof units>();
  for (const unit of units) {
    const list = unitsByProperty.get(unit.propertyId) ?? [];
    list.push(unit);
    unitsByProperty.set(unit.propertyId, list);
  }
  const tenanciesByProperty = new Map<string, typeof tenancies>();
  for (const tenancy of tenancies) {
    const list = tenanciesByProperty.get(tenancy.propertyId) ?? [];
    list.push(tenancy);
    tenanciesByProperty.set(tenancy.propertyId, list);
  }
  const contactsByTenancy = new Map<string, PortfolioHealthTenantContactInput[]>();
  for (const contact of contacts) {
    const list = contactsByTenancy.get(contact.tenancyId) ?? [];
    list.push({
      contactType: contact.contactType,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
    });
    contactsByTenancy.set(contact.tenancyId, list);
  }

  const rows = properties.map((property) => {
    const propertyUnits = unitsByProperty.get(property.id) ?? [];
    const propertyTenancies = tenanciesByProperty.get(property.id) ?? [];
    const tenancyInputs: PortfolioHealthTenancyInput[] = propertyTenancies.map((tenancy) => ({
      id: tenancy.id,
      unitId: tenancy.unitId,
      status: tenancy.status,
      leaseStartDate: tenancy.leaseStartDate,
      moveInDate: tenancy.moveInDate,
      monthlyRent: Number(tenancy.monthlyRent),
      securityDeposit: Number(tenancy.securityDeposit),
      createdAt: tenancy.createdAt,
    }));

    const input: PortfolioHealthPropertyInput = {
      id: property.id,
      name: property.name,
      streetLine1: property.streetLine1,
      streetLine2: property.streetLine2,
      city: property.city,
      province: property.province,
      postalCode: property.postalCode,
      ownerEmail: property.ownerEmail,
      ownerPhone: property.ownerPhone,
      strataNotes: property.strataNotes,
      documentCount: documentCountByProperty.get(property.id) ?? 0,
      units: propertyUnits.map((unit) =>
        buildPortfolioHealthUnitInput(
          unit.id,
          unit.unitNumber,
          tenancyInputs,
          contactsByTenancy,
        ),
      ),
    };

    return assessPortfolioHealthProperty(input);
  });

  return {
    rows,
    summary: summarizePortfolioHealth(rows),
  };
}
