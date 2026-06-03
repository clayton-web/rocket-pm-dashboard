import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function isPublicPortalApi(pathname: string): boolean {
  return pathname.startsWith("/api/portal/");
}

function isPublicMaintenanceApi(req: NextRequest): boolean {
  const pathname = req.nextUrl.pathname;
  if (pathname === "/api/maintenance/submit-options") return true;
  if (pathname === "/api/maintenance" && req.method === "POST") return true;
  return false;
}

function isPublicLeasingApi(req: NextRequest): boolean {
  const pathname = req.nextUrl.pathname;
  if (pathname === "/api/leasing/submit-options") return true;
  if (pathname === "/api/leasing/viewing-request" && req.method === "POST") return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isLogin = pathname.startsWith("/login");
  const isAuthApi = pathname.startsWith("/api/auth");
  const isHealth = pathname === "/api/health";
  const isPortal = pathname.startsWith("/portal");
  const isPublicMaintenance = isPublicMaintenanceApi(req);
  const isPublicLeasing = isPublicLeasingApi(req);
  const isPublicPortalApiRoute = isPublicPortalApi(pathname);

  if (isAuthApi || isHealth || isPortal || isPublicMaintenance || isPublicLeasing || isPublicPortalApiRoute) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (!token && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (token && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/inbox";
    url.searchParams.delete("callbackUrl");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
