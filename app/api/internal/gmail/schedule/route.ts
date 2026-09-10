import { NextResponse } from "next/server";
import { enqueueScheduledGmailSyncForConnectedAccounts } from "@/lib/gmail/enqueue-scheduled-gmail-sync";
import {
  getJobProcessorActorUserId,
  getJobProcessorSecret,
  verifyJobProcessorRequest,
} from "@/lib/jobs/policy";

export const runtime = "nodejs";

async function handleScheduledGmailSyncCron(request: Request) {
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
  const dryRun = url.searchParams.get("dryRun") === "true";
  const organizationId = url.searchParams.get("organizationId")?.trim() || undefined;

  try {
    const actorUserId = getJobProcessorActorUserId(undefined);
    const result = await enqueueScheduledGmailSyncForConnectedAccounts({
      actorUserId,
      organizationId,
      dryRun,
    });

    return NextResponse.json({
      ok: true,
      organizationsScoped: organizationId ?? null,
      accountsConsidered: result.accountsConsidered,
      enqueued: result.enqueued,
      alreadyQueued: result.alreadyQueued,
      skipped: result.skipped,
      results: result.results,
      nextStep:
        "Drain the job queue via POST /api/internal/jobs/process so gmail.sync jobs run.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled Gmail sync enqueue failed.";
    return NextResponse.json({ ok: false, error: message.slice(0, 500) }, { status: 500 });
  }
}

/** External cron (GitHub Actions) or manual operator trigger. Independent of Daily Briefing. */
export async function GET(request: Request) {
  return handleScheduledGmailSyncCron(request);
}

export async function POST(request: Request) {
  return handleScheduledGmailSyncCron(request);
}
