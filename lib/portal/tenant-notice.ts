import prisma from "@/lib/db/prisma";
import {
  computeEarliestValidMoveOutDate,
  getAllowedMoveOutDates,
} from "@/lib/leasing/notice-rules";
import {
  formatMoveOutDateLabel,
  pendingTenantEndNoticeWhere,
  tenancyToNoticeRules,
} from "@/lib/leasing/tenant-notice";
import type { TenantSessionPayload } from "@/lib/portal/tenant-auth";

export type TenantNoticeFormContext = {
  propertyName: string;
  unitLabel: string;
  rentDueDay: number;
  earliestMoveOutDate: string;
  allowedMoveOutDates: { value: string; label: string }[];
};

export type TenantPendingNoticeSummary = {
  id: string;
  tenantRequestedMoveOutDate: string;
  createdAt: string;
  body: string;
};

export async function getTenantNoticeFormContext(
  session: TenantSessionPayload,
): Promise<TenantNoticeFormContext | null> {
  const tenancy = await prisma.tenancy.findUnique({
    where: { id: session.tenancyId },
    select: {
      status: true,
      rentDueDay: true,
      leaseEndDate: true,
      property: { select: { name: true } },
      unit: { select: { unitNumber: true } },
    },
  });
  if (!tenancy || tenancy.status !== "active") return null;

  const rules = tenancyToNoticeRules(tenancy);
  const noticeGivenDate = new Date();
  const earliest = computeEarliestValidMoveOutDate(noticeGivenDate, rules);
  const allowed = getAllowedMoveOutDates(noticeGivenDate, rules, { limit: 36 });

  return {
    propertyName: tenancy.property.name,
    unitLabel: tenancy.unit.unitNumber ? `Unit ${tenancy.unit.unitNumber}` : "Unit",
    rentDueDay: tenancy.rentDueDay,
    earliestMoveOutDate: formatMoveOutDateLabel(earliest),
    allowedMoveOutDates: allowed.map((d) => {
      const value = formatMoveOutDateLabel(d);
      return {
        value,
        label: new Date(`${value}T12:00:00.000Z`).toLocaleDateString(undefined, {
          dateStyle: "long",
        }),
      };
    }),
  };
}

export async function getPendingTenantNoticeForSession(
  session: TenantSessionPayload,
): Promise<TenantPendingNoticeSummary | null> {
  const row = await prisma.notice.findFirst({
    where: pendingTenantEndNoticeWhere(session.tenancyId),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      body: true,
      createdAt: true,
      tenantRequestedMoveOutDate: true,
    },
  });
  if (!row?.tenantRequestedMoveOutDate) return null;

  return {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    tenantRequestedMoveOutDate: formatMoveOutDateLabel(row.tenantRequestedMoveOutDate),
  };
}
