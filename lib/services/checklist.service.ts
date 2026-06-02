import type {
  Checklist,
  ChecklistItem,
  ChecklistItemStatus,
  ChecklistStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import type { StaffContext } from "./staff-context";
import { requirePropertyManagerAccess, requireStaff } from "./property-access";
import { NotFoundError } from "./errors";
import { logPropertyActivity, pickForAudit } from "./activityLog.service";

export type CreateChecklistInput = {
  propertyId: string;
  tenancyId?: string | null;
  checklistType: string;
  status?: ChecklistStatus;
};

export type UpdateChecklistInput = {
  status?: ChecklistStatus;
  checklistType?: string;
};

export type AddChecklistItemInput = {
  itemKey: string;
  label: string;
  isRequired?: boolean;
  status?: ChecklistItemStatus;
};

export type UpdateChecklistItemInput = {
  label?: string;
  isRequired?: boolean;
  status?: ChecklistItemStatus;
  completedAt?: Date | null;
};

async function getChecklistOrThrow(prisma: PrismaClient, id: string): Promise<Checklist> {
  const row = await prisma.checklist.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Checklist not found");
  return row;
}

async function getChecklistItemOrThrow(prisma: PrismaClient, id: string): Promise<ChecklistItem> {
  const row = await prisma.checklistItem.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Checklist item not found");
  return row;
}

async function requireChecklistPropertyAccess(
  prisma: PrismaClient,
  principal: StaffContext,
  checklistId: string
): Promise<Checklist> {
  requireStaff(principal);
  const checklist = await getChecklistOrThrow(prisma, checklistId);
  await requirePropertyManagerAccess(prisma, principal, checklist.propertyId);
  return checklist;
}

export async function createChecklist(
  prisma: PrismaClient,
  principal: StaffContext,
  input: CreateChecklistInput
): Promise<Checklist> {
  requireStaff(principal);
  await requirePropertyManagerAccess(prisma, principal, input.propertyId);

  const checklistType = input.checklistType.trim();
  if (!checklistType) throw new Error("checklistType is required");

  if (input.tenancyId) {
    const t = await prisma.tenancy.findFirst({
      where: { id: input.tenancyId, propertyId: input.propertyId },
    });
    if (!t) throw new NotFoundError("Tenancy not found on this property");
  }

  const row = await prisma.checklist.create({
    data: {
      propertyId: input.propertyId,
      tenancyId: input.tenancyId ?? null,
      checklistType,
      status: input.status ?? "not_started",
    },
  });
  await logPropertyActivity(prisma, principal, row.propertyId, "Checklist", row.id, "checklist.created", {
    newValues: pickForAudit(row, ["tenancyId", "checklistType", "status"]),
  });
  return row;
}

export async function updateChecklist(
  prisma: PrismaClient,
  principal: StaffContext,
  checklistId: string,
  input: UpdateChecklistInput
): Promise<Checklist> {
  const existing = await requireChecklistPropertyAccess(prisma, principal, checklistId);
  const data: Prisma.ChecklistUncheckedUpdateInput = {};
  if (input.status !== undefined) data.status = input.status;
  if (input.checklistType !== undefined) {
    const v = input.checklistType.trim();
    if (!v) throw new Error("checklistType cannot be empty");
    data.checklistType = v;
  }
  if (Object.keys(data).length === 0) return existing;
  const row = await prisma.checklist.update({ where: { id: checklistId }, data });
  await logPropertyActivity(prisma, principal, row.propertyId, "Checklist", row.id, "checklist.updated", {
    oldValues: pickForAudit(existing, ["checklistType", "status"]),
    newValues: pickForAudit(row, ["checklistType", "status"]),
  });
  return row;
}

export async function addChecklistItem(
  prisma: PrismaClient,
  principal: StaffContext,
  checklistId: string,
  input: AddChecklistItemInput
): Promise<ChecklistItem> {
  const checklist = await requireChecklistPropertyAccess(prisma, principal, checklistId);
  const itemKey = input.itemKey.trim();
  const label = input.label.trim();
  if (!itemKey) throw new Error("itemKey is required");
  if (!label) throw new Error("label is required");
  try {
    const row = await prisma.checklistItem.create({
      data: {
        checklistId,
        itemKey,
        label,
        isRequired: input.isRequired ?? true,
        status: input.status ?? "pending",
      },
    });
    await logPropertyActivity(prisma, principal, checklist.propertyId, "ChecklistItem", row.id, "checklist_item.created", {
      newValues: pickForAudit(row, ["checklistId", "itemKey", "status", "isRequired"]),
    });
    return row;
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") {
      throw new Error("itemKey already exists on this checklist");
    }
    throw e;
  }
}

export async function updateChecklistItem(
  prisma: PrismaClient,
  principal: StaffContext,
  itemId: string,
  input: UpdateChecklistItemInput
): Promise<ChecklistItem> {
  const item = await getChecklistItemOrThrow(prisma, itemId);
  const checklist = await requireChecklistPropertyAccess(prisma, principal, item.checklistId);

  const data: Prisma.ChecklistItemUncheckedUpdateInput = {};
  if (input.label !== undefined) {
    const v = input.label.trim();
    if (!v) throw new Error("label cannot be empty");
    data.label = v;
  }
  if (input.isRequired !== undefined) data.isRequired = input.isRequired;
  if (input.status !== undefined) data.status = input.status;
  if (input.completedAt !== undefined) data.completedAt = input.completedAt;

  if (input.status !== undefined && input.completedAt === undefined) {
    if (input.status === "complete") data.completedAt = new Date();
    if (input.status === "pending" || input.status === "waived") data.completedAt = null;
  }

  if (Object.keys(data).length === 0) return item;
  const row = await prisma.checklistItem.update({ where: { id: itemId }, data });
  await logPropertyActivity(prisma, principal, checklist.propertyId, "ChecklistItem", row.id, "checklist_item.updated", {
    oldValues: pickForAudit(item, ["itemKey", "status", "isRequired", "completedAt"]),
    newValues: pickForAudit(row, ["itemKey", "status", "isRequired", "completedAt"]),
  });
  return row;
}

export async function listChecklistsForProperty(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
  options?: { checklistType?: string; status?: ChecklistStatus }
): Promise<Checklist[]> {
  requireStaff(principal);
  await requirePropertyManagerAccess(prisma, principal, propertyId);
  return prisma.checklist.findMany({
    where: {
      propertyId,
      ...(options?.checklistType !== undefined ? { checklistType: options.checklistType } : {}),
      ...(options?.status !== undefined ? { status: options.status } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listChecklistsForTenancy(
  prisma: PrismaClient,
  principal: StaffContext,
  tenancyId: string
): Promise<Checklist[]> {
  requireStaff(principal);
  const tenancy = await prisma.tenancy.findUnique({ where: { id: tenancyId } });
  if (!tenancy) throw new NotFoundError("Tenancy not found");
  await requirePropertyManagerAccess(prisma, principal, tenancy.propertyId);
  return prisma.checklist.findMany({
    where: { tenancyId },
    orderBy: { createdAt: "desc" },
  });
}

export async function listChecklistItems(
  prisma: PrismaClient,
  principal: StaffContext,
  checklistId: string
): Promise<ChecklistItem[]> {
  await requireChecklistPropertyAccess(prisma, principal, checklistId);
  return prisma.checklistItem.findMany({
    where: { checklistId },
    orderBy: { itemKey: "asc" },
  });
}
