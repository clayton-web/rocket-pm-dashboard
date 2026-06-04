/** Default post-login destination when `next` is missing or invalid. */
export const DEFAULT_TENANT_PORTAL_REDIRECT = "/portal/dashboard";

/** Authenticated tenant portal paths safe for post-login redirect. */
const ALLOWED_PATH_PREFIXES = [
  "/portal/dashboard",
  "/portal/documents",
  "/portal/maintenance",
  "/portal/notice/new",
] as const;

/**
 * Resolve a safe internal portal redirect after tenant login.
 * Rejects open redirects, traversal, and non-portal paths.
 */
export function resolveTenantPortalLoginRedirect(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") {
    return DEFAULT_TENANT_PORTAL_REDIRECT;
  }

  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) {
    return DEFAULT_TENANT_PORTAL_REDIRECT;
  }

  if (
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    trimmed.includes("..") ||
    trimmed.includes(":") ||
    trimmed === "/portal/login" ||
    trimmed.startsWith("/portal/login?") ||
    trimmed.startsWith("/portal/logout")
  ) {
    return DEFAULT_TENANT_PORTAL_REDIRECT;
  }

  const pathname = trimmed.split(/[?#]/)[0] ?? trimmed;
  if (!pathname.startsWith("/portal/")) {
    return DEFAULT_TENANT_PORTAL_REDIRECT;
  }

  const allowed = ALLOWED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!allowed) {
    return DEFAULT_TENANT_PORTAL_REDIRECT;
  }

  return trimmed;
}

export function tenantPortalLoginHref(nextPath: string): string {
  const safe = resolveTenantPortalLoginRedirect(nextPath);
  if (safe === DEFAULT_TENANT_PORTAL_REDIRECT) {
    return "/portal/login";
  }
  return `/portal/login?next=${encodeURIComponent(safe)}`;
}
