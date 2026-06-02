import type { Prisma, PrismaClient, SignatureRequest, SignatureRequestStatus } from "@prisma/client";
import type { StaffContext } from "./staff-context";
import { requirePropertyManagerAccess, requireStaff } from "./property-access";
import { NotFoundError } from "./errors";
import { logPropertyActivity, pickForAudit } from "./activityLog.service";

export type CreateSignatureRequestInput = {
  propertyId: string;
  /** XOR: exactly one of tenancyId or applicationId must be set. */
  tenancyId?: string | null;
  applicationId?: string | null;
  provider: string;
  providerRequestId?: string | null;
  status?: SignatureRequestStatus;
};

export type UpdateSignatureRequestInput = {
  provider?: string;
  providerRequestId?: string | null;
  status?: SignatureRequestStatus;
  sentAt?: Date | null;
  completedAt?: Date | null;
};

async function getSignatureRequestOrThrow(prisma: PrismaClient, id: string): Promise<SignatureRequest> {
  const row = await prisma.signatureRequest.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Signature request not found");
  return row;
}

function assertTenancyXorApplication(
  tenancyId: string | null | undefined,
  applicationId: string | null | undefined
): void {
  const hasT = Boolean(tenancyId);
  const hasA = Boolean(applicationId);
  if (hasT === hasA) {
    throw new Error("Exactly one of tenancyId or applicationId is required");
  }
}

export async function createSignatureRequest(
  prisma: PrismaClient,
  principal: StaffContext,
  input: CreateSignatureRequestInput
): Promise<SignatureRequest> {
  requireStaff(principal);
  await requirePropertyManagerAccess(prisma, principal, input.propertyId);
  assertTenancyXorApplication(input.tenancyId, input.applicationId);

  const provider = input.provider.trim();
  if (!provider) throw new Error("provider is required");

  if (input.tenancyId) {
    const t = await prisma.tenancy.findFirst({
      where: { id: input.tenancyId, propertyId: input.propertyId },
    });
    if (!t) throw new NotFoundError("Tenancy not found on this property");
  }
  if (input.applicationId) {
    const a = await prisma.application.findFirst({
      where: { id: input.applicationId, propertyId: input.propertyId },
    });
    if (!a) throw new NotFoundError("Application not found on this property");
  }

  const row = await prisma.signatureRequest.create({
    data: {
      propertyId: input.propertyId,
      tenancyId: input.tenancyId ?? null,
      applicationId: input.applicationId ?? null,
      provider,
      providerRequestId: input.providerRequestId?.trim() || null,
      status: input.status ?? "draft",
    },
  });
  await logPropertyActivity(prisma, principal, row.propertyId, "SignatureRequest", row.id, "signature_request.created", {
    newValues: pickForAudit(row, ["tenancyId", "applicationId", "provider", "status"]),
  });
  return row;
}

/** Narrow helper: status + optional timestamps when moving through the lifecycle. */
export async function updateSignatureRequestStatus(
  prisma: PrismaClient,
  principal: StaffContext,
  id: string,
  input: Pick<UpdateSignatureRequestInput, "status" | "sentAt" | "completedAt"> &
    Partial<Pick<UpdateSignatureRequestInput, "providerRequestId">>
): Promise<SignatureRequest> {
  return updateSignatureRequest(prisma, principal, id, input);
}

export async function updateSignatureRequest(
  prisma: PrismaClient,
  principal: StaffContext,
  id: string,
  input: UpdateSignatureRequestInput
): Promise<SignatureRequest> {
  requireStaff(principal);
  const existing = await getSignatureRequestOrThrow(prisma, id);
  await requirePropertyManagerAccess(prisma, principal, existing.propertyId);

  const data: Prisma.SignatureRequestUncheckedUpdateInput = {};
  if (input.provider !== undefined) {
    const v = input.provider.trim();
    if (!v) throw new Error("provider cannot be empty");
    data.provider = v;
  }
  if (input.providerRequestId !== undefined) data.providerRequestId = input.providerRequestId?.trim() || null;
  if (input.status !== undefined) data.status = input.status;
  if (input.sentAt !== undefined) data.sentAt = input.sentAt;
  if (input.completedAt !== undefined) data.completedAt = input.completedAt;

  if (Object.keys(data).length === 0) return existing;
  const row = await prisma.signatureRequest.update({ where: { id }, data });
  const action =
    input.status !== undefined && input.status !== existing.status
      ? "signature_request.status_changed"
      : "signature_request.updated";
  await logPropertyActivity(prisma, principal, row.propertyId, "SignatureRequest", row.id, action, {
    oldValues: pickForAudit(existing, ["status", "provider", "providerRequestId", "sentAt", "completedAt"]),
    newValues: pickForAudit(row, ["status", "provider", "providerRequestId", "sentAt", "completedAt"]),
  });
  return row;
}

export async function getSignatureRequestById(
  prisma: PrismaClient,
  principal: StaffContext,
  id: string
): Promise<SignatureRequest> {
  requireStaff(principal);
  const row = await getSignatureRequestOrThrow(prisma, id);
  await requirePropertyManagerAccess(prisma, principal, row.propertyId);
  return row;
}

export async function listSignatureRequestsForProperty(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
  options?: { status?: SignatureRequestStatus }
): Promise<SignatureRequest[]> {
  requireStaff(principal);
  await requirePropertyManagerAccess(prisma, principal, propertyId);
  return prisma.signatureRequest.findMany({
    where: {
      propertyId,
      ...(options?.status !== undefined ? { status: options.status } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}
