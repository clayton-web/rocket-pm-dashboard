"use server";

import { BriefingSlot } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { markBriefingRunReviewed } from "@/lib/briefing/briefing-settings.service";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import { briefingDecommissionedActionResult } from "@/lib/jobs/policy";

export type BriefingActionResult =
  | { ok: true }
  | { ok: false; error: string; reason?: string };

export type BriefingRunNowResult =
  | { ok: true; jobId: string; created: boolean }
  | { ok: false; error: string; reason?: string };

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
  void args;
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Sign in required." };
  }

  return briefingDecommissionedActionResult();
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
  void input;
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Sign in required." };
  }

  return briefingDecommissionedActionResult();
}

export async function runBriefingNowFromFormAction(formData: FormData): Promise<void> {
  const slotRaw = formData.get("slot");
  const slot = parseBriefingSlot(slotRaw);
  if (isBriefingSlotError(slot)) {
    return;
  }
  await runBriefingNowAction({ slot });
}
