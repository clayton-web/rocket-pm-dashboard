import { NextResponse } from "next/server";
import {
  BRIEFING_SCHEDULE_DECOMMISSIONED_MESSAGE,
  BRIEFING_SCHEDULE_DECOMMISSIONED_REASON,
  getJobProcessorSecret,
  verifyJobProcessorRequest,
} from "@/lib/jobs/policy";

export const runtime = "nodejs";

/**
 * Automated Daily Briefing scheduling is decommissioned (P0-B).
 * Auth stays enforced; authenticated callers get 410 and no jobs are enqueued.
 * Route file is kept for F2 scaffolding cleanup.
 */
async function handleDecommissionedBriefingSchedule(request: Request) {
  if (!getJobProcessorSecret()) {
    return NextResponse.json(
      { error: "Job processor is not configured (JOB_PROCESSOR_SECRET or CRON_SECRET)." },
      { status: 503 },
    );
  }

  if (!verifyJobProcessorRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(
    {
      ok: false,
      error: BRIEFING_SCHEDULE_DECOMMISSIONED_MESSAGE,
      reason: BRIEFING_SCHEDULE_DECOMMISSIONED_REASON,
    },
    { status: 410 },
  );
}

export async function GET(request: Request) {
  return handleDecommissionedBriefingSchedule(request);
}

export async function POST(request: Request) {
  return handleDecommissionedBriefingSchedule(request);
}
