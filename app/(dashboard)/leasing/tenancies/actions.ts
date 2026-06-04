"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import {
  getNextTenancyStatus,
  isValidTenancyStatusTransition,
  STAFF_BLOCKED_ADVANCE_TARGETS,
} from "@/lib/leasing/tenancy-lifecycle";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import { getTenancyById, updateTenancy } from "@/lib/services/tenancy.service";
import { updateTenancyContact } from "@/lib/services/tenancyContact.service";
import { toDateOnlyUTC } from "@/lib/leasing/notice-rules";
import {
  completeMoveOutInspection,
  scheduleMoveOutInspection,
} from "@/lib/services/move-out-inspection.service";
import {
  leaseSetupFormToJson,
  parseLeaseSetupFormInput,
} from "@/lib/validation/lease-setup";
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

    if (next != null && STAFF_BLOCKED_ADVANCE_TARGETS.has(next)) {
      if (next === "notice_received") {
        return {
          ok: false,
          error:
            "Accept a tenant notice on Offboarding before updating status. Manual notice received is not supported.",
        };
      }
      if (next === "move_out_scheduled") {
        return {
          ok: false,
          error:
            "Schedule move-out from the accepted tenant notice on Offboarding before advancing status.",
        };
      }
      if (next === "inspection_scheduled") {
        return {
          ok: false,
          error: "Schedule the move-out inspection on this tenancy before advancing status.",
        };
      }
      if (next === "inspection_completed") {
        return {
          ok: false,
          error: "Complete the move-out inspection on this tenancy before advancing status.",
        };
      }
      return {
        ok: false,
        error: "Use the dedicated offboarding actions on this tenancy before advancing status.",
      };
    }

    await updateTenancy(prisma, ctx, trimmedId, { status: next });
    revalidatePath("/leasing/tenancies");
    revalidatePath("/leasing/offboarding");
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

export async function scheduleMoveOutInspectionAction(
  tenancyId: string,
  inspectionDate: string,
  notes?: string,
): Promise<TenancyActionResult> {
  const trimmedId = tenancyId.trim();
  const trimmedDate = inspectionDate.trim();
  if (!trimmedId) return { ok: false, error: "Invalid tenancy id" };
  if (!trimmedDate) return { ok: false, error: "Inspection date is required" };

  try {
    const ctx = await requireStaffContextFromSession();
    await scheduleMoveOutInspection(prisma, ctx, trimmedId, {
      inspectionDate: toDateOnlyUTC(trimmedDate),
      notes: notes?.trim() || null,
    });
    revalidatePath("/leasing/tenancies");
    revalidatePath("/leasing/offboarding");
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
    const message = e instanceof Error ? e.message : "Could not schedule inspection";
    return { ok: false, error: message };
  }
}

export async function completeMoveOutInspectionAction(
  tenancyId: string,
  inspectionDate: string,
  reportUrl?: string,
  notes?: string,
): Promise<TenancyActionResult> {
  const trimmedId = tenancyId.trim();
  const trimmedDate = inspectionDate.trim();
  if (!trimmedId) return { ok: false, error: "Invalid tenancy id" };
  if (!trimmedDate) return { ok: false, error: "Inspection date is required" };

  try {
    const ctx = await requireStaffContextFromSession();
    await completeMoveOutInspection(prisma, ctx, trimmedId, {
      inspectionDate: toDateOnlyUTC(trimmedDate),
      reportUrl: reportUrl?.trim() || null,
      notes: notes?.trim() || null,
    });
    revalidatePath("/leasing/tenancies");
    revalidatePath("/leasing/offboarding");
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
    const message = e instanceof Error ? e.message : "Could not complete inspection";
    return { ok: false, error: message };
  }
}

export async function updateLeaseSetupAction(
  tenancyId: string,
  formData: unknown,
): Promise<TenancyActionResult> {
  const trimmedId = tenancyId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid tenancy id" };
  }

  const parsed = parseLeaseSetupFormInput(formData);
  if ("error" in parsed) {
    return { ok: false, error: parsed.error };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const raw = formData as Record<string, unknown>;
    const leaseEndDate =
      typeof raw.leaseEndDate === "string" && raw.leaseEndDate.trim()
        ? toDateOnlyUTC(raw.leaseEndDate.trim())
        : null;

    let petDeposit: number | null | undefined;
    if (raw.petDeposit !== undefined && raw.petDeposit !== null && raw.petDeposit !== "") {
      const n = typeof raw.petDeposit === "number" ? raw.petDeposit : Number(raw.petDeposit);
      if (!Number.isFinite(n) || n < 0) {
        return { ok: false, error: "Pet deposit must be a non-negative number" };
      }
      petDeposit = n;
    }

    await updateTenancy(prisma, ctx, trimmedId, {
      leaseSetupJson: leaseSetupFormToJson(parsed),
      leaseEndDate: parsed.tenancyType === "fixed_term" ? leaseEndDate : null,
      ...(petDeposit !== undefined ? { petDeposit } : {}),
    });

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
    const message = e instanceof Error ? e.message : "Could not save lease setup";
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
