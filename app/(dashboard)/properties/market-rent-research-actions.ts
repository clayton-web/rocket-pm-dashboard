"use server";

import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import prisma from "@/lib/db/prisma";
import { handleRunMarketRentResearch } from "@/lib/market-rent-research/action-handlers";
import { marketRentResearchDisabledActionState } from "@/lib/market-rent-research/disabled-action";
import { isMarketRentResearchEnabled } from "@/lib/market-rent-research/feature-flag";
import type { MarketRentResearchActionResult, MarketRentResearchActionState } from "@/lib/market-rent-research/types";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";

function wrapActionError(error: unknown): MarketRentResearchActionState {
  if (error instanceof StaffAuthError) {
    return { ok: false, error: error.message, completedAt: Date.now() };
  }
  if (error instanceof ForbiddenError || error instanceof NotFoundError) {
    return { ok: false, error: error.message, completedAt: Date.now() };
  }
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return { ok: false, error: message, completedAt: Date.now() };
}

function successState(result: MarketRentResearchActionResult): MarketRentResearchActionState {
  return { ...result, completedAt: Date.now() };
}

export async function runMarketRentResearchAction(
  _prev: MarketRentResearchActionState,
  formData: FormData,
): Promise<MarketRentResearchActionState> {
  if (!isMarketRentResearchEnabled()) {
    return marketRentResearchDisabledActionState();
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
      return { ok: false, error: "Invalid research inputs.", completedAt: Date.now() };
    }

    const result = await handleRunMarketRentResearch(prisma, ctx, {
      unitId,
      inputs,
    });
    return successState(result);
  } catch (error) {
    return wrapActionError(error);
  }
}
