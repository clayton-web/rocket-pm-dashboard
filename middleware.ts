import {
  authenticatedStaffLoginRedirect,
  unauthenticatedStaffRedirect,
} from "@/lib/auth/staff-middleware-redirect";
import { stripBasePath } from "@/lib/app-path";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function isPublicPortalApi(pathname: string): boolean {
  return pathname.startsWith("/api/portal/");
}

function isPublicMaintenanceApi(req: NextRequest): boolean {
  const pathname = stripBasePath(req.nextUrl.pathname);
  if (pathname === "/api/maintenance/submit-options") return true;
  if (pathname === "/api/maintenance" && req.method === "POST") return true;
  return false;
}

function isPublicLeasingApi(req: NextRequest): boolean {
  const pathname = stripBasePath(req.nextUrl.pathname);
  if (pathname === "/api/leasing/submit-options") return true;
  if (pathname === "/api/leasing/prospect-prefill" && req.method === "GET") return true;
  if (pathname === "/api/leasing/viewing-request" && req.method === "POST") return true;
  if (pathname === "/api/leasing/application" && req.method === "POST") return true;
  if (pathname.startsWith("/api/leasing/application/")) {
    if (req.method === "PATCH") return true;
    if (req.method === "POST" && pathname.endsWith("/submit")) return true;
  }
  return false;
}

export async function middleware(req: NextRequest) {
  const pathname = stripBasePath(req.nextUrl.pathname);
  const isLogin = pathname.startsWith("/login");
  const isAuthApi = pathname.startsWith("/api/auth");
  const isHealth = pathname === "/api/health";
  const isInternalCronRoute =
    pathname === "/api/internal/jobs/process" ||
    pathname === "/api/internal/gemini-probe" ||
    pathname === "/api/internal/briefing/schedule";
  const isPortal = pathname.startsWith("/portal");
  const isSignLease = pathname.startsWith("/sign/lease");
  const isSignLeaseApi = pathname.startsWith("/api/sign/lease");
  const isPublicMaintenance = isPublicMaintenanceApi(req);
  const isPublicLeasing = isPublicLeasingApi(req);
  const isPublicPortalApiRoute = isPublicPortalApi(pathname);

  if (
    isAuthApi ||
    isHealth ||
    isInternalCronRoute ||
    isPortal ||
    isSignLease ||
    isSignLeaseApi ||
    isPublicMaintenance ||
    isPublicLeasing ||
    isPublicPortalApiRoute
  ) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (!token && !isLogin) {
    const redirect = unauthenticatedStaffRedirect(pathname);
    const url = req.nextUrl.clone();
    url.pathname = redirect.pathname;
    url.searchParams.set("callbackUrl", redirect.callbackUrl);
    return NextResponse.redirect(url);
  }

  if (token && isLogin) {
    const redirect = authenticatedStaffLoginRedirect();
    const url = req.nextUrl.clone();
    url.pathname = redirect.pathname;
    url.searchParams.delete("callbackUrl");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
