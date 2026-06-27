import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withBasePath } from "@/lib/app-path";
import {
  authenticatedStaffLoginRedirect,
  unauthenticatedStaffRedirect,
} from "@/lib/auth/staff-middleware-redirect";

describe("staff middleware redirect targets", () => {
  const originalBasePath = process.env.NEXT_PUBLIC_BASE_PATH;

  it("uses app-relative login path that becomes /dashboard/login externally", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/dashboard";

    const redirect = unauthenticatedStaffRedirect("/settings/integrations/buildium");
    assert.equal(redirect.pathname, "/login");
    assert.equal(withBasePath(redirect.pathname), "/dashboard/login");
    assert.equal(withBasePath("/login"), "/dashboard/login");
    assert.equal(withBasePath("/dashboard/login"), "/dashboard/login");
    assert.equal(redirect.callbackUrl, "/settings/integrations/buildium");
  });

  it("uses app-relative inbox path for authenticated login redirect", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/dashboard";

    const redirect = authenticatedStaffLoginRedirect();
    assert.equal(redirect.pathname, "/inbox");
    assert.equal(withBasePath(redirect.pathname), "/dashboard/inbox");
  });

  it("restores env", () => {
    if (originalBasePath === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
    } else {
      process.env.NEXT_PUBLIC_BASE_PATH = originalBasePath;
    }
  });
});
