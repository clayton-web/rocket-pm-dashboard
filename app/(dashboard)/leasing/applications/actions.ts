"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import { setApplicationReviewStatus } from "@/lib/services/application.service";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";

export type ReviewApplicationResult = { ok: true } | { ok: false; error: string };

const REVIEW_STATUSES = new Set(["under_review", "approved", "declined"]);

export async function setApplicationReviewAction(
  applicationId: string,
  status: string,
): Promise<ReviewApplicationResult> {
  const trimmedId = applicationId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid application id" };
  }
  if (!REVIEW_STATUSES.has(status)) {
    return { ok: false, error: "Invalid review action" };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    await setApplicationReviewStatus(prisma, ctx, trimmedId, {
      status: status as "under_review" | "approved" | "declined",
    });
    revalidatePath("/leasing/applications");
    revalidatePath(`/leasing/applications/${trimmedId}`);
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
    const message = e instanceof Error ? e.message : "Could not update application";
    return { ok: false, error: message };
  }
}
