"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import {
  getNextTenancyStatus,
  isValidTenancyStatusTransition,
} from "@/lib/leasing/tenancy-lifecycle";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import { getTenancyById, updateTenancy } from "@/lib/services/tenancy.service";
import { updateTenancyContact } from "@/lib/services/tenancyContact.service";
import type { TenancyStatus } from "@prisma/client";

export type TenancyActionResult = { ok: true } | { ok: false; error: string };

export async function advanceTenancyStatusAction(
  tenancyId: string,
): Promise<TenancyActionResult> {
  const trimmedId = tenancyId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid tenancy id" };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const tenancy = await getTenancyById(prisma, ctx, trimmedId);
    const current = tenancy.status as TenancyStatus;
    const next = getNextTenancyStatus(current);

    if (!next) {
      return { ok: false, error: "No further status transition is available" };
    }

    if (!isValidTenancyStatusTransition(current, next)) {
      return { ok: false, error: "Invalid status transition" };
    }

    await updateTenancy(prisma, ctx, trimmedId, { status: next });
    revalidatePath("/leasing/tenancies");
    revalidatePath(`/leasing/tenancies/${trimmedId}`);
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
    const message = e instanceof Error ? e.message : "Could not update tenancy status";
    return { ok: false, error: message };
  }
}

export async function setTenancyContactPortalAccessAction(
  contactId: string,
  enabled: boolean,
): Promise<TenancyActionResult> {
  const trimmedId = contactId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid contact id" };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const contact = await updateTenancyContact(prisma, ctx, trimmedId, {
      portalAccessEnabled: enabled,
    });
    revalidatePath("/leasing/tenancies");
    revalidatePath(`/leasing/tenancies/${contact.tenancyId}`);
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
    const message = e instanceof Error ? e.message : "Could not update portal access";
    return { ok: false, error: message };
  }
}
