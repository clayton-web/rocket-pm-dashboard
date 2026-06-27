import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAbsoluteAppUrl,
  buildAppRoute,
  getAppBasePath,
  stripBasePath,
  withBasePath,
} from "@/lib/app-path";

describe("app-path helpers", () => {
  const originalBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
  const originalNextAuthUrl = process.env.NEXTAUTH_URL;

  it("withBasePath prefixes app routes", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/dashboard";

    assert.equal(getAppBasePath(), "/dashboard");
    assert.equal(withBasePath("/login"), "/dashboard/login");
    assert.equal(withBasePath("/dashboard/login"), "/dashboard/login");
    assert.equal(buildAppRoute("/api/health"), "/dashboard/api/health");
    assert.equal(stripBasePath("/dashboard/inbox"), "/inbox");
    assert.equal(stripBasePath("/dashboard"), "/");
    assert.equal(stripBasePath("/inbox"), "/inbox");
  });

  it("buildAbsoluteAppUrl keeps basePath on the same origin", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/dashboard";
    process.env.NEXTAUTH_URL = "https://example.com/dashboard";

    assert.equal(buildAbsoluteAppUrl("/login").href, "https://example.com/dashboard/login");
    assert.equal(
      buildAbsoluteAppUrl("/email").href,
      "https://example.com/dashboard/email",
    );
  });

  it("withBasePath is a no-op when base path is empty", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "";

    assert.equal(withBasePath("/login"), "/login");
    assert.equal(stripBasePath("/login"), "/login");
  });

  it("restores env", () => {
    if (originalBasePath === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
    } else {
      process.env.NEXT_PUBLIC_BASE_PATH = originalBasePath;
    }
    if (originalNextAuthUrl === undefined) {
      delete process.env.NEXTAUTH_URL;
    } else {
      process.env.NEXTAUTH_URL = originalNextAuthUrl;
    }
  });
});
