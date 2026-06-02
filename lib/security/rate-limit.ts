/**
 * In-memory fixed-window rate limiter (per process).
 *
 * Limitations (documented in docs/deployment-checklist.md):
 * - Resets on deploy / cold start; not shared across serverless instances.
 * - Suitable for dev/staging and light abuse protection; use edge/WAF or Redis for strict prod limits.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitOptions = {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max requests allowed per window (inclusive). */
  max: number;
};

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + options.windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  if (bucket.count > options.max) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return { ok: false, retryAfterSec };
  }

  return { ok: true };
}

/** Best-effort client key for API throttling (trusts reverse-proxy headers when present). */
export function getRequestClientKey(request: Request, routeId: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    (forwarded ? forwarded.split(",")[0]?.trim() : null) ??
    request.headers.get("x-real-ip") ??
    "unknown";
  return `${routeId}:${ip}`;
}

export function rateLimitedJsonResponse(retryAfterSec: number): Response {
  return Response.json(
    { error: "Too many requests. Try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}
