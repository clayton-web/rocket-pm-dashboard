import { NextResponse } from "next/server";
import { requireStaffMaintenanceContext } from "@/lib/maintenance/authorization";
import {
  checkRateLimit,
  getRequestClientKey,
  rateLimitedJsonResponse,
} from "@/lib/security/rate-limit";
import {
  createMaintenanceFromPublicIntake,
  listMaintenanceForStaff,
} from "@/lib/maintenance/maintenance.service";
import { defaultUrgencyForIssue, tradeFromIssueLabel } from "@/lib/maintenance/triage-map";
import { parsePostMaintenanceBody } from "@/lib/validation/maintenance";
import { MaintenanceWorkflowTransitionError } from "@/lib/maintenance/workflow";

/** Staff list — Prisma, scoped to active organization. */
export async function GET() {
  const ctx = await requireStaffMaintenanceContext();
  if (ctx instanceof Response) return ctx;

  try {
    const rows = await listMaintenanceForStaff(ctx);
    return NextResponse.json(rows);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const PUBLIC_MAINTENANCE_POST_LIMIT = { windowMs: 60_000, max: 8 } as const;

/** Public tenant intake — validates tenancy; does not trust client property/unit ids. */
export async function POST(request: Request) {
  const rateKey = getRequestClientKey(request, "POST:/api/maintenance");
  const limited = checkRateLimit(rateKey, PUBLIC_MAINTENANCE_POST_LIMIT);
  if (!limited.ok) {
    return rateLimitedJsonResponse(limited.retryAfterSec);
  }

  try {
    const raw: unknown = await request.json();
    const parsed = parsePostMaintenanceBody(raw);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const trade =
      parsed.triage_trade ??
      (parsed.issueType ? tradeFromIssueLabel(parsed.issueType) : "general");
    const urgency = parsed.triage_urgency ?? defaultUrgencyForIssue();
    const triageSummary =
      parsed.triage_summary?.trim() || "Submitted without guided triage";

    const row = await createMaintenanceFromPublicIntake({
      tenancyId: parsed.tenancyId,
      title: parsed.title,
      description: parsed.description,
      trade,
      urgency,
      triageSummary,
      category: parsed.issueType ?? null,
    });

    return NextResponse.json(row);
  } catch (e) {
    if (e instanceof MaintenanceWorkflowTransitionError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (e instanceof Error && e.message === "invalid_tenancy") {
      return NextResponse.json({ error: "Invalid tenancy selection" }, { status: 400 });
    }
    console.error("[POST /api/maintenance]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
