import type { MaintenanceRequestStatus, MaintenanceTrade, MaintenanceUrgency } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { logMaintenanceActivity } from "@/lib/maintenance/activity";
import {
  assertStaffCanAccessProperty,
  propertyIdsVisibleToStaff,
  type StaffMaintenanceContext,
} from "@/lib/maintenance/authorization";
import {
  serializeMaintenanceRequest,
  type MaintenanceRequestWithContext,
} from "@/lib/maintenance/serialize";
import type { ManagerWorkflowStatus } from "@/lib/maintenance/types";
import {
  assertAllowedManagerTransition,
  prismaStatusForManagerPatch,
  toManagerWorkflowStatus,
} from "@/lib/maintenance/workflow";

const requestInclude = {
  property: { select: { id: true, name: true } },
  unit: { select: { id: true, unitNumber: true } },
  submittedByContact: { select: { firstName: true, lastName: true } },
} as const;

function maintenanceWhereForStaff(ctx: StaffMaintenanceContext) {
  const base = { organizationId: ctx.organizationId };
  return base;
}

async function listWhereWithPropertyScope(ctx: StaffMaintenanceContext) {
  const base = maintenanceWhereForStaff(ctx);
  const visible = await propertyIdsVisibleToStaff(ctx);
  if (visible === "all") {
    return base;
  }
  if (visible.length === 0) {
    return { ...base, propertyId: { in: [] as string[] } };
  }
  return { ...base, propertyId: { in: visible } };
}

export async function listMaintenanceForStaff(ctx: StaffMaintenanceContext) {
  const rows = await prisma.maintenanceRequest.findMany({
    where: await listWhereWithPropertyScope(ctx),
    include: requestInclude,
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(serializeMaintenanceRequest);
}

export async function getMaintenanceForStaff(ctx: StaffMaintenanceContext, id: string) {
  const row = await prisma.maintenanceRequest.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: requestInclude,
  });
  if (!row) return null;
  await assertStaffCanAccessProperty(ctx, row.propertyId);
  return serializeMaintenanceRequest(row);
}

export type PublicCreateMaintenanceInput = {
  tenancyId: string;
  title: string;
  description: string;
  trade: MaintenanceTrade;
  urgency: MaintenanceUrgency;
  triageSummary: string;
  category?: string | null;
  accessNotes?: string | null;
  photoCountNote?: string | null;
};

export async function createMaintenanceFromPublicIntake(input: PublicCreateMaintenanceInput) {
  const tenancy = await prisma.tenancy.findFirst({
    where: {
      id: input.tenancyId,
      status: "active",
      property: { isActive: true },
    },
    include: {
      property: { select: { id: true, organizationId: true, name: true } },
      unit: { select: { id: true, unitNumber: true } },
      contacts: { where: { contactType: "tenant" }, take: 1 },
    },
  });

  if (!tenancy) {
    throw new Error("invalid_tenancy");
  }

  const orgSlug = process.env.MAINTENANCE_PUBLIC_ORG_SLUG?.trim() || "axford";
  const org = await prisma.organization.findFirst({
    where: { id: tenancy.property.organizationId, slug: orgSlug },
  });
  if (!org) {
    throw new Error("invalid_tenancy");
  }

  let description = input.description.trim();
  if (input.photoCountNote) {
    description = `${description}\n\n${input.photoCountNote}`;
  }

  const primaryContact = tenancy.contacts[0] ?? null;

  const row = await prisma.maintenanceRequest.create({
    data: {
      organizationId: org.id,
      propertyId: tenancy.propertyId,
      unitId: tenancy.unitId,
      tenancyId: tenancy.id,
      submittedByContactId: primaryContact?.id ?? null,
      source: "tenant_portal",
      category: input.category ?? null,
      trade: input.trade,
      urgency: input.urgency,
      status: "new",
      title: input.title.trim(),
      description,
      triageSummary: input.triageSummary,
      accessNotes: input.accessNotes?.trim() || null,
    },
    include: requestInclude,
  });

  await logMaintenanceActivity({
    propertyId: row.propertyId,
    entityId: row.id,
    action: "maintenance.created",
    newValues: { status: row.status, title: row.title },
  });

  return serializeMaintenanceRequest(row);
}

export type PatchMaintenanceInput = {
  status?: ManagerWorkflowStatus;
  assigned_to_name?: string | null;
  completion_note?: string | null;
};

export async function patchMaintenanceForStaff(
  ctx: StaffMaintenanceContext,
  id: string,
  input: PatchMaintenanceInput,
) {
  const existing = await prisma.maintenanceRequest.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: requestInclude,
  });
  if (!existing) return null;

  await assertStaffCanAccessProperty(ctx, existing.propertyId);

  const currentWorkflow = toManagerWorkflowStatus(existing.status);
  const now = new Date();

  const data: {
    status?: MaintenanceRequestStatus;
    assignedVendorName?: string | null;
    completionNote?: string | null;
    dispatchedAt?: Date | null;
    completedAt?: Date | null;
    cancelledAt?: Date | null;
  } = {};

  if (input.status !== undefined) {
    assertAllowedManagerTransition(currentWorkflow, input.status);
    const nextPrismaStatus = prismaStatusForManagerPatch(existing.status, input.status);
    data.status = nextPrismaStatus;

    if (input.status === "dispatched" && currentWorkflow === "new") {
      data.dispatchedAt = now;
    }
    if (input.status === "completed" && currentWorkflow === "dispatched") {
      data.completedAt = now;
    }
    if (input.status === "cancelled") {
      data.cancelledAt = now;
    }
  }

  if (input.assigned_to_name !== undefined) {
    data.assignedVendorName = input.assigned_to_name?.trim() || null;
  }
  if (input.completion_note !== undefined) {
    data.completionNote = input.completion_note?.trim() || null;
  }

  const updated = await prisma.maintenanceRequest.update({
    where: { id },
    data,
    include: requestInclude,
  });

  if (input.status !== undefined && input.status !== currentWorkflow) {
    await logMaintenanceActivity({
      propertyId: updated.propertyId,
      actorUserId: ctx.userId,
      entityId: updated.id,
      action: "maintenance.status_updated",
      oldValues: { status: existing.status },
      newValues: { status: updated.status },
    });
  }

  return serializeMaintenanceRequest(updated);
}

export async function listPublicSubmitOptions() {
  const orgSlug = process.env.MAINTENANCE_PUBLIC_ORG_SLUG?.trim() || "axford";
  const org = await prisma.organization.findFirst({
    where: { slug: orgSlug },
  });
  if (!org) return [];

  const tenancies = await prisma.tenancy.findMany({
    where: {
      status: "active",
      property: { organizationId: org.id, isActive: true },
    },
    include: {
      property: { select: { name: true } },
      unit: { select: { unitNumber: true } },
      contacts: { where: { contactType: "tenant" }, take: 1 },
    },
    orderBy: [{ property: { name: "asc" } }, { unit: { unitNumber: "asc" } }],
  });

  return tenancies.map((t) => {
    const contact = t.contacts[0];
    const tenantLabel = contact
      ? `${contact.firstName} ${contact.lastName}`.trim()
      : "Tenant";
    return {
      tenancyId: t.id,
      label: `${t.property.name} · Unit ${t.unit.unitNumber} · ${tenantLabel}`,
    };
  });
}

export type { MaintenanceRequestWithContext };
