import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHealthEditTenancyHref,
  buildHealthReturnUrl,
  parseHealthCleanupContext,
  parseSafeHealthReturnPath,
  PORTFOLIO_HEALTH_RETURN_PATH,
} from "@/lib/property/portfolio-health-return";

describe("portfolio health return URLs", () => {
  it("accepts safe internal health return paths", () => {
    assert.equal(
      parseSafeHealthReturnPath("/properties/health?filters=tenant_email,placeholder_dates"),
      "/properties/health?filters=tenant_email%2Cplaceholder_dates",
    );
    assert.equal(parseSafeHealthReturnPath("/properties/health"), PORTFOLIO_HEALTH_RETURN_PATH);
  });

  it("rejects open redirects and external paths", () => {
    assert.equal(parseSafeHealthReturnPath("https://evil.example/phish"), null);
    assert.equal(parseSafeHealthReturnPath("//evil.example/phish"), null);
    assert.equal(parseSafeHealthReturnPath("/leasing/tenancies/abc"), null);
    assert.equal(parseSafeHealthReturnPath("/properties/health@evil.example"), null);
    assert.equal(parseSafeHealthReturnPath("/properties/health\\@evil.example"), null);
  });

  it("sanitizes unknown filter tokens in return paths", () => {
    assert.equal(
      parseSafeHealthReturnPath("/properties/health?filters=tenant_email,not_a_filter"),
      "/properties/health?filters=tenant_email",
    );
  });

  it("builds edit tenancy href with health context", () => {
    assert.equal(
      buildHealthEditTenancyHref("tenancy-1", ["tenant_email", "rent_zero"]),
      "/leasing/tenancies/tenancy-1?fromHealth=1&healthFilters=tenant_email%2Crent_zero#edit-tenancy",
    );
  });

  it("builds health return url with optional success param", () => {
    assert.equal(
      buildHealthReturnUrl(["tenant_email"], { cleanupDone: "1" }),
      "/properties/health?filters=tenant_email&cleanupDone=1",
    );
  });

  it("parses health cleanup context only when fromHealth=1", () => {
    assert.deepEqual(parseHealthCleanupContext({ fromHealth: "1", healthFilters: "tenant_email" }), {
      filters: ["tenant_email"],
    });
    assert.equal(parseHealthCleanupContext({ healthFilters: "tenant_email" }), null);
    assert.equal(parseHealthCleanupContext({ fromHealth: "0", healthFilters: "tenant_email" }), null);
  });
});
