import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentStorage } from "@/lib/storage/document-storage";
import { normalizeDocumentStorageKey } from "@/lib/storage/document-storage-keys";

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
  return path.join(getLocalDocumentStorageRoot(), normalizeDocumentStorageKey(storageKey));
}

export function createLocalDocumentStorage(): DocumentStorage {
  return {
    async readDocument(storageKey: string): Promise<Uint8Array> {
      const filePath = resolveLocalDocumentPath(storageKey);
      return readFile(filePath);
    },
    async writeDocument(
      storageKey: string,
      bytes: Uint8Array,
      contentType?: string,
    ): Promise<void> {
      void contentType;
      const filePath = resolveLocalDocumentPath(storageKey);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, bytes);
    },
  };
}

/** @deprecated Use getDocumentStorage().readDocument() */
export async function readLocalDocument(storageKey: string): Promise<Uint8Array> {
  return createLocalDocumentStorage().readDocument(storageKey);
}

/** @deprecated Use getDocumentStorage().writeDocument() */
export async function writeLocalDocument(storageKey: string, bytes: Uint8Array): Promise<void> {
  return createLocalDocumentStorage().writeDocument(storageKey, bytes);
}

export { buildTenancyDocumentStorageKey } from "@/lib/storage/document-storage-keys";
