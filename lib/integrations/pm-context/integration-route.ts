import type { RateLimitOptions } from "@/lib/security/rate-limit";

/** Versioned base path for first-party server-to-server integration APIs. */
export const INTEGRATION_API_V1_PREFIX = "/api/integrations/v1/";

export const CONTEXT_RESOLVE_ROUTE = "/api/integrations/v1/context/resolve";

/**
 * True for versioned server-to-server integration routes.
 *
 * Middleware uses this to skip the *staff browser session* check only. These routes are not
 * public: each one authenticates its own bearer credential before doing any work. The narrow
 * prefix match matters — `/api/integrations/gmail/*` is a staff OAuth flow and must keep its
 * session requirement.
 */
export function isIntegrationApiV1Path(pathname: string): boolean {
  return pathname.startsWith(INTEGRATION_API_V1_PREFIX);
}

const DEFAULT_RESOLVE_LIMIT_PER_MINUTE = 60;
const DEFAULT_UNAUTHENTICATED_LIMIT_PER_MINUTE = 20;

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw?.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

/**
 * Per-credential limit. Keyed by credential id so one integration client cannot starve another,
 * and so a single organization's traffic is isolated from the rest.
 */
export function contextResolveRateLimit(): RateLimitOptions {
  return {
    windowMs: 60_000,
    max: readPositiveInt(
      process.env.PM_CONTEXT_RATE_LIMIT_PER_MINUTE,
      DEFAULT_RESOLVE_LIMIT_PER_MINUTE,
    ),
  };
}

/** Pre-authentication limit, keyed by client IP, to bound credential guessing and audit writes. */
export function integrationAuthRateLimit(): RateLimitOptions {
  return {
    windowMs: 60_000,
    max: readPositiveInt(
      process.env.PM_CONTEXT_AUTH_RATE_LIMIT_PER_MINUTE,
      DEFAULT_UNAUTHENTICATED_LIMIT_PER_MINUTE,
    ),
  };
}

export function contextResolveRateLimitKey(credentialId: string): string {
  return `integration:pm-context-resolve:credential:${credentialId}`;
}
