import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { RTB1_EXECUTED_DOCUMENT_TYPE } from "@/lib/leasing/rtb1/constants";
import type { TenantSessionPayload } from "@/lib/portal/tenant-auth";

export type TenantDocumentView = {
  id: string;
  title: string;
  fileName: string;
  createdAt: string;
  downloadHref: string;
};

export type TenantDocumentCandidate = {
  tenancyId: string | null;
  documentType: string;
  isSigned: boolean;
  isLocked: boolean;
};

/** Locked executed RTB-1 agreements visible to tenants after activation. */
export function isTenantPortalDocument(doc: TenantDocumentCandidate): boolean {
  return (
    doc.tenancyId != null &&
    doc.documentType === RTB1_EXECUTED_DOCUMENT_TYPE &&
    doc.isSigned === true &&
    doc.isLocked === true
  );
}

export function tenantCanAccessDocument(
  session: Pick<TenantSessionPayload, "tenancyId">,
  doc: TenantDocumentCandidate,
): boolean {
  return doc.tenancyId === session.tenancyId && isTenantPortalDocument(doc);
}

export function tenantDocumentsWhereForSession(
  session: TenantSessionPayload,
): Prisma.DocumentWhereInput {
  return {
    tenancyId: session.tenancyId,
    documentType: RTB1_EXECUTED_DOCUMENT_TYPE,
    isSigned: true,
    isLocked: true,
  };
}

const TENANT_DOCUMENT_SELECT = {
  id: true,
  title: true,
  fileName: true,
  createdAt: true,
  tenancyId: true,
  documentType: true,
  isSigned: true,
  isLocked: true,
} as const;

function toTenantDocumentView(row: {
  id: string;
  title: string;
  fileName: string;
  createdAt: Date;
}): TenantDocumentView {
  return {
    id: row.id,
    title: row.title,
    fileName: row.fileName,
    createdAt: row.createdAt.toISOString(),
    downloadHref: `/api/portal/documents/${row.id}/download`,
  };
}

export async function listTenantDocumentsForSession(
  session: TenantSessionPayload,
): Promise<TenantDocumentView[]> {
  const rows = await prisma.document.findMany({
    where: tenantDocumentsWhereForSession(session),
    select: TENANT_DOCUMENT_SELECT,
    orderBy: { createdAt: "desc" },
  });

  return rows
    .filter((row) => isTenantPortalDocument(row))
    .map((row) => toTenantDocumentView(row));
}

export async function getTenantDocumentForSession(
  session: TenantSessionPayload,
  documentId: string,
): Promise<(TenantDocumentView & { storageKey: string; contentType: string | null }) | null> {
  const trimmedId = documentId.trim();
  if (!trimmedId) return null;

  const row = await prisma.document.findFirst({
    where: {
      id: trimmedId,
      ...tenantDocumentsWhereForSession(session),
    },
    select: {
      ...TENANT_DOCUMENT_SELECT,
      storageKey: true,
      contentType: true,
    },
  });

  if (!row || !tenantCanAccessDocument(session, row)) {
    return null;
  }

  return {
    ...toTenantDocumentView(row),
    storageKey: row.storageKey,
    contentType: row.contentType,
  };
}
