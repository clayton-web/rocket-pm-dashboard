import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireStaffMaintenanceContext } from "@/lib/maintenance/authorization";
import { getMaintenanceForStaff, patchMaintenanceForStaff } from "@/lib/maintenance/maintenance.service";
import { parsePatchMaintenanceBody } from "@/lib/validation/maintenance";
import { MaintenanceWorkflowTransitionError } from "@/lib/maintenance/workflow";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const ctx = await requireStaffMaintenanceContext();
  if (ctx instanceof Response) return ctx;

  const { id } = await context.params;
  try {
    const row = await getMaintenanceForStaff(ctx, id);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(row);
  } catch (e) {
    if (e instanceof Error && e.message === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const ctx = await requireStaffMaintenanceContext();
  if (ctx instanceof Response) return ctx;

  const { id } = await context.params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parsePatchMaintenanceBody(raw);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const row = await patchMaintenanceForStaff(ctx, id, parsed);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    revalidatePath("/operations");
    revalidatePath("/maintenance");
    revalidatePath(`/maintenance/${id}`);
    return NextResponse.json(row);
  } catch (e) {
    if (e instanceof MaintenanceWorkflowTransitionError) {
      return NextResponse.json({ error: "invalid_transition", message: e.message }, { status: 400 });
    }
    if (e instanceof Error && e.message === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    console.error("[PATCH /api/maintenance/[id]]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
