/** Next.js `basePath` for subpath deployment (e.g. `/dashboard` on rocketlogic.ca). */
export function getAppBasePath(): string {
  return normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH ?? "/dashboard");
}

function normalizeBasePath(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed || trimmed === "/") {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/** Prefix an app-relative path with the configured base path. Idempotent. */
export function withBasePath(path: string): string {
  const basePath = getAppBasePath();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!basePath) {
    return normalized;
  }
  if (normalized === basePath || normalized.startsWith(`${basePath}/`)) {
    return normalized;
  }
  return `${basePath}${normalized}`;
}

/** Remove the configured base path from an incoming request pathname for route matching. */
export function stripBasePath(pathname: string): string {
  const basePath = getAppBasePath();
  if (!basePath) {
    return pathname || "/";
  }
  if (pathname === basePath) {
    return "/";
  }
  if (pathname.startsWith(`${basePath}/`)) {
    const stripped = pathname.slice(basePath.length);
    return stripped.startsWith("/") ? stripped : `/${stripped}`;
  }
  return pathname || "/";
}

/** App-relative route path including the configured base path (for redirects and links). */
export function buildAppRoute(path: string): string {
  return withBasePath(path);
}

/** Public origin only (scheme + host), without the base path segment. */
export function getAppOrigin(): string {
  const raw = process.env.NEXTAUTH_URL?.trim() || process.env.AUTH_URL?.trim();
  if (!raw) {
    return "http://localhost:3000";
  }
  return new URL(raw).origin;
}

/** Absolute in-app URL for server redirects (`origin` + basePath + path). */
export function buildAbsoluteAppUrl(path: string): URL {
  return new URL(withBasePath(path), getAppOrigin());
}

/** Auth.js API base path segment (e.g. `/dashboard/api/auth`). */
export function getAuthBasePath(): string {
  return withBasePath("/api/auth");
}
