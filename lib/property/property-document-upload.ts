import {
  assertDocumentTypeMatchesScope,
  isStaffUploadDocumentType,
  type PropertyDocumentScope,
} from "@/lib/property/document-types";

export const PROPERTY_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

export const ALLOWED_PROPERTY_DOCUMENT_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type PropertyDocumentUploadInput = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  documentType: string;
  title: string;
  scope: PropertyDocumentScope;
  hasActiveTenancy: boolean;
};

export function titleFromUploadFileName(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) return "Untitled document";
  const withoutExtension = trimmed.replace(/\.[^.]+$/, "");
  const normalized = withoutExtension.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (normalized) return normalized;
  if (withoutExtension.trim()) return withoutExtension.trim();
  return "Untitled document";
}

export function validatePropertyDocumentUpload(
  input: PropertyDocumentUploadInput,
): { ok: true } | { ok: false; error: string } {
  const fileName = input.fileName.trim();
  if (!fileName) {
    return { ok: false, error: "File name is required" };
  }

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, error: "File is empty" };
  }
  if (input.sizeBytes > PROPERTY_DOCUMENT_MAX_BYTES) {
    return { ok: false, error: "File exceeds the 25 MB limit" };
  }

  const contentType = input.contentType.trim().toLowerCase();
  if (!ALLOWED_PROPERTY_DOCUMENT_CONTENT_TYPES.has(contentType)) {
    return { ok: false, error: "File type must be PDF, JPG, PNG, or WebP" };
  }

  if (!isStaffUploadDocumentType(input.documentType)) {
    return { ok: false, error: "Invalid document category" };
  }

  const scopeError = assertDocumentTypeMatchesScope(input.documentType, input.scope);
  if (scopeError) {
    return { ok: false, error: scopeError };
  }

  if (input.scope === "tenancy" && !input.hasActiveTenancy) {
    return { ok: false, error: "No active tenancy is available for tenancy-scoped uploads" };
  }

  const title = input.title.trim();
  if (!title) {
    return { ok: false, error: "Title is required" };
  }

  return { ok: true };
}

export function defaultUploadTitle(fileName: string, providedTitle?: string | null): string {
  const trimmed = providedTitle?.trim();
  if (trimmed) return trimmed;
  return titleFromUploadFileName(fileName);
}

// Re-export for tests that import title helper by the spec name.
export { titleFromUploadFileName as titleFromFileName };
