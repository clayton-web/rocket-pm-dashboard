import type { Application, ApplicationStatus, Prisma, PrismaClient, Prospect } from "@prisma/client";
import type { StaffContext } from "./staff-context";
import { requirePropertyManagerAccess, requireStaff } from "./property-access";
import { NotFoundError } from "./errors";
import { logActivity, logStaffActivity } from "./activityLog.service";
import { normalizeApplicationEmail } from "@/lib/leasing/application-email";
import {
  assertProspectForApplicationStart,
  findProspectForApplicationMatch,
} from "@/lib/leasing/prospect-match";

export type StartPublicApplicationInput = {
  propertyId: string;
  unitId: string;
  email: string;
  prospectId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
};

export { normalizeApplicationEmail } from "@/lib/leasing/application-email";

export type UpdateDraftApplicationInput = Partial<
  Pick<
    Application,
    | "firstName"
    | "lastName"
    | "phone"
    | "currentAddress"
    | "desiredMoveInDate"
    | "occupantCount"
    | "monthlyIncome"
    | "hasPets"
    | "petDetails"
    | "smokerStatus"
    | "employerName"
    | "jobTitle"
    | "employmentNotes"
    | "emergencyContactFirstName"
    | "emergencyContactLastName"
    | "emergencyContactPhone"
    | "emergencyContactEmail"
  >
>;

export type SubmitApplicationInput = {
  consentCreditCheck: boolean;
  consentSignatureName: string;
  consentIpAddress?: string | null;
  consentUserAgent?: string | null;
};

export type SetApplicationReviewInput = {
  status: Extract<ApplicationStatus, "under_review" | "approved" | "declined">;
};

export type ListApplicationsForPropertyOptions = {
  status?: ApplicationStatus;
};

async function getApplicationOrThrow(prisma: PrismaClient, id: string): Promise<Application> {
  const row = await prisma.application.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Application not found");
  return row;
}

function assertPublicDraftAccess(app: Application, expectedEmail: string): void {
  if (app.status !== "draft") throw new Error("Application is not editable");
  if (normalizeApplicationEmail(expectedEmail) !== normalizeApplicationEmail(app.email)) {
    throw new Error("Email does not match this application");
  }
}

function assertSubmittedForReview(app: Application): void {
  if (app.status !== "submitted" && app.status !== "under_review") {
    throw new Error("Application is not in a reviewable state");
  }
}

function validateReadyToSubmit(app: Application): void {
  const missing: string[] = [];
  if (!app.firstName?.trim()) missing.push("firstName");
  if (!app.lastName?.trim()) missing.push("lastName");
  if (!app.phone?.trim()) missing.push("phone");
  if (!app.currentAddress?.trim()) missing.push("currentAddress");
  if (!app.desiredMoveInDate) missing.push("desiredMoveInDate");
  if (app.occupantCount == null || app.occupantCount < 1) missing.push("occupantCount");
  if (app.monthlyIncome == null) missing.push("monthlyIncome");
  if (!app.smokerStatus?.trim()) missing.push("smokerStatus");
  if (!app.employerName?.trim()) missing.push("employerName");
  if (!app.jobTitle?.trim()) missing.push("jobTitle");
  if (app.hasPets && !app.petDetails?.trim()) missing.push("petDetails");
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }
}

/**
 * Public: start an application on an active property/unit. Does not require auth.
 */
export async function startPublicApplication(
  prisma: PrismaClient,
  input: StartPublicApplicationInput
): Promise<Application> {
  const property = await prisma.property.findFirst({
    where: { id: input.propertyId, isActive: true },
  });
  if (!property) throw new NotFoundError("Property not found or inactive");

  const unit = await prisma.unit.findFirst({
    where: { id: input.unitId, propertyId: input.propertyId, isActive: true },
  });
  if (!unit) throw new NotFoundError("Unit not found, inactive, or not on this property");

  const email = normalizeApplicationEmail(input.email);
  if (!email) throw new Error("Email is required");

  let prospect: Prospect | null = null;
  if (input.prospectId?.trim()) {
    prospect = await assertProspectForApplicationStart(prisma, {
      prospectId: input.prospectId.trim(),
      propertyId: input.propertyId,
      unitId: input.unitId,
      email,
    });
  }

  const app = await prisma.application.create({
    data: {
      propertyId: input.propertyId,
      unitId: input.unitId,
      email,
      prospectId: prospect?.id ?? null,
      firstName: input.firstName?.trim() || prospect?.firstName || null,
      lastName: input.lastName?.trim() || prospect?.lastName || null,
      phone: input.phone?.trim() || prospect?.phone || null,
      desiredMoveInDate: prospect?.desiredMoveInDate ?? null,
      occupantCount: prospect?.occupantCount ?? null,
      hasPets: prospect?.hasPets ?? false,
      petDetails: prospect?.petDetails ?? null,
      smokerStatus: prospect?.smokerStatus ?? null,
      status: "draft",
    },
  });

  if (!prospect) {
    await maybeLinkProspectForDraftApplication(prisma, app.id, app.email);
  }
  return getApplicationOrThrow(prisma, app.id);
}

/**
 * Public: save partial draft data. `expectedEmail` must match the application’s email.
 */
export async function updateDraftApplication(
  prisma: PrismaClient,
  applicationId: string,
  expectedEmail: string,
  input: UpdateDraftApplicationInput
): Promise<Application> {
  const existing = await getApplicationOrThrow(prisma, applicationId);
  assertPublicDraftAccess(existing, expectedEmail);

  const data: Prisma.ApplicationUncheckedUpdateInput = {};
  if (input.firstName !== undefined) data.firstName = input.firstName?.trim() || null;
  if (input.lastName !== undefined) data.lastName = input.lastName?.trim() || null;
  if (input.phone !== undefined) data.phone = input.phone?.trim() || null;
  if (input.currentAddress !== undefined) data.currentAddress = input.currentAddress?.trim() || null;
  if (input.desiredMoveInDate !== undefined) data.desiredMoveInDate = input.desiredMoveInDate;
  if (input.occupantCount !== undefined) data.occupantCount = input.occupantCount;
  if (input.monthlyIncome !== undefined) data.monthlyIncome = input.monthlyIncome;
  if (input.hasPets !== undefined) data.hasPets = input.hasPets;
  if (input.petDetails !== undefined) data.petDetails = input.petDetails?.trim() || null;
  if (input.smokerStatus !== undefined) data.smokerStatus = input.smokerStatus?.trim() || null;
  if (input.employerName !== undefined) data.employerName = input.employerName?.trim() || null;
  if (input.jobTitle !== undefined) data.jobTitle = input.jobTitle?.trim() || null;
  if (input.employmentNotes !== undefined) data.employmentNotes = input.employmentNotes?.trim() || null;

  if (Object.keys(data).length === 0) return existing;
  const updated = await prisma.application.update({
    where: { id: applicationId },
    data,
  });
  await maybeLinkProspectForDraftApplication(prisma, updated.id, updated.email);
  return getApplicationOrThrow(prisma, updated.id);
}

/**
 * Public: submit draft → `submitted`. Stamps consent server-side.
 */
export async function submitApplication(
  prisma: PrismaClient,
  applicationId: string,
  expectedEmail: string,
  input: SubmitApplicationInput
): Promise<Application> {
  const existing = await getApplicationOrThrow(prisma, applicationId);
  assertPublicDraftAccess(existing, expectedEmail);
  validateReadyToSubmit(existing);

  if (!input.consentCreditCheck) {
    throw new Error("Credit check consent is required");
  }
  const sig = input.consentSignatureName.trim();
  if (!sig) throw new Error("Consent signature name is required");

  const now = new Date();
  const row = await prisma.application.update({
    where: { id: applicationId },
    data: {
      status: "submitted",
      submittedAt: now,
      consentCreditCheck: true,
      consentSignatureName: sig,
      consentSignedAt: now,
      consentIpAddress: input.consentIpAddress?.trim() || null,
      consentUserAgent: input.consentUserAgent?.trim() || null,
    },
  });
  await logActivity(prisma, {
    propertyId: row.propertyId,
    actorUserId: null,
    entityType: "Application",
    entityId: row.id,
    action: "application.submitted",
    newValues: { status: row.status, submittedAt: row.submittedAt },
  });
  return row;
}

/**
 * If a prospect matches same property + email (+ unit rules), set `prospectId`. Draft only.
 * Alias: `maybeLinkProspectByEmail`.
 */
export async function maybeLinkProspectForDraftApplication(
  prisma: PrismaClient,
  applicationId: string,
  expectedEmail: string
): Promise<Application> {
  const app = await getApplicationOrThrow(prisma, applicationId);
  assertPublicDraftAccess(app, expectedEmail);

  const match = await findProspectForApplicationMatch(prisma, {
    propertyId: app.propertyId,
    unitId: app.unitId,
    email: app.email,
  });

  if (!match) {
    return app;
  }

  if (app.prospectId === match.id) return app;
  return prisma.application.update({
    where: { id: applicationId },
    data: { prospectId: match.id },
  });
}

/** @see maybeLinkProspectForDraftApplication */
export const maybeLinkProspectByEmail = maybeLinkProspectForDraftApplication;

/** Public resume flow: draft only, email must match. */
export async function getDraftApplicationForPublic(
  prisma: PrismaClient,
  applicationId: string,
  expectedEmail: string
): Promise<Application> {
  const app = await getApplicationOrThrow(prisma, applicationId);
  assertPublicDraftAccess(app, expectedEmail);
  return app;
}

/** Property managers and org admins/owners in the active org. Field agents fail `requirePropertyManagerAccess`. */
export async function getApplicationById(
  prisma: PrismaClient,
  principal: StaffContext,
  applicationId: string
): Promise<Application> {
  requireStaff(principal);
  const app = await getApplicationOrThrow(prisma, applicationId);
  await requirePropertyManagerAccess(prisma, principal, app.propertyId);
  return app;
}

export async function listApplicationsForProperty(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
  options?: ListApplicationsForPropertyOptions
): Promise<Application[]> {
  requireStaff(principal);
  await requirePropertyManagerAccess(prisma, principal, propertyId);
  return prisma.application.findMany({
    where: {
      propertyId,
      ...(options?.status !== undefined ? { status: options.status } : {}),
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
  });
}

/**
 * PM review: move between `under_review`, `approved`, `declined` from `submitted` / `under_review`.
 * Sets `reviewedByUserId` and `decisionAt` when approving or declining.
 */
export async function setApplicationReviewStatus(
  prisma: PrismaClient,
  principal: StaffContext,
  applicationId: string,
  input: SetApplicationReviewInput
): Promise<Application> {
  requireStaff(principal);
  const app = await getApplicationOrThrow(prisma, applicationId);
  await requirePropertyManagerAccess(prisma, principal, app.propertyId);
  assertSubmittedForReview(app);

  const now = new Date();
  const data: Prisma.ApplicationUncheckedUpdateInput = {
    status: input.status,
    reviewedByUserId: principal.userId,
  };

  if (input.status === "approved" || input.status === "declined") {
    data.decisionAt = now;
  }
  if (input.status === "under_review") {
    data.decisionAt = null;
  }

  const prevStatus = app.status;
  const row = await prisma.application.update({
    where: { id: applicationId },
    data,
  });
  await logStaffActivity(prisma, principal, {
    propertyId: row.propertyId,
    entityType: "Application",
    entityId: row.id,
    action: "application.review_updated",
    oldValues: { status: prevStatus },
    newValues: { status: row.status, decisionAt: row.decisionAt },
  });
  return row;
}
