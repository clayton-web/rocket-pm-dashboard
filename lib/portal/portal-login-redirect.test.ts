import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_TENANT_PORTAL_REDIRECT,
  resolveTenantPortalLoginRedirect,
  tenantPortalLoginHref,
} from "@/lib/portal/portal-login-redirect";

describe("resolveTenantPortalLoginRedirect", () => {
  it("falls back to dashboard when next is missing", () => {
    assert.equal(resolveTenantPortalLoginRedirect(undefined), DEFAULT_TENANT_PORTAL_REDIRECT);
    assert.equal(resolveTenantPortalLoginRedirect(null), DEFAULT_TENANT_PORTAL_REDIRECT);
    assert.equal(resolveTenantPortalLoginRedirect(""), DEFAULT_TENANT_PORTAL_REDIRECT);
  });

  it("allows internal portal destinations", () => {
    assert.equal(resolveTenantPortalLoginRedirect("/portal/documents"), "/portal/documents");
    assert.equal(resolveTenantPortalLoginRedirect("/portal/dashboard"), "/portal/dashboard");
    assert.equal(
      resolveTenantPortalLoginRedirect("/portal/maintenance/req-123"),
      "/portal/maintenance/req-123",
    );
    assert.equal(resolveTenantPortalLoginRedirect("/portal/notice/new"), "/portal/notice/new");
  });

  it("preserves query strings on allowed paths", () => {
    assert.equal(
      resolveTenantPortalLoginRedirect("/portal/maintenance?tab=open"),
      "/portal/maintenance?tab=open",
    );
  });

  it("rejects open redirects and external URLs", () => {
    assert.equal(resolveTenantPortalLoginRedirect("//evil.example"), DEFAULT_TENANT_PORTAL_REDIRECT);
    assert.equal(
      resolveTenantPortalLoginRedirect("https://evil.example/portal/documents"),
      DEFAULT_TENANT_PORTAL_REDIRECT,
    );
    assert.equal(
      resolveTenantPortalLoginRedirect("/portal/../../../etc/passwd"),
      DEFAULT_TENANT_PORTAL_REDIRECT,
    );
    assert.equal(
      resolveTenantPortalLoginRedirect("/leasing/tenancies/abc"),
      DEFAULT_TENANT_PORTAL_REDIRECT,
    );
  });

  it("rejects login and logout loops", () => {
    assert.equal(resolveTenantPortalLoginRedirect("/portal/login"), DEFAULT_TENANT_PORTAL_REDIRECT);
    assert.equal(
      resolveTenantPortalLoginRedirect("/portal/login?next=/portal/documents"),
      DEFAULT_TENANT_PORTAL_REDIRECT,
    );
    assert.equal(resolveTenantPortalLoginRedirect("/portal/logout"), DEFAULT_TENANT_PORTAL_REDIRECT);
  });

  it("rejects public portal routes not meant for post-login redirect", () => {
    assert.equal(
      resolveTenantPortalLoginRedirect("/portal/application"),
      DEFAULT_TENANT_PORTAL_REDIRECT,
    );
    assert.equal(resolveTenantPortalLoginRedirect("/portal/viewing"), DEFAULT_TENANT_PORTAL_REDIRECT);
  });
});

describe("tenantPortalLoginHref", () => {
  it("builds login links with encoded next paths", () => {
    assert.equal(
      tenantPortalLoginHref("/portal/documents"),
      "/portal/login?next=%2Fportal%2Fdocuments",
    );
  });
});
