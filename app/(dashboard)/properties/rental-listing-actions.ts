"use server";

import { revalidatePath } from "next/cache";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import prisma from "@/lib/db/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import {
  closeRentalListing,
  createRentalListingDraft,
  pauseRentalListing,
  publishRentalListing,
  republishRentalListing,
  returnRentalListingToDraft,
  updateRentalListing,
} from "@/lib/services/rental-listing.service";
import {
  parseRentalListingFormInput,
  rentalListingFormDatesToServiceInput,
} from "@/lib/validation/rental-listing";

export type RentalListingActionResult =
  | { ok: true; listingId?: string; propertyId?: string }
  | { ok: false; error: string };

function revalidateListingPaths(propertyId: string) {
  revalidatePath("/properties");
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/leasing");
  revalidatePath("/portal/viewing");
  revalidatePath("/portal/application");
}

function mapActionError(e: unknown, fallback: string): RentalListingActionResult {
  if (e instanceof StaffAuthError) return { ok: false, error: e.message };
  if (e instanceof NotFoundError) return { ok: false, error: e.message };
  if (e instanceof ForbiddenError) return { ok: false, error: e.message };
  const message = e instanceof Error ? e.message : fallback;
  return { ok: false, error: message };
}

export async function createRentalListingDraftAction(
  propertyId: string,
  unitId: string,
  formData: unknown = {},
): Promise<RentalListingActionResult> {
  const trimmedPropertyId = propertyId.trim();
  const trimmedUnitId = unitId.trim();
  if (!trimmedPropertyId) return { ok: false, error: "Invalid property id" };
  if (!trimmedUnitId) return { ok: false, error: "Invalid unit id" };

  const parsed = parseRentalListingFormInput(formData ?? {});
  if ("error" in parsed) return { ok: false, error: parsed.error };

  try {
    const ctx = await requireStaffContextFromSession();
    const fields = rentalListingFormDatesToServiceInput(parsed);
    const listing = await createRentalListingDraft(prisma, ctx, {
      propertyId: trimmedPropertyId,
      unitId: trimmedUnitId,
      ...fields,
    });
    revalidateListingPaths(trimmedPropertyId);
    return { ok: true, listingId: listing.id, propertyId: trimmedPropertyId };
  } catch (e) {
    return mapActionError(e, "Could not create listing draft");
  }
}

export async function updateRentalListingAction(
  listingId: string,
  propertyId: string,
  formData: unknown,
): Promise<RentalListingActionResult> {
  const trimmedListingId = listingId.trim();
  const trimmedPropertyId = propertyId.trim();
  if (!trimmedListingId) return { ok: false, error: "Invalid listing id" };
  if (!trimmedPropertyId) return { ok: false, error: "Invalid property id" };

  const parsed = parseRentalListingFormInput(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  try {
    const ctx = await requireStaffContextFromSession();
    const fields = rentalListingFormDatesToServiceInput(parsed);
    const listing = await updateRentalListing(prisma, ctx, trimmedListingId, fields);
    if (listing.propertyId !== trimmedPropertyId) {
      return { ok: false, error: "Listing does not belong to this property" };
    }
    revalidateListingPaths(trimmedPropertyId);
    return { ok: true, listingId: listing.id, propertyId: trimmedPropertyId };
  } catch (e) {
    return mapActionError(e, "Could not update listing");
  }
}

export async function publishRentalListingAction(
  listingId: string,
  propertyId: string,
): Promise<RentalListingActionResult> {
  const trimmedListingId = listingId.trim();
  const trimmedPropertyId = propertyId.trim();
  if (!trimmedListingId) return { ok: false, error: "Invalid listing id" };
  if (!trimmedPropertyId) return { ok: false, error: "Invalid property id" };

  try {
    const ctx = await requireStaffContextFromSession();
    const listing = await publishRentalListing(prisma, ctx, trimmedListingId);
    if (listing.propertyId !== trimmedPropertyId) {
      return { ok: false, error: "Listing does not belong to this property" };
    }
    revalidateListingPaths(trimmedPropertyId);
    return { ok: true, listingId: listing.id, propertyId: trimmedPropertyId };
  } catch (e) {
    return mapActionError(e, "Could not publish listing");
  }
}

export async function pauseRentalListingAction(
  listingId: string,
  propertyId: string,
): Promise<RentalListingActionResult> {
  const trimmedListingId = listingId.trim();
  const trimmedPropertyId = propertyId.trim();
  if (!trimmedListingId) return { ok: false, error: "Invalid listing id" };
  if (!trimmedPropertyId) return { ok: false, error: "Invalid property id" };

  try {
    const ctx = await requireStaffContextFromSession();
    const listing = await pauseRentalListing(prisma, ctx, trimmedListingId);
    if (listing.propertyId !== trimmedPropertyId) {
      return { ok: false, error: "Listing does not belong to this property" };
    }
    revalidateListingPaths(trimmedPropertyId);
    return { ok: true, listingId: listing.id, propertyId: trimmedPropertyId };
  } catch (e) {
    return mapActionError(e, "Could not pause listing");
  }
}

export async function closeRentalListingAction(
  listingId: string,
  propertyId: string,
): Promise<RentalListingActionResult> {
  const trimmedListingId = listingId.trim();
  const trimmedPropertyId = propertyId.trim();
  if (!trimmedListingId) return { ok: false, error: "Invalid listing id" };
  if (!trimmedPropertyId) return { ok: false, error: "Invalid property id" };

  try {
    const ctx = await requireStaffContextFromSession();
    const listing = await closeRentalListing(prisma, ctx, trimmedListingId);
    if (listing.propertyId !== trimmedPropertyId) {
      return { ok: false, error: "Listing does not belong to this property" };
    }
    revalidateListingPaths(trimmedPropertyId);
    return { ok: true, listingId: listing.id, propertyId: trimmedPropertyId };
  } catch (e) {
    return mapActionError(e, "Could not close listing");
  }
}

export async function republishRentalListingAction(
  listingId: string,
  propertyId: string,
): Promise<RentalListingActionResult> {
  const trimmedListingId = listingId.trim();
  const trimmedPropertyId = propertyId.trim();
  if (!trimmedListingId) return { ok: false, error: "Invalid listing id" };
  if (!trimmedPropertyId) return { ok: false, error: "Invalid property id" };

  try {
    const ctx = await requireStaffContextFromSession();
    const listing = await republishRentalListing(prisma, ctx, trimmedListingId);
    if (listing.propertyId !== trimmedPropertyId) {
      return { ok: false, error: "Listing does not belong to this property" };
    }
    revalidateListingPaths(trimmedPropertyId);
    return { ok: true, listingId: listing.id, propertyId: trimmedPropertyId };
  } catch (e) {
    return mapActionError(e, "Could not republish listing");
  }
}

export async function returnRentalListingToDraftAction(
  listingId: string,
  propertyId: string,
): Promise<RentalListingActionResult> {
  const trimmedListingId = listingId.trim();
  const trimmedPropertyId = propertyId.trim();
  if (!trimmedListingId) return { ok: false, error: "Invalid listing id" };
  if (!trimmedPropertyId) return { ok: false, error: "Invalid property id" };

  try {
    const ctx = await requireStaffContextFromSession();
    const listing = await returnRentalListingToDraft(prisma, ctx, trimmedListingId);
    if (listing.propertyId !== trimmedPropertyId) {
      return { ok: false, error: "Listing does not belong to this property" };
    }
    revalidateListingPaths(trimmedPropertyId);
    return { ok: true, listingId: listing.id, propertyId: trimmedPropertyId };
  } catch (e) {
    return mapActionError(e, "Could not return listing to draft");
  }
}
