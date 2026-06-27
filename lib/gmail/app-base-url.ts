import { getAppBasePath, getAppOrigin } from "@/lib/app-path";

export function getAppBaseUrl(): string {
  const raw = process.env.NEXTAUTH_URL?.trim() || process.env.AUTH_URL?.trim();
  if (!raw) {
    const basePath = getAppBasePath();
    const origin = getAppOrigin();
    return basePath ? `${origin}${basePath}` : origin;
  }
  return raw.replace(/\/+$/, "");
}
