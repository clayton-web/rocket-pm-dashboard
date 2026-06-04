import type { Document, LeaseSignature, PrismaClient, SignatureRequest } from "@prisma/client";
import { parseLeaseSetupJson } from "@/lib/leasing/lease-setup";
import { assessLeaseSetupReadiness } from "@/lib/leasing/lease-setup-readiness";
import {
  assertLeaseSigningTransition,
  deriveLeaseSigningProgress,
  isActiveLeaseSignatureRequest,
  type LeaseSigningProgress,
} from "@/lib/leasing/lease-signing-progress";
import {
  buildSignatureImageStorageKey,
  parseSignaturePngDataUrl,
} from "@/lib/leasing/lease-signing-signature-image";
import {
  generateLeaseSigningToken,
  hashLeaseSigningToken,
  isValidLeaseSigningTokenFormat,
  leaseSigningTokenExpiresAt,
  tokensMatch,
} from "@/lib/leasing/lease-signing-token";
import {
  LEASE_SIGNING_PROVIDER,
  RTB1_DOCUMENT_TYPE,
  RTB1_EXECUTED_DOCUMENT_TYPE,
  RTB1_TEMPLATE_VERSION,
} from "@/lib/leasing/rtb1/constants";
import { createExecutedRtb1Pdf } from "@/lib/leasing/rtb1/execute-rtb1-pdf";
import { getOrganizationLandlordProfileForStaff } from "@/lib/org/organization-landlord-profile";
import { createDocument } from "@/lib/services/document.service";
import { NotFoundError } from "@/lib/services/errors";
import type { StaffContext } from "@/lib/services/staff-context";
import { getTenancyById } from "@/lib/services/tenancy.service";
import {
  buildTenancyDocumentStorageKey,
  readLocalDocument,
  writeLocalDocument,
} from "@/lib/storage/local-document-storage";
import { createSignatureRequest, updateSignatureRequestStatus } from "@/lib/services/signatureRequest.service";

export class LeaseSigningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeaseSigningError";
  }
}

export type SendLeaseForSignatureResult = {
  signatureRequestId: string;
  signingUrl: string;
  signingToken: string;
};

export type TenantSigningContext = {
  propertyName: string;
  unitLabel: string;
  tenantExpectedName: string;
  draftDocumentId: string;
  draftFileName: string;
  alreadySigned: boolean;
  signerName: string | null;
  signedAt: string | null;
  expired: boolean;
};

export type SubmitLeaseSignatureInput = {
  signerName: string;
  acknowledgedReview: boolean;
  signatureDataUrl: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type SignatureRequestWithRelations = SignatureRequest & {
  signatures: LeaseSignature[];
  draftDocument: Document | null;
  tenancy?: {
    id: string;
    propertyId: string;
    leaseSetupJson: unknown;
    property: { name: string };
    unit: { unitNumber: string } | null;
    contacts: Array<{ id: string; firstName: string; lastName: string }>;
  } | null;
};

async function getLatestRtb1Draft(
  prisma: PrismaClient,
  tenancyId: string,
): Promise<Document | null> {
  return prisma.document.findFirst({
    where: { tenancyId, documentType: RTB1_DOCUMENT_TYPE, isLocked: false },
    orderBy: { createdAt: "desc" },
  });
}

async function getActiveLeaseSignatureRequest(
  prisma: PrismaClient,
  tenancyId: string,
): Promise<SignatureRequestWithRelations | null> {
  const rows = await prisma.signatureRequest.findMany({
    where: {
      tenancyId,
      provider: LEASE_SIGNING_PROVIDER,
      status: { in: ["draft", "sent", "viewed"] },
    },
    include: { signatures: true, draftDocument: true },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  return rows[0] ?? null;
}

async function getLeaseSignatureRequestByToken(
  prisma: PrismaClient,
  token: string,
): Promise<SignatureRequestWithRelations | null> {
  if (!isValidLeaseSigningTokenFormat(token)) return null;
  const tokenHash = hashLeaseSigningToken(token);
  return prisma.signatureRequest.findUnique({
    where: { signingTokenHash: tokenHash },
    include: {
      signatures: true,
      draftDocument: true,
      tenancy: {
        include: {
          property: { select: { name: true } },
          unit: { select: { unitNumber: true } },
          contacts: {
            where: { contactType: { in: ["tenant", "co_tenant"] } },
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        },
      },
    },
  });
}

function assertTokenAccessibleForRead(
  request: SignatureRequestWithRelations,
  token: string,
): void {
  if (!request.signingTokenHash || !tokensMatch(request.signingTokenHash, token)) {
    throw new LeaseSigningError("Invalid signing link");
  }
  if (request.signingTokenExpiresAt && request.signingTokenExpiresAt.getTime() < Date.now()) {
    throw new LeaseSigningError("This signing link has expired");
  }
}

function assertTokenUsable(
  request: SignatureRequestWithRelations,
  token: string,
): void {
  assertTokenAccessibleForRead(request, token);
  if (!isActiveLeaseSignatureRequest(request.status)) {
    throw new LeaseSigningError("This signing request is no longer active");
  }
  if (!request.draftDocument) {
    throw new LeaseSigningError("RTB-1 draft document is missing");
  }
}

export async function sendLeaseForSignature(
  prisma: PrismaClient,
  ctx: StaffContext,
  tenancyId: string,
  draftDocumentId?: string,
): Promise<SendLeaseForSignatureResult> {
  const tenancy = await getTenancyById(prisma, ctx, tenancyId);
  const leaseSetup = parseLeaseSetupJson(tenancy.leaseSetupJson);
  const orgProfile = await getOrganizationLandlordProfileForStaff(ctx);
  const readiness = assessLeaseSetupReadiness({
    org: orgProfile,
    setup: leaseSetup,
    tenancy: {
      leaseStartDate: tenancy.leaseStartDate,
      leaseEndDate: tenancy.leaseEndDate,
      rentDueDay: tenancy.rentDueDay,
      monthlyRent: Number(tenancy.monthlyRent),
      securityDeposit: Number(tenancy.securityDeposit),
      petDeposit: tenancy.petDeposit != null ? Number(tenancy.petDeposit) : null,
    },
  });

  if (readiness.status !== "ready_for_rtb1") {
    throw new LeaseSigningError(
      "Lease setup must be complete and ready for RTB-1 before sending for signature.",
    );
  }

  const draft =
    draftDocumentId != null
      ? await prisma.document.findFirst({
          where: {
            id: draftDocumentId,
            tenancyId: tenancy.id,
            propertyId: tenancy.propertyId,
            documentType: RTB1_DOCUMENT_TYPE,
            isLocked: false,
          },
        })
      : await getLatestRtb1Draft(prisma, tenancy.id);

  if (!draft) {
    throw new LeaseSigningError("Generate an RTB-1 draft before sending for signature.");
  }

  const active = await getActiveLeaseSignatureRequest(prisma, tenancy.id);
  if (active) {
    throw new LeaseSigningError("A signature request is already in progress for this tenancy.");
  }

  const completed = await prisma.signatureRequest.findFirst({
    where: {
      tenancyId: tenancy.id,
      provider: LEASE_SIGNING_PROVIDER,
      status: "completed",
      documentId: draft.id,
    },
  });
  if (completed) {
    throw new LeaseSigningError("This RTB-1 draft has already been executed.");
  }

  const { token, tokenHash } = generateLeaseSigningToken();
  const expiresAt = leaseSigningTokenExpiresAt();
  const sentAt = new Date();

  const created = await createSignatureRequest(prisma, ctx, {
    propertyId: tenancy.propertyId,
    tenancyId: tenancy.id,
    provider: LEASE_SIGNING_PROVIDER,
    status: "draft",
  });

  await prisma.signatureRequest.update({
    where: { id: created.id },
    data: {
      documentId: draft.id,
      signingTokenHash: tokenHash,
      signingTokenExpiresAt: expiresAt,
    },
  });

  await updateSignatureRequestStatus(prisma, ctx, created.id, {
    status: "sent",
    sentAt,
  });

  return {
    signatureRequestId: created.id,
    signingToken: token,
    signingUrl: `/sign/lease/${token}`,
  };
}

export async function getLeaseSigningProgressForTenancy(
  prisma: PrismaClient,
  ctx: StaffContext,
  tenancyId: string,
  options?: { signingToken?: string | null },
): Promise<LeaseSigningProgress> {
  const tenancy = await getTenancyById(prisma, ctx, tenancyId);
  const leaseSetup = parseLeaseSetupJson(tenancy.leaseSetupJson);
  const orgProfile = await getOrganizationLandlordProfileForStaff(ctx);
  const readiness = assessLeaseSetupReadiness({
    org: orgProfile,
    setup: leaseSetup,
    tenancy: {
      leaseStartDate: tenancy.leaseStartDate,
      leaseEndDate: tenancy.leaseEndDate,
      rentDueDay: tenancy.rentDueDay,
      monthlyRent: Number(tenancy.monthlyRent),
      securityDeposit: Number(tenancy.securityDeposit),
      petDeposit: tenancy.petDeposit != null ? Number(tenancy.petDeposit) : null,
    },
  });

  const [latestDraft, signatureRequest, executedDocument] = await Promise.all([
    getLatestRtb1Draft(prisma, tenancy.id),
    prisma.signatureRequest.findFirst({
      where: { tenancyId: tenancy.id, provider: LEASE_SIGNING_PROVIDER },
      include: { signatures: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.document.findFirst({
      where: { tenancyId: tenancy.id, documentType: RTB1_EXECUTED_DOCUMENT_TYPE },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true },
    }),
  ]);

  return deriveLeaseSigningProgress({
    latestDraft,
    signatureRequest,
    executedDocument,
    readinessComplete: readiness.status === "ready_for_rtb1",
    signingToken: options?.signingToken ?? null,
  });
}

export async function getTenantSigningContextByToken(
  prisma: PrismaClient,
  token: string,
): Promise<TenantSigningContext> {
  const request = await getLeaseSignatureRequestByToken(prisma, token);
  if (!request || !request.tenancy) {
    throw new NotFoundError("Signing link not found");
  }

  const expired = Boolean(
    request.signingTokenExpiresAt && request.signingTokenExpiresAt.getTime() < Date.now(),
  );

  if (!expired && request.status !== "completed") {
    assertTokenUsable(request, token);
    if (request.status === "sent") {
      await prisma.signatureRequest.update({
        where: { id: request.id },
        data: { status: "viewed" },
      });
    }
  } else if (!expired && request.status === "completed") {
    if (!request.signingTokenHash || !tokensMatch(request.signingTokenHash, token)) {
      throw new NotFoundError("Signing link not found");
    }
  }

  const tenantContact = request.tenancy.contacts[0];
  const tenantExpectedName = tenantContact
    ? `${tenantContact.firstName} ${tenantContact.lastName}`.trim()
    : "Tenant";
  const tenantSig = request.signatures.find((s) => s.signerRole === "tenant");

  return {
    propertyName: request.tenancy.property.name,
    unitLabel: request.tenancy.unit?.unitNumber
      ? `Unit ${request.tenancy.unit.unitNumber}`
      : "Unit",
    tenantExpectedName,
    draftDocumentId: request.draftDocument?.id ?? "",
    draftFileName: request.draftDocument?.fileName ?? "rtb1-draft.pdf",
    alreadySigned: tenantSig != null,
    signerName: tenantSig?.signerName ?? null,
    signedAt: tenantSig?.signedAt.toISOString() ?? null,
    expired,
  };
}

export async function readLeaseDraftPdfByToken(
  prisma: PrismaClient,
  token: string,
): Promise<{ bytes: Uint8Array; fileName: string; contentType: string }> {
  const request = await getLeaseSignatureRequestByToken(prisma, token);
  if (!request?.draftDocument) {
    throw new NotFoundError("Signing link not found");
  }
  assertTokenAccessibleForRead(request, token);
  const bytes = await readLocalDocument(request.draftDocument.storageKey);
  return {
    bytes,
    fileName: request.draftDocument.fileName,
    contentType: request.draftDocument.contentType ?? "application/pdf",
  };
}

export async function submitTenantLeaseSignature(
  prisma: PrismaClient,
  token: string,
  input: SubmitLeaseSignatureInput,
): Promise<void> {
  if (!input.acknowledgedReview) {
    throw new LeaseSigningError("You must confirm that you have reviewed the agreement");
  }
  const signerName = input.signerName.trim();
  if (!signerName) {
    throw new LeaseSigningError("Legal name is required");
  }

  const request = await getLeaseSignatureRequestByToken(prisma, token);
  if (!request?.tenancy) {
    throw new NotFoundError("Signing link not found");
  }
  assertTokenUsable(request, token);

  const hasTenant = request.signatures.some((s) => s.signerRole === "tenant");
  const hasPm = request.signatures.some((s) => s.signerRole === "property_manager");
  assertLeaseSigningTransition({ hasTenantSignature: hasTenant, hasPmSignature: hasPm, target: "tenant" });

  const pngBytes = parseSignaturePngDataUrl(input.signatureDataUrl);
  const signedAt = new Date();
  const primaryContact = request.tenancy.contacts[0];

  const property = await prisma.property.findUnique({
    where: { id: request.propertyId },
    select: { organizationId: true },
  });
  if (!property) throw new NotFoundError("Property not found");

  const storageKey = buildSignatureImageStorageKey({
    organizationId: property.organizationId,
    propertyId: request.propertyId,
    tenancyId: request.tenancyId!,
    signatureRequestId: request.id,
    signerRole: "tenant",
  });

  await writeLocalDocument(storageKey, pngBytes);

  await prisma.leaseSignature.create({
    data: {
      signatureRequestId: request.id,
      signerRole: "tenant",
      signerName,
      signedAt,
      ipAddress: input.ipAddress?.trim() || null,
      userAgent: input.userAgent?.trim() || null,
      signatureImageStorageKey: storageKey,
      tenancyContactId: primaryContact?.id ?? null,
    },
  });
}

export async function submitPmLeaseSignature(
  prisma: PrismaClient,
  ctx: StaffContext,
  signatureRequestId: string,
  input: SubmitLeaseSignatureInput,
): Promise<Document> {
  if (!input.acknowledgedReview) {
    throw new LeaseSigningError("You must confirm that you have reviewed the agreement");
  }
  const signerName = input.signerName.trim();
  if (!signerName) {
    throw new LeaseSigningError("Legal name is required");
  }

  const request = await prisma.signatureRequest.findUnique({
    where: { id: signatureRequestId },
    include: {
      signatures: true,
      draftDocument: true,
      tenancy: true,
    },
  });
  if (!request?.tenancyId || !request.draftDocument) {
    throw new NotFoundError("Signature request not found");
  }

  await getTenancyById(prisma, ctx, request.tenancyId);

  const hasTenant = request.signatures.some((s) => s.signerRole === "tenant");
  const hasPm = request.signatures.some((s) => s.signerRole === "property_manager");
  assertLeaseSigningTransition({
    hasTenantSignature: hasTenant,
    hasPmSignature: hasPm,
    target: "property_manager",
  });

  const pngBytes = parseSignaturePngDataUrl(input.signatureDataUrl);
  const signedAt = new Date();

  const property = await prisma.property.findUnique({
    where: { id: request.propertyId },
    select: { organizationId: true },
  });
  if (!property) throw new NotFoundError("Property not found");

  const pmStorageKey = buildSignatureImageStorageKey({
    organizationId: property.organizationId,
    propertyId: request.propertyId,
    tenancyId: request.tenancyId,
    signatureRequestId: request.id,
    signerRole: "property_manager",
  });
  await writeLocalDocument(pmStorageKey, pngBytes);

  await prisma.leaseSignature.create({
    data: {
      signatureRequestId: request.id,
      signerRole: "property_manager",
      signerName,
      signedAt,
      ipAddress: input.ipAddress?.trim() || null,
      userAgent: input.userAgent?.trim() || null,
      signatureImageStorageKey: pmStorageKey,
    },
  });

  const updatedSignatures = await prisma.leaseSignature.findMany({
    where: { signatureRequestId: request.id },
  });

  const tenantSig = updatedSignatures.find((s) => s.signerRole === "tenant");
  const pmSig = updatedSignatures.find((s) => s.signerRole === "property_manager");
  if (!tenantSig || !pmSig) {
    throw new LeaseSigningError("Both signatures are required before execution");
  }

  const [tenantImage, pmImage, draftBytes] = await Promise.all([
    readLocalDocument(tenantSig.signatureImageStorageKey),
    readLocalDocument(pmSig.signatureImageStorageKey),
    readLocalDocument(request.draftDocument.storageKey),
  ]);

  const tenancy = request.tenancy!;
  const leaseSetup = parseLeaseSetupJson(tenancy.leaseSetupJson);
  const orgProfile = await getOrganizationLandlordProfileForStaff(ctx);
  const vacateClauseApplies =
    leaseSetup.tenancyType === "fixed_term" && leaseSetup.fixedTermEndBehavior === "vacate";

  const executedBytes = await createExecutedRtb1Pdf({
    draftPdfBytes: draftBytes,
    signers: [
      {
        role: "tenant",
        signerName: tenantSig.signerName,
        signedAt: tenantSig.signedAt,
        signatureImagePng: tenantImage,
      },
      {
        role: "property_manager",
        signerName: pmSig.signerName,
        signedAt: pmSig.signedAt,
        signatureImagePng: pmImage,
      },
    ],
    vacateClauseApplies,
    landlordDisplayName: orgProfile.landlordLegalName?.trim() ?? signerName,
  });

  const generatedAt = new Date();
  const fileName = `rtb1-executed-${RTB1_TEMPLATE_VERSION.replace("/", "-")}-${generatedAt.toISOString().slice(0, 10)}.pdf`;
  const title = `RTB-1 Executed (${RTB1_TEMPLATE_VERSION})`;
  const storageKey = buildTenancyDocumentStorageKey({
    organizationId: property.organizationId,
    propertyId: request.propertyId,
    tenancyId: request.tenancyId,
    documentId: `${request.id}-executed`,
    fileName,
  });

  await writeLocalDocument(storageKey, executedBytes);

  const executedDocument = await createDocument(prisma, ctx, {
    propertyId: request.propertyId,
    unitId: request.draftDocument.unitId,
    tenancyId: request.tenancyId,
    documentType: RTB1_EXECUTED_DOCUMENT_TYPE,
    title,
    fileName,
    contentType: "application/pdf",
    sizeBytes: executedBytes.length,
    storageKey,
    isSigned: true,
    isLocked: true,
  });

  await updateSignatureRequestStatus(prisma, ctx, request.id, {
    status: "completed",
    completedAt: generatedAt,
  });

  await prisma.signatureRequest.update({
    where: { id: request.id },
    data: { executedDocumentId: executedDocument.id },
  });

  return executedDocument;
}

export async function refreshLeaseSigningLink(
  prisma: PrismaClient,
  ctx: StaffContext,
  signatureRequestId: string,
): Promise<SendLeaseForSignatureResult> {
  const request = await getSignatureRequestForStaff(prisma, ctx, signatureRequestId);
  if (!request.tenancyId) {
    throw new LeaseSigningError("Invalid signature request");
  }
  if (!isActiveLeaseSignatureRequest(request.status)) {
    throw new LeaseSigningError("Signature request is not active");
  }
  if (request.signatures.some((s) => s.signerRole === "tenant")) {
    throw new LeaseSigningError("Cannot refresh link after tenant has signed");
  }

  const { token, tokenHash } = generateLeaseSigningToken();
  await prisma.signatureRequest.update({
    where: { id: request.id },
    data: {
      signingTokenHash: tokenHash,
      signingTokenExpiresAt: leaseSigningTokenExpiresAt(),
      status: "sent",
      sentAt: new Date(),
    },
  });

  return {
    signatureRequestId: request.id,
    signingToken: token,
    signingUrl: `/sign/lease/${token}`,
  };
}

export async function getSignatureRequestForStaff(
  prisma: PrismaClient,
  ctx: StaffContext,
  signatureRequestId: string,
): Promise<SignatureRequestWithRelations> {
  const request = await prisma.signatureRequest.findUnique({
    where: { id: signatureRequestId },
    include: { signatures: true, draftDocument: true },
  });
  if (!request) throw new NotFoundError("Signature request not found");
  if (request.tenancyId) {
    await getTenancyById(prisma, ctx, request.tenancyId);
  }
  return request;
}
