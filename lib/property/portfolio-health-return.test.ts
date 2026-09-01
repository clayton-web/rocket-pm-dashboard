import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHealthEditPropertyHref,
  buildHealthEditTenancyHref,
  buildHealthReturnUrl,
  emptyHealthViewState,
  parseHealthCleanupContext,
  parseHealthFocusField,
  parseSafeHealthReturnPath,
  PORTFOLIO_HEALTH_RETURN_PATH,
  type HealthViewState,
} from "@/lib/property/portfolio-health-return";

function state(overrides: Partial<HealthViewState> = {}): HealthViewState {
  return { ...emptyHealthViewState(), ...overrides };
}

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

  it("preserves the full worklist state through a return path", () => {
    assert.equal(
      parseSafeHealthReturnPath(
        "/properties/health?filters=owner_contact&q=main+st&status=needs_attention&sort=updated",
      ),
      "/properties/health?status=needs_attention&sort=updated&filters=owner_contact&q=main+st",
    );
  });

  it("drops an invalid status, sort, and unrelated parameters from a return path", () => {
    assert.equal(
      parseSafeHealthReturnPath(
        "/properties/health?status=on_fire&sort=whatever&evil=1&filters=documents",
      ),
      "/properties/health?filters=documents",
    );
  });

  it("builds edit tenancy href with the full health context", () => {
    assert.equal(
      buildHealthEditTenancyHref(
        "tenancy-1",
        state({ filters: ["tenant_email", "rent_zero"] }),
      ),
      "/leasing/tenancies/tenancy-1?fromHealth=1&healthFilters=tenant_email%2Crent_zero#edit-tenancy",
    );
    assert.equal(
      buildHealthEditTenancyHref(
        "tenancy-1",
        state({ filters: ["tenant_email"], query: "main", status: "minor", sort: "address" }),
      ),
      "/leasing/tenancies/tenancy-1?fromHealth=1&healthFilters=tenant_email&healthQ=main" +
        "&healthStatus=minor&healthSort=address#edit-tenancy",
    );
  });

  it("omits default status and sort from the carried context", () => {
    assert.equal(
      buildHealthEditTenancyHref("tenancy-1", state({ status: "all", sort: "health" })),
      "/leasing/tenancies/tenancy-1?fromHealth=1#edit-tenancy",
    );
  });

  it("builds health return url with optional success param", () => {
    assert.equal(
      buildHealthReturnUrl(state({ filters: ["tenant_email"] }), { cleanupDone: "1" }),
      "/properties/health?filters=tenant_email&cleanupDone=1",
    );
  });

  it("round trips the worklist state back to the health page parameter names", () => {
    assert.equal(
      buildHealthReturnUrl(
        state({ filters: ["owner_contact"], query: "oak", status: "needs_attention", sort: "updated" }),
      ),
      "/properties/health?status=needs_attention&sort=updated&filters=owner_contact&q=oak",
    );
  });

  it("does not let extra params overwrite the worklist state", () => {
    assert.equal(
      buildHealthReturnUrl(state({ filters: ["documents"], query: "real" }), {
        filters: "spoofed",
        q: "spoofed",
        status: "spoofed",
        sort: "spoofed",
        cleanupDone: "1",
      }),
      "/properties/health?filters=documents&q=real&cleanupDone=1",
    );
  });

  it("builds a property edit href with an anchor and focus field", () => {
    assert.equal(
      buildHealthEditPropertyHref("prop-1", state({ filters: ["missing_postal_code"] }), {
        anchor: "edit-address",
        field: "postalCode",
      }),
      "/properties/prop-1?fromHealth=1&healthFilters=missing_postal_code&focus=postalCode#edit-address",
    );
  });

  it("builds a property edit href without a focus field when none is targeted", () => {
    assert.equal(
      buildHealthEditPropertyHref("prop-1", state(), { anchor: "documents" }),
      "/properties/prop-1?fromHealth=1#documents",
    );
  });

  it("parses health cleanup context only when fromHealth=1", () => {
    assert.deepEqual(
      parseHealthCleanupContext({
        fromHealth: "1",
        healthFilters: "tenant_email",
        healthQ: "main st",
        healthStatus: "needs_attention",
        healthSort: "updated",
      }),
      {
        filters: ["tenant_email"],
        query: "main st",
        status: "needs_attention",
        sort: "updated",
      },
    );
    assert.equal(parseHealthCleanupContext({ healthFilters: "tenant_email" }), null);
    assert.equal(parseHealthCleanupContext({ fromHealth: "0", healthFilters: "tenant_email" }), null);
  });

  it("still parses links written before the state was carried", () => {
    assert.deepEqual(
      parseHealthCleanupContext({ fromHealth: "1", healthFilters: "tenant_email,rent_zero" }),
      { filters: ["tenant_email", "rent_zero"], query: "", status: "all", sort: "health" },
    );
  });

  it("falls back to defaults for a hostile carried context", () => {
    assert.deepEqual(
      parseHealthCleanupContext({
        fromHealth: "1",
        healthFilters: "not_a_filter",
        healthStatus: "admin",
        healthSort: "; drop table",
      }),
      { filters: [], query: "", status: "all", sort: "health" },
    );
  });

  it("accepts only identifier-shaped focus fields", () => {
    assert.equal(parseHealthFocusField({ focus: "postalCode" }), "postalCode");
    assert.equal(parseHealthFocusField({ focus: "owner_email" }), "owner_email");
    assert.equal(parseHealthFocusField({ focus: "" }), null);
    assert.equal(parseHealthFocusField({}), null);
    assert.equal(parseHealthFocusField({ focus: "a[b]" }), null);
    assert.equal(parseHealthFocusField({ focus: "9lives" }), null);
    assert.equal(parseHealthFocusField({ focus: "x".repeat(64) }), null);
  });
});
