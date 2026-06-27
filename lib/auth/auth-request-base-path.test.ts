import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { withAuthRequestBasePath } from "@/lib/auth/auth-request-base-path";

describe("withAuthRequestBasePath", () => {
  const originalBasePath = process.env.NEXT_PUBLIC_BASE_PATH;

  it("prefixes stripped auth paths with the app base path", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/dashboard";

    const req = new NextRequest("https://www.rocketlogic.ca/api/auth/providers", {
      headers: {
        host: "www.rocketlogic.ca",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "www.rocketlogic.ca",
      },
    });

    const rewritten = withAuthRequestBasePath(req);
    assert.equal(rewritten.url, "https://www.rocketlogic.ca/dashboard/api/auth/providers");
  });

  it("leaves already-prefixed paths unchanged", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/dashboard";

    const req = new NextRequest("https://example.com/dashboard/api/auth/csrf");
    const rewritten = withAuthRequestBasePath(req);
    assert.equal(rewritten.url, req.url);
  });

  it("is a no-op when base path is empty", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "";

    const req = new NextRequest("https://example.com/api/auth/session");
    assert.equal(withAuthRequestBasePath(req).url, req.url);
  });

  it("restores env", () => {
    if (originalBasePath === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
    } else {
      process.env.NEXT_PUBLIC_BASE_PATH = originalBasePath;
    }
  });
});
