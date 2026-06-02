import type { ApplicationDocument, PrismaClient } from "@prisma/client";
import type { StaffContext } from "./staff-context";
import { requirePropertyManagerAccess, requireStaff } from "./property-access";
import { NotFoundError } from "./errors";

export type CreateApplicationDocumentInput = {
  applicationId: string;
  fileName: string;
  contentType?: string | null;
  sizeBytes: number;
  storageKey: string;
  documentKind?: string | null;
};

async function getDocumentOrThrow(prisma: PrismaClient, id: string): Promise<ApplicationDocument> {
  const row = await prisma.applicationDocument.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Document not found");
  return row;
}

/**
 * Property managers and org admins/owners in the active org. `propertyId` is always taken from the parent
 * application (never trusted from client).
 */
export async function createApplicationDocument(
  prisma: PrismaClient,
  principal: StaffContext,
  input: CreateApplicationDocumentInput
): Promise<ApplicationDocument> {
  requireStaff(principal);
  const app = await prisma.application.findUnique({ where: { id: input.applicationId } });
  if (!app) throw new NotFoundError("Application not found");

  await requirePropertyManagerAccess(prisma, principal, app.propertyId);

  const fileName = input.fileName.trim();
  if (!fileName) throw new Error("fileName is required");
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes < 0) {
    throw new Error("sizeBytes must be a non-negative number");
  }
  const storageKey = input.storageKey.trim();
  if (!storageKey) throw new Error("storageKey is required");

  try {
    return await prisma.applicationDocument.create({
      data: {
        applicationId: app.id,
        propertyId: app.propertyId,
        fileName,
        contentType: input.contentType?.trim() || null,
        sizeBytes: Math.trunc(input.sizeBytes),
        storageKey,
        documentKind: input.documentKind?.trim() || null,
      },
    });
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") {
      throw new Error("storageKey already exists");
    }
    throw e;
  }
}

/** Property managers and org admins/owners for this application’s property. */
export async function listApplicationDocuments(
  prisma: PrismaClient,
  principal: StaffContext,
  applicationId: string
): Promise<ApplicationDocument[]> {
  requireStaff(principal);
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new NotFoundError("Application not found");
  await requirePropertyManagerAccess(prisma, principal, app.propertyId);

  return prisma.applicationDocument.findMany({
    where: { applicationId },
    orderBy: { createdAt: "asc" },
  });
}

/** Property managers and org admins/owners in the active org. */
export async function deleteApplicationDocument(
  prisma: PrismaClient,
  principal: StaffContext,
  documentId: string
): Promise<void> {
  requireStaff(principal);
  const doc = await getDocumentOrThrow(prisma, documentId);
  await requirePropertyManagerAccess(prisma, principal, doc.propertyId);
  await prisma.applicationDocument.delete({ where: { id: documentId } });
}
