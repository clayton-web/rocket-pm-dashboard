import type { Document, PrismaClient } from "@prisma/client";
import { pickPrimaryTenancy, type PortfolioHealthTenancyInput } from "@/lib/property/portfolio-health";
import {
  assertDocumentTypeMatchesScope,
  documentScopeFromRecord,
  documentScopeLabel,
  documentTypeLabel,
  isStaffUploadDocumentType,
  isSystemManagedDocumentType,
  type PropertyDocumentScope,
  type StaffPropertyDocumentType,
  staffDocumentTypesForScope,
} from "@/lib/property/document-types";
import {
  defaultUploadTitle,
  validatePropertyDocumentUpload,
} from "@/lib/property/property-document-upload";
import { createDocument } from "@/lib/services/document.service";
import { getPropertyById } from "@/lib/services/property.service";
import type { StaffContext } from "@/lib/services/staff-context";
import {
  buildPropertyDocumentStorageKey,
  buildTenancyDocumentStorageKey,
} from "@/lib/storage/document-storage-keys";
import { getDocumentStorage } from "@/lib/storage/document-storage";

const CURRENT_TENANCY_STATUSES = [
  "pending_move_in",
  "active",
  "notice_received",
  "move_out_scheduled",
  "inspection_scheduled",
  "inspection_completed",
] as const;

export type PropertyDocumentListItem = {
  id: string;
  title: string;
  fileName: string;
  documentType: string;
  categoryLabel: string;
  scope: PropertyDocumentScope;
  scopeLabel: string;
  contentType: string | null;
  sizeBytes: number | null;
  isSigned: boolean;
  isLocked: boolean;
  isSystemManaged: boolean;
  canEdit: boolean;
  createdAt: string;
  downloadHref: string;
};

export type PropertyDocumentsPageData = {
  documents: PropertyDocumentListItem[];
  hasActiveTenancy: boolean;
  activeTenancyId: string | null;
  defaultScope: PropertyDocumentScope;
  propertyCategories: StaffPropertyDocumentType[];
  tenancyCategories: StaffPropertyDocumentType[];
};

export async function loadPropertyDocumentsForStaff(
  prisma: PrismaClient,
  ctx: StaffContext,
  propertyId: string,
): Promise<PropertyDocumentsPageData> {
  await getPropertyById(prisma, ctx, propertyId);

  const tenancies = await prisma.tenancy.findMany({
    where: {
      propertyId,
      status: { in: [...CURRENT_TENANCY_STATUSES] },
    },
    select: {
      id: true,
      status: true,
      leaseStartDate: true,
      moveInDate: true,
      monthlyRent: true,
      securityDeposit: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const tenancyInputs: PortfolioHealthTenancyInput[] = tenancies.map((tenancy) => ({
    status: tenancy.status,
    leaseStartDate: tenancy.leaseStartDate,
    moveInDate: tenancy.moveInDate,
    monthlyRent: Number(tenancy.monthlyRent),
    securityDeposit: Number(tenancy.securityDeposit),
    createdAt: tenancy.createdAt,
  }));
  const primaryTenancy = pickPrimaryTenancy(tenancyInputs);
  const primaryTenancyId =
    primaryTenancy != null
      ? tenancies[tenancyInputs.findIndex((row) => row === primaryTenancy)]?.id ?? null
      : null;
  const activeTenancyIds = new Set(tenancies.map((tenancy) => tenancy.id));

  const rows = await prisma.document.findMany({
    where: { propertyId },
    orderBy: { createdAt: "desc" },
  });

  const documents = rows
    .filter(
      (document) =>
        document.tenancyId == null || activeTenancyIds.has(document.tenancyId),
    )
    .map((document) => toPropertyDocumentListItem(document));

  const hasActiveTenancy = primaryTenancyId != null;

  return {
    documents,
    hasActiveTenancy,
    activeTenancyId: primaryTenancyId,
    defaultScope: hasActiveTenancy ? "tenancy" : "property",
    propertyCategories: staffDocumentTypesForScope("property"),
    tenancyCategories: staffDocumentTypesForScope("tenancy"),
  };
}

function toPropertyDocumentListItem(document: Document): PropertyDocumentListItem {
  const isSystemManaged = isSystemManagedDocumentType(document.documentType);
  return {
    id: document.id,
    title: document.title,
    fileName: document.fileName,
    documentType: document.documentType,
    categoryLabel: documentTypeLabel(document.documentType),
    scope: documentScopeFromRecord(document),
    scopeLabel: documentScopeLabel(document),
    contentType: document.contentType,
    sizeBytes: document.sizeBytes,
    isSigned: document.isSigned,
    isLocked: document.isLocked,
    isSystemManaged,
    canEdit: !document.isLocked && !isSystemManaged,
    createdAt: document.createdAt.toISOString(),
    downloadHref: `/api/leasing/documents/${document.id}/download`,
  };
}

export type UploadPropertyDocumentInput = {
  propertyId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  bytes: Uint8Array;
  documentType: string;
  title: string;
  scope: PropertyDocumentScope;
};

export async function uploadPropertyDocumentForStaff(
  prisma: PrismaClient,
  ctx: StaffContext,
  input: UploadPropertyDocumentInput,
): Promise<Document> {
  const property = await getPropertyById(prisma, ctx, input.propertyId);

  const tenancies = await prisma.tenancy.findMany({
    where: {
      propertyId: input.propertyId,
      status: { in: [...CURRENT_TENANCY_STATUSES] },
    },
    select: {
      id: true,
      unitId: true,
      status: true,
      leaseStartDate: true,
      moveInDate: true,
      monthlyRent: true,
      securityDeposit: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const tenancyInputs: PortfolioHealthTenancyInput[] = tenancies.map((tenancy) => ({
    status: tenancy.status,
    leaseStartDate: tenancy.leaseStartDate,
    moveInDate: tenancy.moveInDate,
    monthlyRent: Number(tenancy.monthlyRent),
    securityDeposit: Number(tenancy.securityDeposit),
    createdAt: tenancy.createdAt,
  }));
  const primaryTenancyInput = pickPrimaryTenancy(tenancyInputs);
  const primaryTenancyIndex = primaryTenancyInput
    ? tenancyInputs.findIndex((row) => row === primaryTenancyInput)
    : -1;
  const primaryTenancyRecord =
    primaryTenancyIndex >= 0 ? tenancies[primaryTenancyIndex] : null;

  const validation = validatePropertyDocumentUpload({
    fileName: input.fileName,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    documentType: input.documentType,
    title: input.title,
    scope: input.scope,
    hasActiveTenancy: primaryTenancyRecord != null,
  });
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const documentId = crypto.randomUUID();
  const title = defaultUploadTitle(input.fileName, input.title);
  const tenancyId = input.scope === "tenancy" ? primaryTenancyRecord?.id ?? null : null;
  const unitId = input.scope === "tenancy" ? primaryTenancyRecord?.unitId ?? null : null;

  if (input.scope === "tenancy" && (!tenancyId || !unitId)) {
    throw new Error("No active tenancy is available for tenancy-scoped uploads");
  }

  const storageKey =
    input.scope === "tenancy" && tenancyId
      ? buildTenancyDocumentStorageKey({
          organizationId: property.organizationId,
          propertyId: property.id,
          tenancyId,
          documentId,
          fileName: input.fileName,
        })
      : buildPropertyDocumentStorageKey({
          organizationId: property.organizationId,
          propertyId: property.id,
          documentId,
          fileName: input.fileName,
        });

  await getDocumentStorage().writeDocument(
    storageKey,
    input.bytes,
    input.contentType.trim().toLowerCase(),
  );

  return createDocument(prisma, ctx, {
    propertyId: property.id,
    unitId,
    tenancyId,
    documentType: input.documentType,
    title,
    fileName: input.fileName.trim(),
    contentType: input.contentType.trim().toLowerCase(),
    sizeBytes: input.sizeBytes,
    storageKey,
  });
}

export type UpdatePropertyDocumentMetadataInput = {
  documentId: string;
  title?: string;
  documentType?: string;
};

export async function updatePropertyDocumentMetadataForStaff(
  prisma: PrismaClient,
  ctx: StaffContext,
  input: UpdatePropertyDocumentMetadataInput,
): Promise<Document> {
  const { updateDocumentMetadata, getDocumentById } = await import("@/lib/services/document.service");
  const existing = await getDocumentById(prisma, ctx, input.documentId);

  if (existing.isLocked) {
    throw new Error("Document is locked and cannot be updated");
  }

  if (input.documentType !== undefined) {
    if (!isStaffUploadDocumentType(input.documentType)) {
      throw new Error("Invalid document category");
    }
    const scope = documentScopeFromRecord(existing);
    const scopeError = assertDocumentTypeMatchesScope(input.documentType, scope);
    if (scopeError) {
      throw new Error(scopeError);
    }
  }

  return updateDocumentMetadata(prisma, ctx, input.documentId, {
    title: input.title,
    documentType: input.documentType,
  });
}

export async function deletePropertyDocumentForStaff(
  prisma: PrismaClient,
  ctx: StaffContext,
  documentId: string,
): Promise<{ propertyId: string }> {
  const { deleteDocument, getDocumentById } = await import("@/lib/services/document.service");
  const existing = await getDocumentById(prisma, ctx, documentId);
  if (existing.isLocked) {
    throw new Error("Document is locked and cannot be deleted");
  }
  await deleteDocument(prisma, ctx, documentId);
  return { propertyId: existing.propertyId };
}
