import { NextResponse } from "next/server";
import { lookupMaintenanceForTenant } from "@/lib/portal/maintenance-tenant-status";

/** Public POST — maintenance status by reference id + email (no list endpoint). */
export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const o = body as Record<string, unknown>;
    const requestId = typeof o.requestId === "string" ? o.requestId : "";
    const email = typeof o.email === "string" ? o.email : "";

    if (!requestId.trim() || !email.trim()) {
      return NextResponse.json({ error: "Reference and email are required" }, { status: 400 });
    }

    const result = await lookupMaintenanceForTenant(requestId, email);
    if (!result) {
      return NextResponse.json(
        { error: "No matching request found. Check your reference and email." },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error("[POST /api/portal/maintenance/lookup]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
