import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  CONTEXT_RESOLVE_ROUTE,
  contextResolveRateLimit,
  contextResolveRateLimitKey,
  integrationAuthRateLimit,
  isIntegrationApiV1Path,
} from "./integration-route";

describe("isIntegrationApiV1Path", () => {
  it("matches versioned server-to-server integration routes", () => {
    assert.equal(isIntegrationApiV1Path(CONTEXT_RESOLVE_ROUTE), true);
    assert.equal(isIntegrationApiV1Path("/api/integrations/v1/context/resolve"), true);
  });

  it("does not exempt the staff Gmail OAuth routes from the session check", () => {
    assert.equal(isIntegrationApiV1Path("/api/integrations/gmail/connect"), false);
    assert.equal(isIntegrationApiV1Path("/api/integrations/gmail/callback"), false);
  });

  it("does not match unrelated or lookalike paths", () => {
    const cases = [
      "/api/integrations",
      "/api/integrations/",
      "/api/integrations/v1",
      "/api/integrations/v2/context/resolve",
      "/api/internal/jobs/process",
      "/api/portal/auth/start",
      "/dashboard",
      "/evil/api/integrations/v1/context/resolve",
    ];
    for (const path of cases) {
      assert.equal(isIntegrationApiV1Path(path), false, path);
    }
  });
});

describe("integration rate limits", () => {
  it("defaults to a per-minute window for both limiters", () => {
    assert.equal(contextResolveRateLimit().windowMs, 60_000);
    assert.equal(integrationAuthRateLimit().windowMs, 60_000);
    assert.ok(contextResolveRateLimit().max > 0);
    assert.ok(integrationAuthRateLimit().max > 0);
  });

  it("keys the resolver limit per credential so one client cannot starve another", () => {
    const a = contextResolveRateLimitKey("cred_a");
    const b = contextResolveRateLimitKey("cred_b");
    assert.notEqual(a, b);
    assert.ok(a.includes("cred_a"));

    const options = { windowMs: 60_000, max: 2 };
    assert.equal(checkRateLimit(a, options).ok, true);
    assert.equal(checkRateLimit(a, options).ok, true);
    const exhausted = checkRateLimit(a, options);
    assert.equal(exhausted.ok, false);
    if (!exhausted.ok) assert.ok(exhausted.retryAfterSec > 0);

    // A different credential has its own budget.
    assert.equal(checkRateLimit(b, options).ok, true);
  });
});
