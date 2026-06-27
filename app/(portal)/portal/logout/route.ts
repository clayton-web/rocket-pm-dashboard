import { NextResponse } from "next/server";
import { withBasePath } from "@/lib/app-path";
import { clearTenantSessionCookie } from "@/lib/portal/tenant-auth";

export async function GET(request: Request) {
  await clearTenantSessionCookie();
  return NextResponse.redirect(new URL(withBasePath("/portal"), request.url));
}
