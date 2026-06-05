import prisma from "@/lib/db/prisma";
import {
  formatPropertyAddress,
  formatUnitLabelOrDash,
  propertyDisplaySelect,
} from "@/lib/property/display";
import { getAllowedMoveOutDates } from "@/lib/leasing/notice-rules";
import {
  formatMoveOutDateLabel,
  isAcceptedTenantEndNotice,
  isPendingTenantEndNotice,
  TENANT_NOTICE_TO_END_TYPE,
  tenancyToNoticeRules,
} from "@/lib/leasing/tenant-notice";
import { getNoticeById } from "@/lib/services/notice.service";
import type { StaffContext } from "@/lib/services/staff-context";
import { NotFoundError } from "@/lib/services/errors";

export type NoticeScheduleDateOption = {
  value: string;
  label: string;
};

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
  scheduledMoveOutDate: string | null;
  submittedAt: string;
  acceptedAt: string | null;
  tenancyStatus: string;
  canAccept: boolean;
  canSchedule: boolean;
  defaultScheduleDate: string | null;
  scheduleDateOptions: NoticeScheduleDateOption[];
};

function buildScheduleDateOptions(
  noticeCreatedAt: Date,
  tenancy: { rentDueDay: number; leaseEndDate: Date | null },
): NoticeScheduleDateOption[] {
  const allowed = getAllowedMoveOutDates(noticeCreatedAt, tenancyToNoticeRules(tenancy), {
    limit: 36,
  });
  return allowed.map((d) => {
    const value = formatMoveOutDateLabel(d);
    return {
      value,
      label: new Date(`${value}T12:00:00.000Z`).toLocaleDateString(undefined, {
        dateStyle: "long",
      }),
    };
  });
}

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
      select: propertyDisplaySelect,
    }),
    notice.unitId
      ? prisma.unit.findUnique({
          where: { id: notice.unitId },
          select: { unitNumber: true },
        })
      : Promise.resolve(null),
    prisma.tenancy.findUnique({
      where: { id: notice.tenancyId },
      select: {
        status: true,
        moveOutDate: true,
        rentDueDay: true,
        leaseEndDate: true,
      },
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
  const accepted = isAcceptedTenantEndNotice(notice);
  const canAccept = pending && tenancy.status === "active";
  const canSchedule =
    accepted &&
    tenancy.status === "notice_received" &&
    tenancy.moveOutDate == null;

  const scheduleDateOptions = canSchedule
    ? buildScheduleDateOptions(notice.createdAt, tenancy)
    : [];

  const defaultScheduleDate = formatMoveOutDateLabel(notice.tenantRequestedMoveOutDate);

  return {
    id: notice.id,
    tenancyId: notice.tenancyId,
    propertyId: notice.propertyId,
    propertyName: property ? formatPropertyAddress(property) : "Property",
    unitLabel: formatUnitLabelOrDash(unit?.unitNumber),
    tenantLabel: tenantName,
    tenantEmail: primary?.email ?? null,
    noticeType: notice.noticeType,
    title: notice.title,
    body: notice.body,
    tenantRequestedMoveOutDate: defaultScheduleDate,
    scheduledMoveOutDate: tenancy.moveOutDate
      ? formatMoveOutDateLabel(tenancy.moveOutDate)
      : null,
    submittedAt: notice.createdAt.toISOString(),
    acceptedAt: notice.servedAt?.toISOString() ?? null,
    tenancyStatus: tenancy.status,
    canAccept,
    canSchedule,
    defaultScheduleDate: canSchedule ? defaultScheduleDate : null,
    scheduleDateOptions,
  };
}
