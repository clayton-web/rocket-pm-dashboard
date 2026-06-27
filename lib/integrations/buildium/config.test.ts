import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isBuildiumReadOnlyMode, resolveBuildiumBaseUrl } from "@/lib/integrations/buildium/config";

describe("isBuildiumReadOnlyMode", () => {
  const original = process.env.BUILDIUM_READ_ONLY;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.BUILDIUM_READ_ONLY;
    } else {
      process.env.BUILDIUM_READ_ONLY = original;
    }
  });

  it("defaults to read-only when unset", () => {
    delete process.env.BUILDIUM_READ_ONLY;
    assert.equal(isBuildiumReadOnlyMode(), true);
  });

  it("allows writes only when explicitly false", () => {
    process.env.BUILDIUM_READ_ONLY = "false";
    assert.equal(isBuildiumReadOnlyMode(), false);
  });
});

describe("resolveBuildiumBaseUrl", () => {
  const original = process.env.BUILDIUM_BASE_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.BUILDIUM_BASE_URL;
    } else {
      process.env.BUILDIUM_BASE_URL = original;
    }
  });

  it("uses sandbox host for SANDBOX environment", () => {
    delete process.env.BUILDIUM_BASE_URL;
    assert.equal(resolveBuildiumBaseUrl("SANDBOX"), "https://apisandbox.buildium.com");
  });

  it("uses production host for PRODUCTION environment", () => {
    delete process.env.BUILDIUM_BASE_URL;
    assert.equal(resolveBuildiumBaseUrl("PRODUCTION"), "https://api.buildium.com");
  });
});
