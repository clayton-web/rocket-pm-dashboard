"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import { toDateOnlyUTC } from "@/lib/leasing/notice-rules";
import { acceptTenantEndNotice, scheduleMoveOutFromAcceptedNotice } from "@/lib/services/notice.service";

export type NoticeActionResult = { ok: true } | { ok: false; error: string };

export async function acceptTenantNoticeAction(noticeId: string): Promise<NoticeActionResult> {
  const trimmedId = noticeId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid notice id" };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const row = await acceptTenantEndNotice(prisma, ctx, trimmedId);
    revalidatePath("/leasing/offboarding");
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

export async function scheduleMoveOutFromNoticeAction(
  noticeId: string,
  scheduledMoveOutDateIso: string,
): Promise<NoticeActionResult> {
  const trimmedId = noticeId.trim();
  const trimmedDate = scheduledMoveOutDateIso.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid notice id" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
    return { ok: false, error: "Please select a valid scheduled move-out date" };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const { tenancy } = await scheduleMoveOutFromAcceptedNotice(
      prisma,
      ctx,
      trimmedId,
      toDateOnlyUTC(trimmedDate),
    );
    revalidatePath("/leasing/offboarding");
    revalidatePath(`/leasing/notices/${trimmedId}`);
    revalidatePath("/leasing/tenancies");
    revalidatePath(`/leasing/tenancies/${tenancy.id}`);
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
    const message = e instanceof Error ? e.message : "Could not schedule move-out";
    return { ok: false, error: message };
  }
}
