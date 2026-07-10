"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import { updateProspect } from "@/lib/services/prospect.service";

export type ArchiveProspectResult = { ok: true } | { ok: false; error: string };

export async function archiveProspectAction(prospectId: string): Promise<ArchiveProspectResult> {
  const trimmed = prospectId.trim();
  if (!trimmed) {
    return { ok: false, error: "Invalid prospect id" };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    await updateProspect(prisma, ctx, trimmed, { status: "archived" });
    revalidatePath("/leasing/prospects");
    revalidatePath(`/leasing/prospects/${trimmed}`);

    revalidatePath("/operations");
    return { ok: true };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not archive prospect";
    return { ok: false, error: message };
  }
}
