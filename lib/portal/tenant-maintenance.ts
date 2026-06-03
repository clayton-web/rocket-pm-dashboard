import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import {
  isLikelyRequestId,
  TENANT_MAINTENANCE_SELECT,
  toTenantMaintenanceView,
  type TenantMaintenanceStatusView,
} from "@/lib/portal/maintenance-tenant-status";
import type { TenantSessionPayload } from "@/lib/portal/tenant-auth";

/** Requests visible to the signed-in tenant (org + tenancy or submitted by contact). */
export function tenantMaintenanceWhereForSession(
  session: TenantSessionPayload,
): Prisma.MaintenanceRequestWhereInput {
  return {
    organizationId: session.organizationId,
    OR: [{ tenancyId: session.tenancyId }, { submittedByContactId: session.contactId }],
  };
}

export async function listTenantMaintenanceForSession(
  session: TenantSessionPayload,
  options?: { limit?: number },
): Promise<TenantMaintenanceStatusView[]> {
  const rows = await prisma.maintenanceRequest.findMany({
    where: tenantMaintenanceWhereForSession(session),
    select: TENANT_MAINTENANCE_SELECT,
    orderBy: { submittedAt: "desc" },
    take: options?.limit,
  });

  return rows.map(toTenantMaintenanceView);
}

export async function getTenantMaintenanceForSession(
  session: TenantSessionPayload,
  requestId: string,
): Promise<TenantMaintenanceStatusView | null> {
  if (!isLikelyRequestId(requestId)) {
    return null;
  }

  const row = await prisma.maintenanceRequest.findFirst({
    where: {
      id: requestId.trim(),
      ...tenantMaintenanceWhereForSession(session),
    },
    select: TENANT_MAINTENANCE_SELECT,
  });

  return row ? toTenantMaintenanceView(row) : null;
}
