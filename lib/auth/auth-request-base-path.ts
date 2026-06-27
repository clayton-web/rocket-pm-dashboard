import { NextRequest } from "next/server";
import { getAppBasePath } from "@/lib/app-path";

/**
 * Next.js strips `basePath` before Auth.js route handlers run. Re-inject it so
 * Auth.js `basePath` (e.g. `/dashboard/api/auth`) matches the incoming URL.
 */
export function withAuthRequestBasePath(req: NextRequest): NextRequest {
  const appBasePath = getAppBasePath();
  if (!appBasePath) {
    return req;
  }

  const url = new URL(req.url);
  if (url.pathname.startsWith(appBasePath)) {
    return req;
  }

  url.pathname = `${appBasePath}${url.pathname}`;
  return new NextRequest(url.toString(), req);
}
