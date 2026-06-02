import type {
  Prisma,
  PrismaClient,
  Showing,
  ShowingOutcome,
  ShowingStatus,
  ContactStatus,
} from "@prisma/client";
import type { StaffContext } from "./staff-context";
import {
  ForbiddenError,
  hasOrgWidePropertyRights,
  isFieldAgentOnlyOnProperty,
  requireLeasingAccess,
  requireStaff,
} from "./property-access";
import { NotFoundError } from "./errors";
import { logPropertyActivity, pickForAudit } from "./activityLog.service";

export type CreateShowingInput = {
  prospectId: string;
  propertyId: string;
  unitId?: string | null;
  assignedToUserId?: string | null;
  scheduledStart: Date;
  scheduledEnd?: Date | null;
  status?: ShowingStatus;
};

/** Users with full leasing access (not field-agent–only) may change any safe fields; field-agent-only users use `FieldAgentShowingPatch`. */
export type UpdateShowingInput = {
  unitId?: string | null;
  assignedToUserId?: string | null;
  scheduledStart?: Date;
  scheduledEnd?: Date | null;
  status?: ShowingStatus;
  showingOutcome?: ShowingOutcome | null;
  contactStatus?: ContactStatus;
  contactNotes?: string | null;
};

export type FieldAgentShowingPatch = Pick<
  UpdateShowingInput,
  "status" | "showingOutcome" | "contactStatus" | "contactNotes"
>;

async function getShowingRow(prisma: PrismaClient, showingId: string): Promise<Showing> {
  const row = await prisma.showing.findUnique({ where: { id: showingId } });
  if (!row) throw new NotFoundError("Showing not found");
  return row;
}

/**
 * Assignee must be org admin/owner in the property’s organization, or have a `user_property_assignments` row
 * for this property. Does not grant cross-org access.
 */
export async function assertUserAssignableToProperty(
  prisma: PrismaClient,
  userId: string,
  propertyId: string
): Promise<void> {
  const property = await prisma.property.findFirst({
    where: { id: propertyId },
    select: { organizationId: true },
  });
  if (!property) throw new NotFoundError("Property not found");

  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    include: { primaryRole: true },
  });
  if (!user) throw new NotFoundError("User not found or inactive");
  if (user.primaryRole?.key === "tenant") {
    throw new ForbiddenError("Tenant users cannot be assigned to showings");
  }
  const orgMembership = await prisma.organizationMembership.findFirst({
    where: {
      userId,
      organizationId: property.organizationId,
    },
  });
  if (orgMembership && (orgMembership.role === "ADMIN" || orgMembership.role === "OWNER")) {
    return;
  }
  const count = await prisma.userPropertyAssignment.count({
    where: { userId, propertyId },
  });
  if (count === 0) {
    throw new ForbiddenError("Assignee must have access to this property");
  }
}

async function assertUnitOnProperty(
  prisma: PrismaClient,
  unitId: string,
  propertyId: string
): Promise<void> {
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, propertyId, isActive: true },
  });
  if (!unit) throw new NotFoundError("Unit not found, inactive, or not on this property");
}

/**
 * Creates a showing for a prospect. `propertyId` must match the prospect’s `propertyId`.
 * `createdByUserId` is set from the principal.
 */
export async function createShowing(
  prisma: PrismaClient,
  principal: StaffContext,
  input: CreateShowingInput
): Promise<Showing> {
  requireStaff(principal);
  await requireLeasingAccess(prisma, principal, input.propertyId);

  const prospect = await prisma.prospect.findUnique({ where: { id: input.prospectId } });
  if (!prospect) throw new NotFoundError("Prospect not found");
  if (prospect.propertyId !== input.propertyId) {
    throw new Error("propertyId must match the prospect’s property");
  }

  let unitId: string | null = null;
  if (input.unitId) {
    await assertUnitOnProperty(prisma, input.unitId, input.propertyId);
    unitId = input.unitId;
  }

  if (input.assignedToUserId) {
    await assertUserAssignableToProperty(prisma, input.assignedToUserId, input.propertyId);
  }

  const row = await prisma.showing.create({
    data: {
      prospectId: input.prospectId,
      propertyId: input.propertyId,
      unitId,
      assignedToUserId: input.assignedToUserId ?? null,
      createdByUserId: principal.userId,
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd ?? null,
      status: input.status ?? "scheduled",
    },
  });
  await logPropertyActivity(prisma, principal, input.propertyId, "Showing", row.id, "showing.created", {
    newValues: pickForAudit(row, ["prospectId", "status", "scheduledStart", "assignedToUserId"]),
  });
  return row;
}

function buildFieldAgentPatch(patch: FieldAgentShowingPatch): Prisma.ShowingUncheckedUpdateInput {
  const data: Prisma.ShowingUncheckedUpdateInput = {};
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.showingOutcome !== undefined) data.showingOutcome = patch.showingOutcome;
  if (patch.contactStatus !== undefined) data.contactStatus = patch.contactStatus;
  if (patch.contactNotes !== undefined) data.contactNotes = patch.contactNotes ?? null;
  return data;
}

async function applyFullShowingPatch(
  prisma: PrismaClient,
  existing: Showing,
  input: UpdateShowingInput
): Promise<Showing> {
  const data: Prisma.ShowingUncheckedUpdateInput = {};
  if (input.scheduledStart !== undefined) data.scheduledStart = input.scheduledStart;
  if (input.scheduledEnd !== undefined) data.scheduledEnd = input.scheduledEnd;
  if (input.status !== undefined) data.status = input.status;
  if (input.showingOutcome !== undefined) data.showingOutcome = input.showingOutcome;
  if (input.contactStatus !== undefined) data.contactStatus = input.contactStatus;
  if (input.contactNotes !== undefined) data.contactNotes = input.contactNotes ?? null;

  if (input.unitId !== undefined) {
    if (input.unitId === null) data.unitId = null;
    else {
      await assertUnitOnProperty(prisma, input.unitId, existing.propertyId);
      data.unitId = input.unitId;
    }
  }

  if (input.assignedToUserId !== undefined) {
    data.assignedToUserId = input.assignedToUserId;
    if (input.assignedToUserId) {
      await assertUserAssignableToProperty(prisma, input.assignedToUserId, existing.propertyId);
    }
  }

  if (Object.keys(data).length === 0) return existing;
  return prisma.showing.update({ where: { id: existing.id }, data });
}

/**
 * Field-agent-only users may update: status, showingOutcome, contactStatus, contactNotes.
 * Field-agent–only: limited fields. Other callers with leasing access (PM, org admin/owner, etc.): full `UpdateShowingInput`.
 */
export async function updateShowing(
  prisma: PrismaClient,
  principal: StaffContext,
  showingId: string,
  input: UpdateShowingInput
): Promise<Showing> {
  requireStaff(principal);
  const existing = await getShowingRow(prisma, showingId);
  await requireLeasingAccess(prisma, principal, existing.propertyId);

  const agentOnly = isFieldAgentOnlyOnProperty(principal, existing.propertyId);
  if (agentOnly) {
    const allowedKeys: (keyof UpdateShowingInput)[] = [
      "status",
      "showingOutcome",
      "contactStatus",
      "contactNotes",
    ];
    const forbidden = Object.keys(input).filter(
      (k) => input[k as keyof UpdateShowingInput] !== undefined && !allowedKeys.includes(k as keyof UpdateShowingInput)
    );
    if (forbidden.length > 0) {
      throw new ForbiddenError("Field agents may only update status, outcome, and contact fields");
    }
    const patch = buildFieldAgentPatch({
      status: input.status,
      showingOutcome: input.showingOutcome,
      contactStatus: input.contactStatus,
      contactNotes: input.contactNotes,
    });
    if (Object.keys(patch).length === 0) return existing;
    const row = await prisma.showing.update({ where: { id: showingId }, data: patch });
    await logPropertyActivity(prisma, principal, row.propertyId, "Showing", row.id, "showing.updated", {
      oldValues: pickForAudit(existing, ["status", "showingOutcome", "contactStatus"]),
      newValues: pickForAudit(row, ["status", "showingOutcome", "contactStatus"]),
    });
    return row;
  }

  const row = await applyFullShowingPatch(prisma, existing, input);
  if (row === existing) return row;
  await logPropertyActivity(prisma, principal, row.propertyId, "Showing", row.id, "showing.updated", {
    oldValues: pickForAudit(existing, [
      "status",
      "showingOutcome",
      "contactStatus",
      "scheduledStart",
      "assignedToUserId",
      "unitId",
    ]),
    newValues: pickForAudit(row, [
      "status",
      "showingOutcome",
      "contactStatus",
      "scheduledStart",
      "assignedToUserId",
      "unitId",
    ]),
  });
  return row;
}

export async function getShowingById(
  prisma: PrismaClient,
  principal: StaffContext,
  showingId: string
): Promise<Showing> {
  requireStaff(principal);
  const row = await getShowingRow(prisma, showingId);
  await requireLeasingAccess(prisma, principal, row.propertyId);
  return row;
}

export async function listShowingsForProperty(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string
): Promise<Showing[]> {
  requireStaff(principal);
  await requireLeasingAccess(prisma, principal, propertyId);
  return prisma.showing.findMany({
    where: { propertyId },
    orderBy: { scheduledStart: "asc" },
  });
}

/**
 * Showings assigned to a user. Members without org-wide property rights may only query **their own** `userId`.
 * Results limited to properties the caller may access (leasing scope).
 */
export async function listShowingsForAssignedUser(
  prisma: PrismaClient,
  principal: StaffContext,
  assignedUserId: string
): Promise<Showing[]> {
  requireStaff(principal);
  if (!hasOrgWidePropertyRights(principal) && assignedUserId !== principal.userId) {
    throw new ForbiddenError("You may only list showings assigned to yourself");
  }

  if (hasOrgWidePropertyRights(principal)) {
    return prisma.showing.findMany({
      where: {
        assignedToUserId: assignedUserId,
        property: { organizationId: principal.organizationId },
      },
      orderBy: { scheduledStart: "asc" },
    });
  }

  const propertyIds = [...principal.assignmentRolesByProperty.keys()];
  if (propertyIds.length === 0) return [];
  return prisma.showing.findMany({
    where: {
      assignedToUserId: assignedUserId,
      propertyId: { in: propertyIds },
      property: { organizationId: principal.organizationId },
    },
    orderBy: { scheduledStart: "asc" },
  });
}
