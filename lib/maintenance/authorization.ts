import type { OrganizationMembershipRole } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { getActiveOrganizationContext } from "@/lib/org/active-organization";
import { isOrgAdmin, requireOrgAccess } from "@/lib/permissions/require-org-access";

export type StaffMaintenanceContext = {
  userId: string;
  organizationId: string;
  role: OrganizationMembershipRole;
};

export async function requireStaffMaintenanceContext(): Promise<StaffMaintenanceContext | Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const active = await getActiveOrganizationContext();
  if (!active) {
    return new Response(JSON.stringify({ error: "active_organization_required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await requireOrgAccess({
      userId: session.user.id,
      organizationId: active.id,
      minimumRole: "MEMBER",
    });
  } catch {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return {
    userId: session.user.id,
    organizationId: active.id,
    role: active.role,
  };
}

export async function propertyIdsVisibleToStaff(
  ctx: StaffMaintenanceContext,
): Promise<string[] | "all"> {
  if (isOrgAdmin(ctx.role)) {
    return "all";
  }

  const assignments = await prisma.userPropertyAssignment.findMany({
    where: {
      userId: ctx.userId,
      property: { organizationId: ctx.organizationId, isActive: true },
    },
    select: { propertyId: true },
  });

  const ids = [...new Set(assignments.map((a) => a.propertyId))];
  return ids;
}

export async function assertStaffCanAccessProperty(
  ctx: StaffMaintenanceContext,
  propertyId: string,
): Promise<void> {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId: ctx.organizationId, isActive: true },
    select: { id: true },
  });
  if (!property) {
    throw new Error("forbidden");
  }

  if (isOrgAdmin(ctx.role)) {
    return;
  }

  const visible = await propertyIdsVisibleToStaff(ctx);
  if (visible === "all") return;
  if (!visible.includes(propertyId)) {
    throw new Error("forbidden");
  }
}
