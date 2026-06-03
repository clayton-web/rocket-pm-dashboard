import type { PrismaClient, Tenancy, TenancyStatus } from "@prisma/client";
import { toDateOnlyUTC } from "@/lib/leasing/notice-rules";
import {
  isValidTenancyStatusTransition,
} from "@/lib/leasing/tenancy-lifecycle";
import {
  normalizeInspectionNotes,
  normalizeInspectionReportUrl,
} from "@/lib/leasing/move-out-inspection";
import type { StaffContext } from "./staff-context";
import { requirePropertyManagerAccess, requireStaff } from "./property-access";
import { NotFoundError } from "./errors";
import { logPropertyActivity, pickForAudit } from "./activityLog.service";

const INSPECTION_AUDIT_KEYS = [
  "status",
  "inspectionDate",
  "inspectionReportUrl",
  "inspectionNotes",
] as const;

async function getTenancyOrThrow(prisma: PrismaClient, id: string): Promise<Tenancy> {
  const row = await prisma.tenancy.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Tenancy not found");
  return row;
}

export type ScheduleMoveOutInspectionInput = {
  inspectionDate: Date;
  notes?: string | null;
};

export type CompleteMoveOutInspectionInput = {
  inspectionDate: Date;
  reportUrl?: string | null;
  notes?: string | null;
};

/**
 * Staff schedules move-out inspection: sets inspection date/notes and
 * move_out_scheduled → inspection_scheduled.
 */
export async function scheduleMoveOutInspection(
  prisma: PrismaClient,
  principal: StaffContext,
  tenancyId: string,
  input: ScheduleMoveOutInspectionInput,
): Promise<Tenancy> {
  requireStaff(principal);
  const existing = await getTenancyOrThrow(prisma, tenancyId);
  await requirePropertyManagerAccess(prisma, principal, existing.propertyId);

  if (existing.status !== "move_out_scheduled") {
    throw new Error("Tenancy must be in move-out scheduled status to schedule an inspection");
  }
  if (existing.moveOutDate == null) {
    throw new Error("Scheduled move-out date is required before scheduling an inspection");
  }

  const next: TenancyStatus = "inspection_scheduled";
  if (!isValidTenancyStatusTransition("move_out_scheduled", next)) {
    throw new Error("Invalid status transition");
  }

  const inspectionDate = toDateOnlyUTC(input.inspectionDate);
  const inspectionNotes = normalizeInspectionNotes(input.notes);

  const row = await prisma.tenancy.update({
    where: { id: tenancyId },
    data: {
      status: next,
      inspectionDate,
      inspectionNotes,
    },
  });

  await logPropertyActivity(
    prisma,
    principal,
    row.propertyId,
    "Tenancy",
    row.id,
    "tenancy.inspection_scheduled",
    {
      oldValues: pickForAudit(existing, [...INSPECTION_AUDIT_KEYS]),
      newValues: pickForAudit(row, [...INSPECTION_AUDIT_KEYS]),
    },
  );

  return row;
}

/**
 * Staff completes move-out inspection: optional report URL/notes and
 * inspection_scheduled → inspection_completed.
 */
export async function completeMoveOutInspection(
  prisma: PrismaClient,
  principal: StaffContext,
  tenancyId: string,
  input: CompleteMoveOutInspectionInput,
): Promise<Tenancy> {
  requireStaff(principal);
  const existing = await getTenancyOrThrow(prisma, tenancyId);
  await requirePropertyManagerAccess(prisma, principal, existing.propertyId);

  if (existing.status !== "inspection_scheduled") {
    throw new Error("Tenancy must be in inspection scheduled status to complete an inspection");
  }

  const next: TenancyStatus = "inspection_completed";
  if (!isValidTenancyStatusTransition("inspection_scheduled", next)) {
    throw new Error("Invalid status transition");
  }

  const inspectionDate = toDateOnlyUTC(input.inspectionDate);
  const inspectionReportUrl = normalizeInspectionReportUrl(input.reportUrl);
  const notesFromInput = normalizeInspectionNotes(input.notes);
  const inspectionNotes =
    notesFromInput !== null ? notesFromInput : existing.inspectionNotes;

  const row = await prisma.tenancy.update({
    where: { id: tenancyId },
    data: {
      status: next,
      inspectionDate,
      inspectionReportUrl,
      inspectionNotes,
    },
  });

  await logPropertyActivity(
    prisma,
    principal,
    row.propertyId,
    "Tenancy",
    row.id,
    "tenancy.inspection_completed",
    {
      oldValues: pickForAudit(existing, [...INSPECTION_AUDIT_KEYS]),
      newValues: pickForAudit(row, [...INSPECTION_AUDIT_KEYS]),
    },
  );

  return row;
}
