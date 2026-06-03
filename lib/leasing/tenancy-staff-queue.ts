import prisma from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/services/errors";
import { listPropertiesForUser, listTenanciesForProperty } from "@/lib/services";
import type { StaffContext } from "@/lib/services/staff-context";

export type TenancyQueueRow = {
  id: string;
  status: string;
  propertyId: string;
  propertyName: string;
  unitLabel: string;
  tenantLabel: string | null;
  moveInDate: string | null;
  monthlyRent: string;
  createdAt: string;
};

function formatTenantLabel(
  contacts: { contactType: string; firstName: string; lastName: string; email: string }[],
): string | null {
  const tenant =
    contacts.find((c) => c.contactType === "tenant") ?? contacts[0] ?? null;
  if (!tenant) return null;
  const name = [tenant.firstName, tenant.lastName].filter(Boolean).join(" ").trim();
  return name || tenant.email;
}

export async function listTenancyQueueForStaff(ctx: StaffContext): Promise<TenancyQueueRow[]> {
  const properties = await listPropertiesForUser(prisma, ctx);
  const rows: TenancyQueueRow[] = [];

  for (const property of properties) {
    let tenancies;
    try {
      tenancies = await listTenanciesForProperty(prisma, ctx, property.id);
    } catch (e) {
      if (e instanceof ForbiddenError) continue;
      throw e;
    }

    if (tenancies.length === 0) continue;

    const unitIds = [...new Set(tenancies.map((t) => t.unitId))];
    const tenancyIds = tenancies.map((t) => t.id);

    const [units, contacts] = await Promise.all([
      prisma.unit.findMany({
        where: { id: { in: unitIds } },
        select: { id: true, unitNumber: true },
      }),
      prisma.tenancyContact.findMany({
        where: { tenancyId: { in: tenancyIds } },
        select: {
          tenancyId: true,
          contactType: true,
          firstName: true,
          lastName: true,
          email: true,
        },
        orderBy: [{ contactType: "asc" }, { lastName: "asc" }],
      }),
    ]);

    const unitById = new Map(units.map((u) => [u.id, u.unitNumber]));
    const contactsByTenancy = new Map<string, typeof contacts>();
    for (const c of contacts) {
      const list = contactsByTenancy.get(c.tenancyId) ?? [];
      list.push(c);
      contactsByTenancy.set(c.tenancyId, list);
    }

    for (const t of tenancies) {
      const unitNumber = unitById.get(t.unitId);
      rows.push({
        id: t.id,
        status: t.status,
        propertyId: property.id,
        propertyName: property.name,
        unitLabel: unitNumber ? `Unit ${unitNumber}` : "Unit",
        tenantLabel: formatTenantLabel(contactsByTenancy.get(t.id) ?? []),
        moveInDate: t.moveInDate.toISOString().slice(0, 10),
        monthlyRent: t.monthlyRent.toString(),
        createdAt: t.createdAt.toISOString(),
      });
    }
  }

  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return rows;
}
