import type { Prisma, PrismaClient, RetentionStatus, Tenancy, TenancyStatus } from "@prisma/client";
import {
  assertValidRentDueDay,
  deriveRentDueDayFromLeaseStart,
} from "@/lib/leasing/notice-rules";
import type { StaffContext } from "./staff-context";
import { requirePropertyManagerAccess, requireStaff } from "./property-access";
import { NotFoundError } from "./errors";
import { logPropertyActivity, pickForAudit } from "./activityLog.service";

const TENANCY_STATUSES: ReadonlySet<TenancyStatus> = new Set([
  "pending_move_in",
  "active",
  "notice_received",
  "move_out_scheduled",
  "inspection_scheduled",
  "inspection_completed",
  "ended",
  "archived",
]);

const DEDICATED_TRANSITION_STATUSES: ReadonlySet<TenancyStatus> = new Set([
  "move_out_scheduled",
  "inspection_scheduled",
  "inspection_completed",
]);

function assertTenancyStatus(value: TenancyStatus): void {
  if (!TENANCY_STATUSES.has(value)) throw new Error("Invalid tenancy status");
}

export type CreateTenancyFromApplicationInput = {
  applicationId: string;
  leaseStartDate: Date;
  leaseEndDate?: Date | null;
  moveInDate: Date;
  moveOutDate?: Date | null;
  monthlyRent: number;
  securityDeposit: number;
  petDeposit?: number | null;
  leaseSetupJson?: Prisma.InputJsonValue;
  status?: TenancyStatus;
};

export type UpdateTenancyInput = {
  status?: TenancyStatus;
  leaseStartDate?: Date;
  leaseEndDate?: Date | null;
  moveInDate?: Date;
  moveOutDate?: Date | null;
  rentDueDay?: number;
  monthlyRent?: number;
  securityDeposit?: number;
  petDeposit?: number | null;
  leaseSetupJson?: Prisma.InputJsonValue;
  buildiumResidentCenterUrl?: string | null;
  archivedAt?: Date | null;
  retentionReviewDueAt?: Date | null;
  retentionStatus?: RetentionStatus | null;
};

export type ListTenanciesForPropertyOptions = {
  status?: TenancyStatus;
};

async function getTenancyOrThrow(prisma: PrismaClient, id: string): Promise<Tenancy> {
  const row = await prisma.tenancy.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Tenancy not found");
  return row;
}

/**
 * Property manager or org admin/owner in the active org. Application must be `approved`; property/unit copied from
 * application; one tenancy per application.
 */
export async function createTenancyFromApprovedApplication(
  prisma: PrismaClient,
  principal: StaffContext,
  input: CreateTenancyFromApplicationInput
): Promise<Tenancy> {
  requireStaff(principal);

  const application = await prisma.application.findUnique({
    where: { id: input.applicationId },
  });
  if (!application) throw new NotFoundError("Application not found");

  if (application.status !== "approved") {
    throw new Error("Application must be approved before creating a tenancy");
  }

  await requirePropertyManagerAccess(prisma, principal, application.propertyId);

  const existing = await prisma.tenancy.findUnique({
    where: { applicationId: application.id },
  });
  if (existing) throw new Error("A tenancy already exists for this application");

  if (input.monthlyRent < 0 || input.securityDeposit < 0) {
    throw new Error("Rent and deposit amounts must be non-negative");
  }
  if (input.petDeposit != null && input.petDeposit < 0) {
    throw new Error("Pet deposit must be non-negative");
  }

  const status = input.status ?? "pending_move_in";
  assertTenancyStatus(status);

  const rentDueDay = deriveRentDueDayFromLeaseStart(input.leaseStartDate);

  const row = await prisma.tenancy.create({
    data: {
      propertyId: application.propertyId,
      unitId: application.unitId,
      applicationId: application.id,
      status,
      leaseStartDate: input.leaseStartDate,
      leaseEndDate: input.leaseEndDate ?? null,
      moveInDate: input.moveInDate,
      moveOutDate: input.moveOutDate ?? null,
      rentDueDay,
      monthlyRent: input.monthlyRent,
      securityDeposit: input.securityDeposit,
      petDeposit: input.petDeposit ?? null,
      leaseSetupJson: input.leaseSetupJson ?? undefined,
    },
  });
  await logPropertyActivity(prisma, principal, row.propertyId, "Tenancy", row.id, "tenancy.created", {
    newValues: pickForAudit(row, [
      "applicationId",
      "status",
      "leaseStartDate",
      "moveInDate",
      "monthlyRent",
      "rentDueDay",
    ]),
  });
  return row;
}

export async function getTenancyById(
  prisma: PrismaClient,
  principal: StaffContext,
  tenancyId: string
): Promise<Tenancy> {
  requireStaff(principal);
  const row = await getTenancyOrThrow(prisma, tenancyId);
  await requirePropertyManagerAccess(prisma, principal, row.propertyId);
  return row;
}

export async function listTenanciesForProperty(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
  options?: ListTenanciesForPropertyOptions
): Promise<Tenancy[]> {
  requireStaff(principal);
  await requirePropertyManagerAccess(prisma, principal, propertyId);
  return prisma.tenancy.findMany({
    where: {
      propertyId,
      ...(options?.status !== undefined ? { status: options.status } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Updates lifecycle, financial snapshot, Buildium URL, and retention snapshot fields. No background jobs.
 * When transitioning to `archived`, sets `archivedAt` if not already set (unless explicitly passed).
 */
export async function updateTenancy(
  prisma: PrismaClient,
  principal: StaffContext,
  tenancyId: string,
  input: UpdateTenancyInput
): Promise<Tenancy> {
  requireStaff(principal);
  const existing = await getTenancyOrThrow(prisma, tenancyId);
  await requirePropertyManagerAccess(prisma, principal, existing.propertyId);

  const data: Prisma.TenancyUncheckedUpdateInput = {};

  if (input.status !== undefined) {
    assertTenancyStatus(input.status);
    if (DEDICATED_TRANSITION_STATUSES.has(input.status)) {
      throw new Error(
        "Use dedicated move-out and inspection actions instead of setting this status directly",
      );
    }
    data.status = input.status;
    if (input.status === "archived" && input.archivedAt === undefined && !existing.archivedAt) {
      data.archivedAt = new Date();
    }
  }

  const resultingStatus = (data.status as TenancyStatus | undefined) ?? existing.status;
  const resultingMoveOut =
    input.moveOutDate !== undefined ? input.moveOutDate : existing.moveOutDate;
  if (resultingStatus === "move_out_scheduled" && resultingMoveOut == null) {
    throw new Error("Scheduled move-out date is required before marking move-out scheduled");
  }
  if (input.leaseStartDate !== undefined) data.leaseStartDate = input.leaseStartDate;
  if (input.leaseEndDate !== undefined) data.leaseEndDate = input.leaseEndDate;
  if (input.moveInDate !== undefined) data.moveInDate = input.moveInDate;
  if (input.moveOutDate !== undefined) data.moveOutDate = input.moveOutDate;
  if (input.rentDueDay !== undefined) {
    assertValidRentDueDay(input.rentDueDay);
    data.rentDueDay = input.rentDueDay;
  }
  if (input.monthlyRent !== undefined) {
    if (input.monthlyRent < 0) throw new Error("monthlyRent must be non-negative");
    data.monthlyRent = input.monthlyRent;
  }
  if (input.securityDeposit !== undefined) {
    if (input.securityDeposit < 0) throw new Error("securityDeposit must be non-negative");
    data.securityDeposit = input.securityDeposit;
  }
  if (input.petDeposit !== undefined) {
    if (input.petDeposit != null && input.petDeposit < 0) throw new Error("petDeposit must be non-negative");
    data.petDeposit = input.petDeposit;
  }
  if (input.leaseSetupJson !== undefined) {
    data.leaseSetupJson = input.leaseSetupJson;
  }
  if (input.buildiumResidentCenterUrl !== undefined) {
    const v = input.buildiumResidentCenterUrl?.trim();
    data.buildiumResidentCenterUrl = v || null;
  }
  if (input.archivedAt !== undefined) data.archivedAt = input.archivedAt;
  if (input.retentionReviewDueAt !== undefined) data.retentionReviewDueAt = input.retentionReviewDueAt;
  if (input.retentionStatus !== undefined) data.retentionStatus = input.retentionStatus;

  if (Object.keys(data).length === 0) return existing;
  const row = await prisma.tenancy.update({ where: { id: tenancyId }, data });

  const inputKeys = Object.keys(input).filter((k) => (input as Record<string, unknown>)[k] !== undefined);
  const onlyBuildium =
    inputKeys.length === 1 && inputKeys[0] === "buildiumResidentCenterUrl";

  const auditKeys = [
    "status",
    "leaseStartDate",
    "leaseEndDate",
    "moveInDate",
    "moveOutDate",
    "rentDueDay",
    "monthlyRent",
    "securityDeposit",
    "petDeposit",
    "leaseSetupJson",
    "buildiumResidentCenterUrl",
    "archivedAt",
    "retentionStatus",
    "retentionReviewDueAt",
  ] as const;

  if (onlyBuildium) {
    await logPropertyActivity(prisma, principal, row.propertyId, "Tenancy", row.id, "tenancy.buildium_url_updated", {
      oldValues: { buildiumResidentCenterUrl: existing.buildiumResidentCenterUrl },
      newValues: { buildiumResidentCenterUrl: row.buildiumResidentCenterUrl },
    });
  } else {
    await logPropertyActivity(prisma, principal, row.propertyId, "Tenancy", row.id, "tenancy.updated", {
      oldValues: pickForAudit(existing, [...auditKeys]),
      newValues: pickForAudit(row, [...auditKeys]),
    });
  }

  return row;
}

/** Convenience wrapper around `updateTenancy` for the Buildium resident center URL only. */
export async function setBuildiumResidentCenterUrl(
  prisma: PrismaClient,
  principal: StaffContext,
  tenancyId: string,
  url: string | null
): Promise<Tenancy> {
  return updateTenancy(prisma, principal, tenancyId, {
    buildiumResidentCenterUrl: url,
  });
}
