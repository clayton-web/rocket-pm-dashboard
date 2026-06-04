import { createLocalDocumentStorage } from "@/lib/storage/local-document-storage";
import { createS3DocumentStorage, readS3DocumentStorageEnv } from "@/lib/storage/s3-document-storage";

export type DocumentStorage = {
  readDocument(storageKey: string): Promise<Uint8Array>;
  writeDocument(storageKey: string, bytes: Uint8Array, contentType?: string): Promise<void>;
};

export type DocumentStorageBackend = "local" | "s3";

export function getDocumentStorageBackend(): DocumentStorageBackend {
  const raw = process.env.DOCUMENT_STORAGE_BACKEND?.trim().toLowerCase();
  if (!raw || raw === "local") {
    return "local";
  }
  if (raw === "s3") {
    return "s3";
  }
  throw new Error(
    `Invalid DOCUMENT_STORAGE_BACKEND "${raw}". Expected "local" or "s3".`,
  );
}

export function createDocumentStorage(backend: DocumentStorageBackend): DocumentStorage {
  if (backend === "local") {
    return createLocalDocumentStorage();
  }
  return createS3DocumentStorage(readS3DocumentStorageEnv());
}

let cachedStorage: DocumentStorage | null = null;

export function getDocumentStorage(): DocumentStorage {
  if (!cachedStorage) {
    cachedStorage = createDocumentStorage(getDocumentStorageBackend());
  }
  return cachedStorage;
}

/** Test helper — reset singleton between unit tests. */
export function resetDocumentStorageCache(): void {
  cachedStorage = null;
}
