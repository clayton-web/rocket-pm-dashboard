import { NextResponse } from "next/server";
import { listPublicLeasingSubmitOptions } from "@/lib/leasing/public-intake";

/** Public — active rental properties/units in the public portal org. */
export async function GET() {
  try {
    const options = await listPublicLeasingSubmitOptions();
    return NextResponse.json(options);
  } catch (e) {
    console.error("[GET /api/leasing/submit-options]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
