"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { toDateOnlyUTC } from "@/lib/leasing/notice-rules";
import { getVerifiedTenantSession } from "@/lib/portal/tenant-auth";
import { createTenantNoticeFromPortal } from "@/lib/services/notice.service";
import { NotFoundError } from "@/lib/services/errors";

export type SubmitTenantNoticeResult =
  | { ok: true; noticeId: string }
  | { ok: false; error: string };

export async function submitTenantNoticeAction(
  moveOutDateIso: string,
  message?: string | null,
): Promise<SubmitTenantNoticeResult> {
  const session = await getVerifiedTenantSession();
  if (!session) {
    return { ok: false, error: "You must be signed in to submit a notice." };
  }

  const trimmedDate = moveOutDateIso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
    return { ok: false, error: "Please select a valid move-out date." };
  }

  try {
    const tenantRequestedMoveOutDate = toDateOnlyUTC(trimmedDate);
    const row = await createTenantNoticeFromPortal(prisma, {
      session,
      tenantRequestedMoveOutDate,
      message,
    });
    revalidatePath("/portal/notice/new");
    revalidatePath("/portal/dashboard");
    return { ok: true, noticeId: row.id };
  } catch (e) {
    if (e instanceof NotFoundError) {
      return { ok: false, error: e.message };
    }
    const msg = e instanceof Error ? e.message : "Could not submit notice";
    return { ok: false, error: msg };
  }
}
