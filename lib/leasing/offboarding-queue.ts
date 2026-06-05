import prisma from "@/lib/db/prisma";
import { formatPropertyAddress, formatUnitLabelOrDash } from "@/lib/property/display";
import { ForbiddenError } from "@/lib/services/errors";
import { listPropertiesForUser, listTenanciesForProperty } from "@/lib/services";
import type { StaffContext } from "@/lib/services/staff-context";
import type { TenancyStatus } from "@prisma/client";

export type OffboardingTenancyQueueRow = {
  id: string;
  status: string;
  propertyId: string;
  propertyName: string;
  unitLabel: string;
  tenantLabel: string | null;
  moveOutDate: string | null;
  inspectionDate: string | null;
  updatedAt: string;
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

async function listTenanciesByStatusForStaff(
  ctx: StaffContext,
  status: TenancyStatus,
): Promise<OffboardingTenancyQueueRow[]> {
  const properties = await listPropertiesForUser(prisma, ctx);
  const rows: OffboardingTenancyQueueRow[] = [];

  for (const property of properties) {
    let tenancies;
    try {
      tenancies = await listTenanciesForProperty(prisma, ctx, property.id, { status });
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
        propertyName: formatPropertyAddress(property),
        unitLabel: formatUnitLabelOrDash(unitNumber),
        tenantLabel: formatTenantLabel(contactsByTenancy.get(t.id) ?? []),
        moveOutDate: t.moveOutDate?.toISOString().slice(0, 10) ?? null,
        inspectionDate: t.inspectionDate?.toISOString().slice(0, 10) ?? null,
        updatedAt: t.updatedAt.toISOString(),
      });
    }
  }

  rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return rows;
}

export function listTenanciesAwaitingInspectionScheduleForStaff(
  ctx: StaffContext,
): Promise<OffboardingTenancyQueueRow[]> {
  return listTenanciesByStatusForStaff(ctx, "move_out_scheduled");
}

export function listTenanciesAwaitingInspectionCompleteForStaff(
  ctx: StaffContext,
): Promise<OffboardingTenancyQueueRow[]> {
  return listTenanciesByStatusForStaff(ctx, "inspection_scheduled");
}
