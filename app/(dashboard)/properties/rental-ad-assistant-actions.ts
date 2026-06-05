"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import {
  handleClearRentalAdAssistantDraftOutput,
  handleGenerateRentalAdAssistantDraft,
  handleLoadRentalAdAssistantDraft,
  handleSaveRentalAdAssistantDraft,
  type RentalAdAssistantActionResult,
} from "@/lib/rental-ad-assistant/action-handlers";
import { isRentalAdAssistantEnabled } from "@/lib/rental-ad-assistant/feature-flag";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";

export type RentalAdAssistantActionState = RentalAdAssistantActionResult & {
  completedAt: number;
};

const idleState: RentalAdAssistantActionState = {
  ok: true,
  draft: null,
  completedAt: 0,
};

const disabledState: RentalAdAssistantActionState = {
  ok: false,
  error: "Rental Ad Assistant is disabled.",
  completedAt: Date.now(),
};

function disabledActionState(): RentalAdAssistantActionState {
  return { ...disabledState, completedAt: Date.now() };
}

function wrapActionError(error: unknown): RentalAdAssistantActionState {
  if (error instanceof StaffAuthError) {
    return { ok: false, error: error.message, completedAt: Date.now() };
  }
  if (error instanceof ForbiddenError || error instanceof NotFoundError) {
    return { ok: false, error: error.message, completedAt: Date.now() };
  }
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return { ok: false, error: message, completedAt: Date.now() };
}

function successState(result: RentalAdAssistantActionResult): RentalAdAssistantActionState {
  return { ...result, completedAt: Date.now() };
}

async function revalidatePropertyForUnit(unitId: string) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { propertyId: true },
  });
  if (unit?.propertyId) {
    revalidatePath(`/properties/${unit.propertyId}`);
  }
  revalidatePath("/properties");
}

export async function loadRentalAdAssistantDraftAction(
  unitId: string,
): Promise<RentalAdAssistantActionResult> {
  if (!isRentalAdAssistantEnabled()) {
    return disabledActionState();
  }
  try {
    const ctx = await requireStaffContextFromSession();
    return await handleLoadRentalAdAssistantDraft(prisma, ctx, unitId);
  } catch (error) {
    return wrapActionError(error);
  }
}

export async function saveRentalAdAssistantDraftAction(
  _prev: RentalAdAssistantActionState,
  formData: FormData,
): Promise<RentalAdAssistantActionState> {
  if (!isRentalAdAssistantEnabled()) {
    return disabledActionState();
  }
  try {
    const ctx = await requireStaffContextFromSession();
    const unitId = formData.get("unitId");
    const inputsRaw = formData.get("inputs");
    const outputRaw = formData.get("output");

    if (typeof unitId !== "string" || !unitId.trim()) {
      return { ok: false, error: "Unit is required.", completedAt: Date.now() };
    }

    let inputs: unknown;
    let output: unknown | undefined;
    try {
      inputs = typeof inputsRaw === "string" ? JSON.parse(inputsRaw) : null;
      if (outputRaw && typeof outputRaw === "string" && outputRaw.trim()) {
        output = JSON.parse(outputRaw);
      }
    } catch {
      return { ok: false, error: "Invalid draft payload.", completedAt: Date.now() };
    }

    const result = await handleSaveRentalAdAssistantDraft(prisma, ctx, {
      unitId,
      inputs,
      output,
    });
    await revalidatePropertyForUnit(unitId);
    return successState(result);
  } catch (error) {
    return wrapActionError(error);
  }
}

export async function generateRentalAdAssistantDraftAction(
  _prev: RentalAdAssistantActionState,
  formData: FormData,
): Promise<RentalAdAssistantActionState> {
  if (!isRentalAdAssistantEnabled()) {
    return disabledActionState();
  }
  try {
    const ctx = await requireStaffContextFromSession();
    const unitId = formData.get("unitId");
    const inputsRaw = formData.get("inputs");

    if (typeof unitId !== "string" || !unitId.trim()) {
      return { ok: false, error: "Unit is required.", completedAt: Date.now() };
    }

    let inputs: unknown;
    try {
      inputs = typeof inputsRaw === "string" ? JSON.parse(inputsRaw) : null;
    } catch {
      return { ok: false, error: "Invalid draft inputs.", completedAt: Date.now() };
    }

    const result = await handleGenerateRentalAdAssistantDraft(prisma, ctx, {
      unitId,
      inputs,
    });
    await revalidatePropertyForUnit(unitId);
    return successState(result);
  } catch (error) {
    return wrapActionError(error);
  }
}

export async function clearRentalAdAssistantDraftOutputAction(
  _prev: RentalAdAssistantActionState,
  formData: FormData,
): Promise<RentalAdAssistantActionState> {
  if (!isRentalAdAssistantEnabled()) {
    return disabledActionState();
  }
  try {
    const ctx = await requireStaffContextFromSession();
    const unitId = formData.get("unitId");

    if (typeof unitId !== "string" || !unitId.trim()) {
      return { ok: false, error: "Unit is required.", completedAt: Date.now() };
    }

    const result = await handleClearRentalAdAssistantDraftOutput(prisma, ctx, unitId);
    await revalidatePropertyForUnit(unitId);
    return successState(result);
  } catch (error) {
    return wrapActionError(error);
  }
}

export { idleState as rentalAdAssistantIdleState };
