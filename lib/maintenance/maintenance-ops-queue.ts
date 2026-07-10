import type { MaintenanceRequestStatus, MaintenanceUrgency, PrismaClient } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { formatPropertyAddress, formatUnitLabelOrDash } from "@/lib/property/display";
import { hasOrgWidePropertyRights, listPropertiesForUser } from "@/lib/services";
import type { StaffContext } from "@/lib/services/staff-context";
import type { ManagerWorkflowStatus } from "@/lib/maintenance/types";
import { toManagerWorkflowStatus } from "@/lib/maintenance/workflow";

/**
 * Prisma statuses that map to open manager workflow buckets (new | dispatched).
 * Completed and cancelled are excluded in SQL.
 */
export const OPEN_MAINTENANCE_OPS_STATUSES: readonly MaintenanceRequestStatus[] = [
  "new",
  "triaged",
  "dispatched",
  "in_progress",
  "awaiting_owner_approval",
  "scheduled",
] as const;

export type MaintenanceOpsQueueRow = {
  id: string;
  organizationId: string;
  propertyId: string;
  propertyLabel: string;
  unitLabel: string;
  title: string;
  /** Raw Prisma status — map with toManagerWorkflowStatus for Ops. */
  status: MaintenanceRequestStatus;
  managerStatus: ManagerWorkflowStatus;
  urgency: MaintenanceUrgency;
  assignedVendorName: string | null;
  submittedAt: string;
};

type DbClient = Pick<PrismaClient, "maintenanceRequest">;

export function buildOpenMaintenanceOpsWhere(
  organizationId: string,
  propertyIds: string[] | "all",
) {
  const base = {
    organizationId,
    status: { in: [...OPEN_MAINTENANCE_OPS_STATUSES] },
  };
  if (propertyIds === "all") {
    return base;
  }
  return {
    ...base,
    propertyId: { in: propertyIds },
  };
}

export function mapMaintenanceDbRowToOpsQueueRow(row: {
  id: string;
  organizationId: string;
  propertyId: string;
  title: string;
  status: MaintenanceRequestStatus;
  urgency: MaintenanceUrgency;
  assignedVendorName: string | null;
  submittedAt: Date;
  property: { name: string; streetLine1: string | null; streetLine2: string | null };
  unit: { unitNumber: string };
}): MaintenanceOpsQueueRow {
  return {
    id: row.id,
    organizationId: row.organizationId,
    propertyId: row.propertyId,
    propertyLabel: formatPropertyAddress(row.property),
    unitLabel: formatUnitLabelOrDash(row.unit.unitNumber),
    title: row.title,
    status: row.status,
    managerStatus: toManagerWorkflowStatus(row.status),
    urgency: row.urgency,
    assignedVendorName: row.assignedVendorName?.trim() || null,
    submittedAt: row.submittedAt.toISOString(),
  };
}

/**
 * Focused open-maintenance loader for Operations Centre.
 * Uses StaffContext + listPropertiesForUser (same org/assignment boundary as other Ops sources).
 */
export async function listOpenMaintenanceQueueForStaff(
  ctx: StaffContext,
  db: DbClient = prisma,
): Promise<MaintenanceOpsQueueRow[]> {
  let propertyScope: string[] | "all";
  if (hasOrgWidePropertyRights(ctx)) {
    propertyScope = "all";
  } else {
    const properties = await listPropertiesForUser(prisma, ctx);
    if (properties.length === 0) {
      return [];
    }
    propertyScope = properties.map((p) => p.id);
  }

  const rows = await db.maintenanceRequest.findMany({
    where: buildOpenMaintenanceOpsWhere(ctx.organizationId, propertyScope),
    select: {
      id: true,
      organizationId: true,
      propertyId: true,
      title: true,
      status: true,
      urgency: true,
      assignedVendorName: true,
      submittedAt: true,
      property: {
        select: { name: true, streetLine1: true, streetLine2: true },
      },
      unit: { select: { unitNumber: true } },
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
  });

  return rows.map(mapMaintenanceDbRowToOpsQueueRow);
}
