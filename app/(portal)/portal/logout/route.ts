import { NextResponse } from "next/server";
import { clearTenantSessionCookie } from "@/lib/portal/tenant-auth";

export async function GET(request: Request) {
  await clearTenantSessionCookie();
  return NextResponse.redirect(new URL("/portal", request.url));
}
