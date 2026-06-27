"use server";

import { BriefingSlot } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  buildManualBriefingGenerateEnqueueInput,
  enqueueManualBriefingGenerate,
} from "@/lib/briefing/briefing-run-now";
import {
  inferBriefingSlotFromDate,
  markBriefingRunReviewed,
  upsertBriefingSettings,
} from "@/lib/briefing/briefing-settings.service";
import prisma from "@/lib/db/prisma";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import { parseBriefingSettingsInput } from "@/lib/validation/briefing-settings";

export type BriefingActionResult = { ok: true } | { ok: false; error: string };

export type BriefingRunNowResult =
  | { ok: true; jobId: string; created: boolean }
  | { ok: false; error: string };

function parseBriefingSlot(value: unknown): BriefingSlot | { error: string } {
  if (value === BriefingSlot.MORNING || value === "MORNING") return BriefingSlot.MORNING;
  if (value === BriefingSlot.AFTERNOON || value === "AFTERNOON") return BriefingSlot.AFTERNOON;
  return { error: "Invalid briefing slot." };
}

function isBriefingSlotError(
  value: BriefingSlot | { error: string },
): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value;
}

export async function runBriefingNowAction(args: {
  slot?: BriefingSlot;
}): Promise<BriefingRunNowResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Sign in required." };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const slot = args.slot ?? inferBriefingSlotFromDate();

    const settings = await prisma.briefingSettings.findUnique({
      where: { organizationId: ctx.organizationId },
    });
    if (!settings?.enabled) {
      return { ok: false, error: "Daily Briefing is disabled for this organization." };
    }

    const lookbackHours = settings.lookbackHours;
    const lastCompletedRun = await prisma.briefingRun.findFirst({
      where: {
        organizationId: ctx.organizationId,
        slot,
        status: { in: ["COMPLETED", "PARTIAL"] },
      },
      orderBy: { windowEnd: "desc" },
      select: { windowEnd: true },
    });

    const enqueueInput = buildManualBriefingGenerateEnqueueInput({
      organizationId: ctx.organizationId,
      slot,
      lookbackHours,
      lastCompletedRunWindowEnd: lastCompletedRun?.windowEnd ?? null,
      triggeredByUserId: session.user.id,
    });

    const result = await enqueueManualBriefingGenerate(enqueueInput);

    revalidatePath("/briefing");
    return { ok: true, jobId: result.jobId, created: result.created };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not queue briefing run.";
    return { ok: false, error: message };
  }
}

export async function markBriefingReviewedAction(args: {
  runId: string;
}): Promise<BriefingActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Sign in required." };
  }

  if (typeof args.runId !== "string" || args.runId.length === 0) {
    return { ok: false, error: "Run id is required." };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const updated = await markBriefingRunReviewed({
      organizationId: ctx.organizationId,
      runId: args.runId,
      userId: session.user.id,
    });

    if (!updated) {
      return { ok: false, error: "Briefing run not found." };
    }

    revalidatePath("/briefing");
    revalidatePath(`/briefing/${args.runId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not mark briefing as reviewed.";
    return { ok: false, error: message };
  }
}

export async function updateBriefingSettingsAction(input: unknown): Promise<BriefingActionResult> {
  const parsed = parseBriefingSettingsInput(input);
  if ("error" in parsed) {
    return { ok: false, error: parsed.error };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    await upsertBriefingSettings(ctx, parsed);
    revalidatePath("/briefing");
    revalidatePath("/briefing/settings");
    return { ok: true };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof ForbiddenError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof NotFoundError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not update briefing settings.";
    return { ok: false, error: message };
  }
}

export async function runBriefingNowFromFormAction(formData: FormData): Promise<void> {
  const slotRaw = formData.get("slot");
  const slot = parseBriefingSlot(slotRaw);
  if (isBriefingSlotError(slot)) {
    throw new Error(slot.error);
  }
  await runBriefingNowAction({ slot });
}
