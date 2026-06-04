"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import { isShowingOpenForCloseOut, mapCloseOutChoiceToEnums } from "@/lib/leasing/showing-close-out";
import { getShowingById, updateShowing } from "@/lib/services/showing.service";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import { parseCloseOutShowingFormInput } from "@/lib/validation/showing";

export type CloseOutShowingResult = { ok: true } | { ok: false; error: string };

export async function closeOutShowingAction(
  showingId: string,
  formData: unknown,
): Promise<CloseOutShowingResult> {
  const trimmedId = showingId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid showing id" };
  }

  const parsed = parseCloseOutShowingFormInput(formData);
  if ("error" in parsed) {
    return { ok: false, error: parsed.error };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const existing = await getShowingById(prisma, ctx, trimmedId);
    if (!isShowingOpenForCloseOut(existing.status)) {
      return { ok: false, error: "This showing has already been closed out" };
    }

    const mapped = mapCloseOutChoiceToEnums(parsed.choice);
    await updateShowing(prisma, ctx, trimmedId, {
      status: mapped.status,
      showingOutcome: mapped.showingOutcome,
      ...(parsed.notes !== null ? { contactNotes: parsed.notes } : {}),
    });

    revalidatePath(`/leasing/showings/${trimmedId}`);
    revalidatePath(`/leasing/prospects/${existing.prospectId}`);
    revalidatePath("/leasing/prospects");
    return { ok: true };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof NotFoundError || e instanceof ForbiddenError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not close out showing";
    return { ok: false, error: message };
  }
}
