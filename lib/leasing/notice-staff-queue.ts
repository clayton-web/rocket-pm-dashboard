import prisma from "@/lib/db/prisma";
import { formatMoveOutDateLabel, TENANT_NOTICE_TO_END_TYPE } from "@/lib/leasing/tenant-notice";
import { ForbiddenError } from "@/lib/services/errors";
import { listPropertiesForUser } from "@/lib/services";
import type { StaffContext } from "@/lib/services/staff-context";

export type NoticeQueueRow = {
  id: string;
  tenancyId: string;
  propertyId: string;
  propertyName: string;
  unitLabel: string;
  tenantLabel: string | null;
  tenantRequestedMoveOutDate: string;
  submittedAt: string;
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

export async function listNoticeQueueForStaff(ctx: StaffContext): Promise<NoticeQueueRow[]> {
  const properties = await listPropertiesForUser(prisma, ctx);
  const rows: NoticeQueueRow[] = [];

  for (const property of properties) {
    let notices;
    try {
      notices = await prisma.notice.findMany({
        where: {
          propertyId: property.id,
          noticeType: TENANT_NOTICE_TO_END_TYPE,
          servedAt: null,
          tenantRequestedMoveOutDate: { not: null },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          tenancyId: true,
          propertyId: true,
          unitId: true,
          createdAt: true,
          tenantRequestedMoveOutDate: true,
        },
      });
    } catch (e) {
      if (e instanceof ForbiddenError) continue;
      throw e;
    }

    if (notices.length === 0) continue;

    const tenancyIds = [...new Set(notices.map((n) => n.tenancyId))];
    const unitIds = [...new Set(notices.map((n) => n.unitId).filter(Boolean))] as string[];

    const [contacts, units] = await Promise.all([
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
      unitIds.length > 0
        ? prisma.unit.findMany({
            where: { id: { in: unitIds } },
            select: { id: true, unitNumber: true },
          })
        : Promise.resolve([]),
    ]);

    const contactsByTenancy = new Map<string, typeof contacts>();
    for (const c of contacts) {
      const list = contactsByTenancy.get(c.tenancyId) ?? [];
      list.push(c);
      contactsByTenancy.set(c.tenancyId, list);
    }
    const unitById = new Map(units.map((u) => [u.id, u.unitNumber]));

    for (const notice of notices) {
      const unitNumber = notice.unitId ? unitById.get(notice.unitId) : undefined;
      rows.push({
        id: notice.id,
        tenancyId: notice.tenancyId,
        propertyId: notice.propertyId,
        propertyName: property.name,
        unitLabel: unitNumber ? `Unit ${unitNumber}` : "Unit",
        tenantLabel: formatTenantLabel(contactsByTenancy.get(notice.tenancyId) ?? []),
        tenantRequestedMoveOutDate: formatMoveOutDateLabel(notice.tenantRequestedMoveOutDate!),
        submittedAt: notice.createdAt.toISOString(),
      });
    }
  }

  rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return rows;
}

/** Accepted tenant notices whose tenancy still needs move-out scheduling. */
export async function listNoticesAwaitingScheduleForStaff(
  ctx: StaffContext,
): Promise<NoticeQueueRow[]> {
  const properties = await listPropertiesForUser(prisma, ctx);
  const rows: NoticeQueueRow[] = [];

  for (const property of properties) {
    let notices;
    try {
      notices = await prisma.notice.findMany({
        where: {
          propertyId: property.id,
          noticeType: TENANT_NOTICE_TO_END_TYPE,
          servedAt: { not: null },
          tenantRequestedMoveOutDate: { not: null },
          tenancy: {
            status: "notice_received",
            moveOutDate: null,
          },
        },
        orderBy: { servedAt: "desc" },
        select: {
          id: true,
          tenancyId: true,
          propertyId: true,
          unitId: true,
          createdAt: true,
          servedAt: true,
          tenantRequestedMoveOutDate: true,
        },
      });
    } catch (e) {
      if (e instanceof ForbiddenError) continue;
      throw e;
    }

    if (notices.length === 0) continue;

    const tenancyIds = [...new Set(notices.map((n) => n.tenancyId))];
    const unitIds = [...new Set(notices.map((n) => n.unitId).filter(Boolean))] as string[];

    const [contacts, units] = await Promise.all([
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
      unitIds.length > 0
        ? prisma.unit.findMany({
            where: { id: { in: unitIds } },
            select: { id: true, unitNumber: true },
          })
        : Promise.resolve([]),
    ]);

    const contactsByTenancy = new Map<string, typeof contacts>();
    for (const c of contacts) {
      const list = contactsByTenancy.get(c.tenancyId) ?? [];
      list.push(c);
      contactsByTenancy.set(c.tenancyId, list);
    }
    const unitById = new Map(units.map((u) => [u.id, u.unitNumber]));

    for (const notice of notices) {
      const unitNumber = notice.unitId ? unitById.get(notice.unitId) : undefined;
      rows.push({
        id: notice.id,
        tenancyId: notice.tenancyId,
        propertyId: notice.propertyId,
        propertyName: property.name,
        unitLabel: unitNumber ? `Unit ${unitNumber}` : "Unit",
        tenantLabel: formatTenantLabel(contactsByTenancy.get(notice.tenancyId) ?? []),
        tenantRequestedMoveOutDate: formatMoveOutDateLabel(notice.tenantRequestedMoveOutDate!),
        submittedAt: (notice.servedAt ?? notice.createdAt).toISOString(),
      });
    }
  }

  rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return rows;
}
