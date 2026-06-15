import { NextResponse } from "next/server";
import { processClaimedJobs } from "@/lib/jobs/processor";
import { getJobProcessorSecret, verifyJobProcessorRequest } from "@/lib/jobs/policy";

export const runtime = "nodejs";
export const maxDuration = 60;

function parseLimit(body: unknown): number | undefined {
  if (!body || typeof body !== "object") return undefined;
  const limit = (body as { limit?: unknown }).limit;
  if (typeof limit === "number" && Number.isFinite(limit)) return limit;
  if (typeof limit === "string") {
    const n = Number(limit);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export async function POST(request: Request) {
  if (!getJobProcessorSecret()) {
    return NextResponse.json(
      { error: "Job processor is not configured (JOB_PROCESSOR_SECRET or CRON_SECRET)." },
      { status: 503 },
    );
  }

  if (!verifyJobProcessorRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let limit: number | undefined;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      limit = parseLimit(body);
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const result = await processClaimedJobs({ limit });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processor failed.";
    return NextResponse.json({ ok: false, error: message.slice(0, 500) }, { status: 500 });
  }
}

/** Vercel Cron invokes scheduled jobs with HTTP GET. */
export async function GET(request: Request) {
  return POST(request);
}
