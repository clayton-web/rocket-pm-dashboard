import type {
  Application,
  ClientProfile,
  Prisma,
  PrismaClient,
  Property,
  Tenancy,
  TenancyContact,
} from "@prisma/client";
import type { StaffContext } from "./staff-context";
import {
  assertPropertyInActiveOrganization,
  ForbiddenError,
  getAllowedPropertyIds,
  hasOrgWidePropertyRights,
  requirePropertyManagerAccess,
  requireStaff,
} from "./property-access";
import { NotFoundError } from "./errors";
import { asAuditJson, logPropertyActivity, logStaffActivity, pickForAudit } from "./activityLog.service";

export type UpdateClientProfileInput = Partial<
  Pick<
    ClientProfile,
    | "firstName"
    | "lastName"
    | "email"
    | "phone"
    | "city"
    | "notes"
    | "employerName"
    | "jobTitle"
    | "monthlyIncome"
    | "employmentNotes"
  >
>;

async function getClientProfileOrThrow(prisma: PrismaClient, id: string): Promise<ClientProfile> {
  const row = await prisma.clientProfile.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Client profile not found");
  return row;
}

/**
 * PM: profiles tied to a former tenancy on an assigned property. Org admin/owner: all in the active org.
 * Profiles with no `sourceTenancyId` (manual/other) are **org admin/owner only** for list/get/update here.
 */
export async function ensureClientProfileAccess(
  prisma: PrismaClient,
  principal: StaffContext,
  profileId: string
): Promise<void> {
  requireStaff(principal);
  const profile = await prisma.clientProfile.findUnique({
    where: { id: profileId },
    include: { sourceTenancy: { include: { property: { select: { organizationId: true } } } } },
  });
  if (!profile) throw new NotFoundError("Client profile not found");

  if (!profile.sourceTenancyId || !profile.sourceTenancy) {
    if (!hasOrgWidePropertyRights(principal)) {
      throw new ForbiddenError("Only organization admin or owner may access this client profile");
    }
    return;
  }

  if (profile.sourceTenancy.property.organizationId !== principal.organizationId) {
    throw new ForbiddenError("No access to this client profile");
  }

  await requirePropertyManagerAccess(prisma, principal, profile.sourceTenancy.propertyId);
}

/**
 * Maps archived tenancy + application + primary contact into **approved lightweight** client fields only.
 * Used by `retention.service` conversion — keep mapping here so it stays one place.
 */
export function buildClientProfileCreateDataFromArchivedTenancy(
  tenancy: Tenancy,
  application: Application,
  property: Property,
  contacts: TenancyContact[],
  options: { notesOverride?: string | null; createdByUserId: string | null }
): Prisma.ClientProfileUncheckedCreateInput {
  const tenantish =
    contacts.find((c) => c.contactType === "tenant") ?? contacts[0] ?? null;

  const firstName =
    application.firstName?.trim() || tenantish?.firstName.trim() || "";
  const lastName =
    application.lastName?.trim() || tenantish?.lastName.trim() || "";
  const email =
    (application.email?.trim() || tenantish?.email.trim() || "").toLowerCase();
  const phone =
    application.phone?.trim() || tenantish?.phone?.trim() || "";

  if (!firstName) throw new Error("firstName is required to create a client profile");
  if (!lastName) throw new Error("lastName is required to create a client profile");
  if (!email) throw new Error("email is required to create a client profile");
  if (!phone) throw new Error("phone is required to create a client profile");

  return {
    firstName,
    lastName,
    email,
    phone,
    city: property.city?.trim() || null,
    notes: options.notesOverride?.trim() || null,
    employerName: application.employerName?.trim() || null,
    jobTitle: application.jobTitle?.trim() || null,
    monthlyIncome: application.monthlyIncome ?? null,
    employmentNotes: application.employmentNotes?.trim() || null,
    sourceType: "former_tenant",
    sourceTenancyId: tenancy.id,
    createdByUserId: options.createdByUserId,
  };
}

export async function getClientProfileById(
  prisma: PrismaClient,
  principal: StaffContext,
  profileId: string
): Promise<ClientProfile> {
  await ensureClientProfileAccess(prisma, principal, profileId);
  return getClientProfileOrThrow(prisma, profileId);
}

export async function listClientProfiles(
  prisma: PrismaClient,
  principal: StaffContext,
  options?: { propertyId?: string }
): Promise<ClientProfile[]> {
  requireStaff(principal);
  const orgId = principal.organizationId;

  if (options?.propertyId) {
    await assertPropertyInActiveOrganization(prisma, principal, options.propertyId);
  }

  if (hasOrgWidePropertyRights(principal)) {
    return prisma.clientProfile.findMany({
      where: {
        AND: [
          {
            OR: [
              { sourceTenancy: { property: { organizationId: orgId } } },
              { sourceTenancyId: null },
            ],
          },
          options?.propertyId
            ? { sourceTenancy: { propertyId: options.propertyId, property: { organizationId: orgId } } }
            : {},
        ],
      },
      orderBy: { createdAt: "desc" },
    });
  }

  const scope = await getAllowedPropertyIds(prisma, principal);
  const ids = [...scope];
  if (ids.length === 0) return [];

  const propertyFilter = options?.propertyId;
  if (propertyFilter && !ids.includes(propertyFilter)) {
    throw new ForbiddenError("No access to this property");
  }

  const allowed = propertyFilter ? [propertyFilter] : ids;

  return prisma.clientProfile.findMany({
    where: {
      sourceTenancy: {
        propertyId: { in: allowed },
        property: { organizationId: orgId },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateClientProfile(
  prisma: PrismaClient,
  principal: StaffContext,
  profileId: string,
  input: UpdateClientProfileInput
): Promise<ClientProfile> {
  await ensureClientProfileAccess(prisma, principal, profileId);

  const existing = await prisma.clientProfile.findUnique({
    where: { id: profileId },
    include: { sourceTenancy: { select: { propertyId: true } } },
  });
  if (!existing) throw new NotFoundError("Client profile not found");

  const data: Prisma.ClientProfileUncheckedUpdateInput = {};
  if (input.firstName !== undefined) {
    const v = input.firstName.trim();
    if (!v) throw new Error("firstName cannot be empty");
    data.firstName = v;
  }
  if (input.lastName !== undefined) {
    const v = input.lastName.trim();
    if (!v) throw new Error("lastName cannot be empty");
    data.lastName = v;
  }
  if (input.email !== undefined) {
    const v = input.email.trim().toLowerCase();
    if (!v) throw new Error("email cannot be empty");
    data.email = v;
  }
  if (input.phone !== undefined) {
    const v = input.phone.trim();
    if (!v) throw new Error("phone cannot be empty");
    data.phone = v;
  }
  if (input.city !== undefined) data.city = input.city?.trim() || null;
  if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
  if (input.employerName !== undefined) data.employerName = input.employerName?.trim() || null;
  if (input.jobTitle !== undefined) data.jobTitle = input.jobTitle?.trim() || null;
  if (input.monthlyIncome !== undefined) data.monthlyIncome = input.monthlyIncome;
  if (input.employmentNotes !== undefined) {
    data.employmentNotes = input.employmentNotes?.trim() || null;
  }

  if (Object.keys(data).length === 0) {
    return getClientProfileOrThrow(prisma, profileId);
  }

  const row = await prisma.clientProfile.update({ where: { id: profileId }, data });
  const auditKeys = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "city",
    "notes",
    "employerName",
    "jobTitle",
    "monthlyIncome",
    "employmentNotes",
  ] as const;
  const propertyId = existing.sourceTenancy?.propertyId ?? null;
  const oldValues = pickForAudit(existing, [...auditKeys]);
  const newValues = pickForAudit(row, [...auditKeys]);
  if (propertyId) {
    await logPropertyActivity(prisma, principal, propertyId, "ClientProfile", profileId, "client_profile.updated", {
      oldValues,
      newValues,
    });
  } else {
    await logStaffActivity(prisma, principal, {
      propertyId: null,
      entityType: "ClientProfile",
      entityId: profileId,
      action: "client_profile.updated",
      oldValues: asAuditJson(oldValues),
      newValues: asAuditJson(newValues),
    });
  }
  return row;
}

export { ensureClientProfileAccess as assertClientProfileAccess };
