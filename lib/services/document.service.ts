import type { Document, Prisma, PrismaClient } from "@prisma/client";
import type { StaffContext } from "./staff-context";
import { requirePropertyManagerAccess, requireStaff } from "./property-access";
import { NotFoundError } from "./errors";
import { logPropertyActivity, pickForAudit } from "./activityLog.service";

export type CreateDocumentInput = {
  propertyId: string;
  unitId?: string | null;
  tenancyId?: string | null;
  applicationId?: string | null;
  documentType: string;
  title: string;
  fileName: string;
  contentType?: string | null;
  sizeBytes?: number | null;
  storageKey: string;
  isSigned?: boolean;
  isLocked?: boolean;
};

export type UpdateDocumentMetadataInput = {
  documentType?: string;
  title?: string;
  fileName?: string;
  contentType?: string | null;
  sizeBytes?: number | null;
  isSigned?: boolean;
  isLocked?: boolean;
};

export type ListDocumentsForPropertyOptions = {
  unitId?: string;
  tenancyId?: string;
  applicationId?: string;
  documentType?: string;
};

async function getDocumentOrThrow(prisma: PrismaClient, id: string): Promise<Document> {
  const row = await prisma.document.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Document not found");
  return row;
}

/** Ensures optional FK rows exist and belong to `propertyId`. */
export async function assertDocumentScope(
  prisma: PrismaClient,
  propertyId: string,
  opts: { unitId?: string | null; tenancyId?: string | null; applicationId?: string | null }
): Promise<void> {
  if (opts.unitId) {
    const u = await prisma.unit.findFirst({ where: { id: opts.unitId, propertyId } });
    if (!u) throw new NotFoundError("Unit not found on this property");
  }
  if (opts.tenancyId) {
    const t = await prisma.tenancy.findFirst({ where: { id: opts.tenancyId, propertyId } });
    if (!t) throw new NotFoundError("Tenancy not found on this property");
  }
  if (opts.applicationId) {
    const a = await prisma.application.findFirst({ where: { id: opts.applicationId, propertyId } });
    if (!a) throw new NotFoundError("Application not found on this property");
  }
}

export async function createDocument(
  prisma: PrismaClient,
  principal: StaffContext,
  input: CreateDocumentInput
): Promise<Document> {
  requireStaff(principal);
  await requirePropertyManagerAccess(prisma, principal, input.propertyId);
  await assertDocumentScope(prisma, input.propertyId, {
    unitId: input.unitId,
    tenancyId: input.tenancyId,
    applicationId: input.applicationId,
  });

  const documentType = input.documentType.trim();
  const title = input.title.trim();
  const fileName = input.fileName.trim();
  const storageKey = input.storageKey.trim();
  if (!documentType) throw new Error("documentType is required");
  if (!title) throw new Error("title is required");
  if (!fileName) throw new Error("fileName is required");
  if (!storageKey) throw new Error("storageKey is required");
  if (input.sizeBytes != null && (!Number.isFinite(input.sizeBytes) || input.sizeBytes < 0)) {
    throw new Error("sizeBytes must be non-negative");
  }

  try {
    const row = await prisma.document.create({
      data: {
        propertyId: input.propertyId,
        unitId: input.unitId ?? null,
        tenancyId: input.tenancyId ?? null,
        applicationId: input.applicationId ?? null,
        documentType,
        title,
        fileName,
        contentType: input.contentType?.trim() || null,
        sizeBytes: input.sizeBytes != null ? Math.trunc(input.sizeBytes) : null,
        storageKey,
        isSigned: input.isSigned ?? false,
        isLocked: input.isLocked ?? false,
      },
    });
    await logPropertyActivity(prisma, principal, row.propertyId, "Document", row.id, "document.created", {
      newValues: pickForAudit(row, [
        "documentType",
        "title",
        "unitId",
        "tenancyId",
        "applicationId",
        "isSigned",
        "isLocked",
      ]),
    });
    return row;
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") {
      throw new Error("storageKey already exists");
    }
    throw e;
  }
}

export async function listDocumentsForProperty(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
  options?: ListDocumentsForPropertyOptions
): Promise<Document[]> {
  requireStaff(principal);
  await requirePropertyManagerAccess(prisma, principal, propertyId);
  return prisma.document.findMany({
    where: {
      propertyId,
      ...(options?.unitId !== undefined ? { unitId: options.unitId } : {}),
      ...(options?.tenancyId !== undefined ? { tenancyId: options.tenancyId } : {}),
      ...(options?.applicationId !== undefined ? { applicationId: options.applicationId } : {}),
      ...(options?.documentType !== undefined ? { documentType: options.documentType } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDocumentById(
  prisma: PrismaClient,
  principal: StaffContext,
  documentId: string
): Promise<Document> {
  requireStaff(principal);
  const row = await getDocumentOrThrow(prisma, documentId);
  await requirePropertyManagerAccess(prisma, principal, row.propertyId);
  return row;
}

export async function updateDocumentMetadata(
  prisma: PrismaClient,
  principal: StaffContext,
  documentId: string,
  input: UpdateDocumentMetadataInput
): Promise<Document> {
  requireStaff(principal);
  const existing = await getDocumentOrThrow(prisma, documentId);
  await requirePropertyManagerAccess(prisma, principal, existing.propertyId);
  if (existing.isLocked) throw new Error("Document is locked and cannot be updated");

  const data: Prisma.DocumentUncheckedUpdateInput = {};
  if (input.documentType !== undefined) {
    const v = input.documentType.trim();
    if (!v) throw new Error("documentType cannot be empty");
    data.documentType = v;
  }
  if (input.title !== undefined) {
    const v = input.title.trim();
    if (!v) throw new Error("title cannot be empty");
    data.title = v;
  }
  if (input.fileName !== undefined) {
    const v = input.fileName.trim();
    if (!v) throw new Error("fileName cannot be empty");
    data.fileName = v;
  }
  if (input.contentType !== undefined) data.contentType = input.contentType?.trim() || null;
  if (input.sizeBytes !== undefined) {
    if (input.sizeBytes != null && (!Number.isFinite(input.sizeBytes) || input.sizeBytes < 0)) {
      throw new Error("sizeBytes must be non-negative");
    }
    data.sizeBytes = input.sizeBytes != null ? Math.trunc(input.sizeBytes) : null;
  }
  if (input.isSigned !== undefined) data.isSigned = input.isSigned;
  if (input.isLocked !== undefined) data.isLocked = input.isLocked;

  if (Object.keys(data).length === 0) return existing;
  const row = await prisma.document.update({ where: { id: documentId }, data });
  await logPropertyActivity(prisma, principal, row.propertyId, "Document", row.id, "document.updated", {
    oldValues: pickForAudit(existing, [
      "documentType",
      "title",
      "fileName",
      "contentType",
      "sizeBytes",
      "isSigned",
      "isLocked",
    ]),
    newValues: pickForAudit(row, [
      "documentType",
      "title",
      "fileName",
      "contentType",
      "sizeBytes",
      "isSigned",
      "isLocked",
    ]),
  });
  return row;
}

export async function deleteDocument(
  prisma: PrismaClient,
  principal: StaffContext,
  documentId: string
): Promise<void> {
  requireStaff(principal);
  const existing = await getDocumentOrThrow(prisma, documentId);
  await requirePropertyManagerAccess(prisma, principal, existing.propertyId);
  if (existing.isLocked) throw new Error("Document is locked and cannot be deleted");
  await logPropertyActivity(prisma, principal, existing.propertyId, "Document", documentId, "document.deleted", {
    oldValues: pickForAudit(existing, [
      "documentType",
      "title",
      "unitId",
      "tenancyId",
      "applicationId",
    ]),
  });
  await prisma.document.delete({ where: { id: documentId } });
}
