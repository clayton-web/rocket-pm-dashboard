"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import { acceptTenantEndNotice } from "@/lib/services/notice.service";

export type NoticeActionResult = { ok: true } | { ok: false; error: string };

export async function acceptTenantNoticeAction(noticeId: string): Promise<NoticeActionResult> {
  const trimmedId = noticeId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid notice id" };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const row = await acceptTenantEndNotice(prisma, ctx, trimmedId);
    revalidatePath("/leasing/notices");
    revalidatePath(`/leasing/notices/${trimmedId}`);
    revalidatePath("/leasing/tenancies");
    revalidatePath(`/leasing/tenancies/${row.tenancyId}`);
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
    const message = e instanceof Error ? e.message : "Could not accept notice";
    return { ok: false, error: message };
  }
}
