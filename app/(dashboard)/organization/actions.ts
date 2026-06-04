"use server";

import { revalidatePath } from "next/cache";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import {
  updateOrganizationLandlordProfile,
} from "@/lib/org/organization-landlord-profile";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import { parseOrganizationLandlordFormInput } from "@/lib/validation/organization-landlord";

export type OrganizationActionResult = { ok: true } | { ok: false; error: string };

export async function updateOrganizationLandlordProfileAction(
  formData: unknown,
): Promise<OrganizationActionResult> {
  const parsed = parseOrganizationLandlordFormInput(formData);
  if ("error" in parsed) {
    return { ok: false, error: parsed.error };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    await updateOrganizationLandlordProfile(ctx, parsed);
    revalidatePath("/organization");
    revalidatePath("/leasing/tenancies");
    return { ok: true };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof NotFoundError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof ForbiddenError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not update landlord profile";
    return { ok: false, error: message };
  }
}
