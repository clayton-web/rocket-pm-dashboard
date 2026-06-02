import type { Notice, Prisma, PrismaClient } from "@prisma/client";
import type { StaffContext } from "./staff-context";
import { requirePropertyManagerAccess, requireStaff } from "./property-access";
import { NotFoundError } from "./errors";
import { logPropertyActivity, pickForAudit } from "./activityLog.service";

export type CreateNoticeInput = {
  propertyId: string;
  tenancyId: string;
  unitId?: string | null;
  noticeType: string;
  title: string;
  body: string;
  serviceMethod?: string | null;
  servedAt?: Date | null;
};

export type UpdateNoticeInput = {
  unitId?: string | null;
  noticeType?: string;
  title?: string;
  body?: string;
  serviceMethod?: string | null;
  servedAt?: Date | null;
};

async function getNoticeOrThrow(prisma: PrismaClient, id: string): Promise<Notice> {
  const row = await prisma.notice.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Notice not found");
  return row;
}

/**
 * Ensures notice targets align: tenancy on property; optional unit is the tenancy’s unit and on property.
 */
export async function assertNoticeScope(
  prisma: PrismaClient,
  input: Pick<CreateNoticeInput, "propertyId" | "tenancyId" | "unitId">
): Promise<void> {
  const tenancy = await prisma.tenancy.findUnique({ where: { id: input.tenancyId } });
  if (!tenancy) throw new NotFoundError("Tenancy not found");
  if (tenancy.propertyId !== input.propertyId) {
    throw new Error("tenancyId does not belong to propertyId");
  }

  if (input.unitId) {
    if (tenancy.unitId !== input.unitId) {
      throw new Error("unitId must match the tenancy unit when provided");
    }
    const unit = await prisma.unit.findFirst({
      where: { id: input.unitId, propertyId: input.propertyId },
    });
    if (!unit) throw new NotFoundError("Unit not found on this property");
  }
}

export async function createNotice(
  prisma: PrismaClient,
  principal: StaffContext,
  input: CreateNoticeInput
): Promise<Notice> {
  requireStaff(principal);
  await requirePropertyManagerAccess(prisma, principal, input.propertyId);
  await assertNoticeScope(prisma, input);

  const noticeType = input.noticeType.trim();
  const title = input.title.trim();
  const body = input.body.trim();
  if (!noticeType) throw new Error("noticeType is required");
  if (!title) throw new Error("title is required");
  if (!body) throw new Error("body is required");

  const row = await prisma.notice.create({
    data: {
      propertyId: input.propertyId,
      tenancyId: input.tenancyId,
      unitId: input.unitId ?? null,
      noticeType,
      title,
      body,
      serviceMethod: input.serviceMethod?.trim() || null,
      servedAt: input.servedAt ?? null,
    },
  });
  await logPropertyActivity(prisma, principal, row.propertyId, "Notice", row.id, "notice.created", {
    newValues: pickForAudit(row, ["tenancyId", "unitId", "noticeType", "title", "servedAt"]),
  });
  return row;
}

export async function getNoticeById(
  prisma: PrismaClient,
  principal: StaffContext,
  id: string
): Promise<Notice> {
  requireStaff(principal);
  const row = await getNoticeOrThrow(prisma, id);
  await requirePropertyManagerAccess(prisma, principal, row.propertyId);
  return row;
}

export async function listNoticesForProperty(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
  options?: { tenancyId?: string }
): Promise<Notice[]> {
  requireStaff(principal);
  await requirePropertyManagerAccess(prisma, principal, propertyId);
  return prisma.notice.findMany({
    where: {
      propertyId,
      ...(options?.tenancyId !== undefined ? { tenancyId: options.tenancyId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listNoticesForTenancy(
  prisma: PrismaClient,
  principal: StaffContext,
  tenancyId: string
): Promise<Notice[]> {
  requireStaff(principal);
  const tenancy = await prisma.tenancy.findUnique({ where: { id: tenancyId } });
  if (!tenancy) throw new NotFoundError("Tenancy not found");
  await requirePropertyManagerAccess(prisma, principal, tenancy.propertyId);
  return prisma.notice.findMany({
    where: { tenancyId },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateNotice(
  prisma: PrismaClient,
  principal: StaffContext,
  id: string,
  input: UpdateNoticeInput
): Promise<Notice> {
  requireStaff(principal);
  const existing = await getNoticeOrThrow(prisma, id);
  await requirePropertyManagerAccess(prisma, principal, existing.propertyId);

  const data: Prisma.NoticeUncheckedUpdateInput = {};
  if (input.noticeType !== undefined) {
    const v = input.noticeType.trim();
    if (!v) throw new Error("noticeType cannot be empty");
    data.noticeType = v;
  }
  if (input.title !== undefined) {
    const v = input.title.trim();
    if (!v) throw new Error("title cannot be empty");
    data.title = v;
  }
  if (input.body !== undefined) {
    const v = input.body.trim();
    if (!v) throw new Error("body cannot be empty");
    data.body = v;
  }
  if (input.serviceMethod !== undefined) data.serviceMethod = input.serviceMethod?.trim() || null;
  if (input.servedAt !== undefined) data.servedAt = input.servedAt;

  if (input.unitId !== undefined) {
    await assertNoticeScope(prisma, {
      propertyId: existing.propertyId,
      tenancyId: existing.tenancyId,
      unitId: input.unitId,
    });
    data.unitId = input.unitId;
  }

  if (Object.keys(data).length === 0) return existing;
  const row = await prisma.notice.update({ where: { id }, data });
  await logPropertyActivity(prisma, principal, row.propertyId, "Notice", row.id, "notice.updated", {
    oldValues: pickForAudit(existing, ["noticeType", "title", "unitId", "servedAt", "serviceMethod"]),
    newValues: pickForAudit(row, ["noticeType", "title", "unitId", "servedAt", "serviceMethod"]),
  });
  return row;
}
