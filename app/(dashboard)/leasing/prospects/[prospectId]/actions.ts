"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import { getProspectById } from "@/lib/services/prospect.service";
import { createShowing } from "@/lib/services/showing.service";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import { parseScheduleShowingFormInput } from "@/lib/validation/showing";

export type ScheduleShowingResult =
  | { ok: true; showingId: string }
  | { ok: false; error: string };

export async function scheduleShowingAction(
  prospectId: string,
  formData: unknown,
): Promise<ScheduleShowingResult> {
  const trimmedProspectId = prospectId.trim();
  if (!trimmedProspectId) {
    return { ok: false, error: "Invalid prospect id" };
  }

  const parsed = parseScheduleShowingFormInput(formData);
  if ("error" in parsed) {
    return { ok: false, error: parsed.error };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const prospect = await getProspectById(prisma, ctx, trimmedProspectId);
    if (prospect.status !== "new") {
      return { ok: false, error: "Only active prospects can be scheduled for a showing" };
    }

    const showing = await createShowing(prisma, ctx, {
      prospectId: prospect.id,
      propertyId: prospect.propertyId,
      unitId: prospect.unitId,
      assignedToUserId: parsed.assignedToUserId,
      scheduledStart: parsed.scheduledStart,
      scheduledEnd: parsed.scheduledEnd,
      contactNotes: parsed.notes,
    });

    revalidatePath("/leasing/prospects");
    revalidatePath(`/leasing/prospects/${trimmedProspectId}`);
    revalidatePath(`/leasing/showings/${showing.id}`);
    return { ok: true, showingId: showing.id };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof NotFoundError || e instanceof ForbiddenError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not schedule showing";
    return { ok: false, error: message };
  }
}
