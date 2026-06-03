import prisma from "@/lib/db/prisma";
import {
  formatMoveOutDateLabel,
  isPendingTenantEndNotice,
  TENANT_NOTICE_TO_END_TYPE,
} from "@/lib/leasing/tenant-notice";
import { getNoticeById } from "@/lib/services/notice.service";
import type { StaffContext } from "@/lib/services/staff-context";
import { NotFoundError } from "@/lib/services/errors";

export type NoticeStaffDetail = {
  id: string;
  tenancyId: string;
  propertyId: string;
  propertyName: string;
  unitLabel: string;
  tenantLabel: string;
  tenantEmail: string | null;
  noticeType: string;
  title: string;
  body: string;
  tenantRequestedMoveOutDate: string;
  submittedAt: string;
  tenancyStatus: string;
  canAccept: boolean;
};

export async function getNoticeDetailForStaff(
  ctx: StaffContext,
  noticeId: string,
): Promise<NoticeStaffDetail> {
  const notice = await getNoticeById(prisma, ctx, noticeId);

  if (notice.noticeType !== TENANT_NOTICE_TO_END_TYPE) {
    throw new NotFoundError("Notice not found");
  }
  if (notice.tenantRequestedMoveOutDate == null) {
    throw new NotFoundError("Notice not found");
  }

  const [property, unit, tenancy, contacts] = await Promise.all([
    prisma.property.findUnique({
      where: { id: notice.propertyId },
      select: { name: true },
    }),
    notice.unitId
      ? prisma.unit.findUnique({
          where: { id: notice.unitId },
          select: { unitNumber: true },
        })
      : Promise.resolve(null),
    prisma.tenancy.findUnique({
      where: { id: notice.tenancyId },
      select: { status: true },
    }),
    prisma.tenancyContact.findMany({
      where: { tenancyId: notice.tenancyId },
      select: {
        contactType: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      orderBy: [{ contactType: "asc" }, { lastName: "asc" }],
    }),
  ]);

  if (!tenancy) throw new NotFoundError("Tenancy not found");

  const primary =
    contacts.find((c) => c.contactType === "tenant") ?? contacts[0] ?? null;
  const tenantName = primary
    ? [primary.firstName, primary.lastName].filter(Boolean).join(" ").trim() || primary.email
    : "Tenant";

  const pending = isPendingTenantEndNotice(notice);
  const canAccept = pending && tenancy.status === "active";

  return {
    id: notice.id,
    tenancyId: notice.tenancyId,
    propertyId: notice.propertyId,
    propertyName: property?.name ?? "Property",
    unitLabel: unit?.unitNumber ? `Unit ${unit.unitNumber}` : "Unit",
    tenantLabel: tenantName,
    tenantEmail: primary?.email ?? null,
    noticeType: notice.noticeType,
    title: notice.title,
    body: notice.body,
    tenantRequestedMoveOutDate: formatMoveOutDateLabel(notice.tenantRequestedMoveOutDate),
    submittedAt: notice.createdAt.toISOString(),
    tenancyStatus: tenancy.status,
    canAccept,
  };
}
