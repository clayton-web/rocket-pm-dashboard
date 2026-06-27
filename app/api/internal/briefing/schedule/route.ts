import { BriefingSlot } from "@prisma/client";
import { NextResponse } from "next/server";
import { enqueueBriefingScheduleForCron } from "@/lib/briefing/enqueue-briefing-schedule-cron";
import {
  getJobProcessorActorUserId,
  getJobProcessorSecret,
  verifyJobProcessorRequest,
} from "@/lib/jobs/policy";

export const runtime = "nodejs";

function parseBriefingSlotParam(value: string | null): BriefingSlot | null {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "MORNING") return BriefingSlot.MORNING;
  if (normalized === "AFTERNOON") return BriefingSlot.AFTERNOON;
  return null;
}

async function handleBriefingScheduleCron(request: Request) {
  if (!getJobProcessorSecret()) {
    return NextResponse.json(
      { error: "Job processor is not configured (JOB_PROCESSOR_SECRET or CRON_SECRET)." },
      { status: 503 },
    );
  }

  if (!verifyJobProcessorRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const slot = parseBriefingSlotParam(url.searchParams.get("slot"));
  if (!slot) {
    return NextResponse.json(
      { error: 'Query param slot=MORNING or slot=AFTERNOON is required.' },
      { status: 400 },
    );
  }

  const dryRun = url.searchParams.get("dryRun") === "true";
  const organizationId = url.searchParams.get("organizationId")?.trim() || undefined;

  try {
    const actorUserId = getJobProcessorActorUserId(undefined);
    const result = await enqueueBriefingScheduleForCron({
      slot,
      triggeredByUserId: actorUserId,
      dryRun,
      organizationId,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, reason: result.reason }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      slot: result.slot,
      organizationsConsidered: result.organizationsConsidered,
      enqueued: result.enqueued,
      alreadyQueued: result.alreadyQueued,
      skipped: result.skipped,
      results: result.results,
      nextStep:
        "Drain the job queue via POST /api/internal/jobs/process so briefing.schedule and briefing.generate jobs run.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Briefing schedule enqueue failed.";
    return NextResponse.json({ ok: false, error: message.slice(0, 500) }, { status: 500 });
  }
}

/** External cron (GitHub Actions, QStash) or manual operator trigger. */
export async function GET(request: Request) {
  return handleBriefingScheduleCron(request);
}

export async function POST(request: Request) {
  return handleBriefingScheduleCron(request);
}
