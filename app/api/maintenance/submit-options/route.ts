import { NextResponse } from "next/server";
import { listPublicSubmitOptions } from "@/lib/maintenance/maintenance.service";

/** Public — returns tenancy pick-list labels only (no internal ids beyond tenancyId). */
export async function GET() {
  try {
    const options = await listPublicSubmitOptions();
    return NextResponse.json(options);
  } catch (e) {
    console.error("[GET /api/maintenance/submit-options]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
