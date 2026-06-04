import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Local filesystem document storage — development and single-node staging only.
 *
 * Production requires durable object storage (S3-compatible). Serverless hosts do not persist
 * `.data/documents` across deploys or instances; executed RTB-1 leases must not rely on this path.
 * See docs/leasing-production-readiness.md.
 */
const DEFAULT_STORAGE_ROOT = path.join(process.cwd(), ".data", "documents");

export function getLocalDocumentStorageRoot(): string {
  const configured = process.env.LOCAL_DOCUMENT_STORAGE_ROOT?.trim();
  return configured || DEFAULT_STORAGE_ROOT;
}

export function resolveLocalDocumentPath(storageKey: string): string {
  const normalized = storageKey.replace(/^\/+/, "").replace(/\.\./g, "");
  return path.join(getLocalDocumentStorageRoot(), normalized);
}

export async function writeLocalDocument(storageKey: string, bytes: Uint8Array): Promise<void> {
  const filePath = resolveLocalDocumentPath(storageKey);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
}

export async function readLocalDocument(storageKey: string): Promise<Uint8Array> {
  const filePath = resolveLocalDocumentPath(storageKey);
  return readFile(filePath);
}

export function buildTenancyDocumentStorageKey(args: {
  organizationId: string;
  propertyId: string;
  tenancyId: string;
  documentId: string;
  fileName: string;
}): string {
  const safeName = args.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return [
    "org",
    args.organizationId,
    "property",
    args.propertyId,
    "tenancy",
    args.tenancyId,
    `${args.documentId}-${safeName}`,
  ].join("/");
}
