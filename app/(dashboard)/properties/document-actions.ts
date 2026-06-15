"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import type { PropertyDocumentScope } from "@/lib/property/document-types";
import {
  deletePropertyDocumentForStaff,
  updatePropertyDocumentMetadataForStaff,
  uploadPropertyDocumentForStaff,
} from "@/lib/property/property-documents-staff";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";

export type PropertyDocumentActionResult =
  | { ok: true; documentId?: string }
  | { ok: false; error: string };

function revalidatePropertyDocumentPaths(propertyId: string): void {
  revalidatePath("/properties");
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/properties/health");
}

function parseScope(value: FormDataEntryValue | null): PropertyDocumentScope | null {
  if (value === "property" || value === "tenancy") return value;
  return null;
}

export async function uploadPropertyDocumentAction(
  propertyId: string,
  formData: FormData,
): Promise<PropertyDocumentActionResult> {
  const trimmedPropertyId = propertyId.trim();
  if (!trimmedPropertyId) {
    return { ok: false, error: "Invalid property id" };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "File is required" };
  }

  const scope = parseScope(formData.get("scope"));
  if (!scope) {
    return { ok: false, error: "Invalid document scope" };
  }

  const documentType = String(formData.get("documentType") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();

  try {
    const ctx = await requireStaffContextFromSession();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const document = await uploadPropertyDocumentForStaff(prisma, ctx, {
      propertyId: trimmedPropertyId,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      bytes,
      documentType,
      title,
      scope,
    });
    revalidatePropertyDocumentPaths(trimmedPropertyId);
    return { ok: true, documentId: document.id };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof ForbiddenError || e instanceof NotFoundError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not upload document";
    return { ok: false, error: message };
  }
}

export async function updatePropertyDocumentMetadataAction(
  propertyId: string,
  documentId: string,
  formData: FormData,
): Promise<PropertyDocumentActionResult> {
  const trimmedPropertyId = propertyId.trim();
  const trimmedDocumentId = documentId.trim();
  if (!trimmedPropertyId || !trimmedDocumentId) {
    return { ok: false, error: "Invalid property or document id" };
  }

  const titleRaw = formData.get("title");
  const documentTypeRaw = formData.get("documentType");
  const title = titleRaw == null ? undefined : String(titleRaw).trim();
  const documentType = documentTypeRaw == null ? undefined : String(documentTypeRaw).trim();

  if (title === "") {
    return { ok: false, error: "Title is required" };
  }
  if (documentType === "") {
    return { ok: false, error: "Document category is required" };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    await updatePropertyDocumentMetadataForStaff(prisma, ctx, {
      documentId: trimmedDocumentId,
      title,
      documentType,
    });
    revalidatePropertyDocumentPaths(trimmedPropertyId);
    return { ok: true, documentId: trimmedDocumentId };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof ForbiddenError || e instanceof NotFoundError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not update document";
    return { ok: false, error: message };
  }
}

export async function deletePropertyDocumentAction(
  propertyId: string,
  documentId: string,
): Promise<PropertyDocumentActionResult> {
  const trimmedPropertyId = propertyId.trim();
  const trimmedDocumentId = documentId.trim();
  if (!trimmedPropertyId || !trimmedDocumentId) {
    return { ok: false, error: "Invalid property or document id" };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    await deletePropertyDocumentForStaff(prisma, ctx, trimmedDocumentId);
    revalidatePropertyDocumentPaths(trimmedPropertyId);
    return { ok: true, documentId: trimmedDocumentId };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof ForbiddenError || e instanceof NotFoundError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not delete document";
    return { ok: false, error: message };
  }
}
