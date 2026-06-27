import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { buildiumGetJson, assertBuildiumWritesAllowed } from "@/lib/integrations/buildium/client";
import { BuildiumApiError } from "@/lib/integrations/buildium/errors";
import type { BuildiumFetchFn } from "@/lib/integrations/buildium/client";

describe("buildiumGetJson", () => {
  const originalReadOnly = process.env.BUILDIUM_READ_ONLY;

  afterEach(() => {
    if (originalReadOnly === undefined) {
      delete process.env.BUILDIUM_READ_ONLY;
    } else {
      process.env.BUILDIUM_READ_ONLY = originalReadOnly;
    }
  });

  it("sends auth headers and parses JSON with total count", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fetchFn: BuildiumFetchFn = async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(JSON.stringify([{ Id: 1, Name: "Sample Property" }]), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Total-Count": "42",
        },
      });
    };

    const result = await buildiumGetJson<Array<{ Id: number; Name: string }>>(
      {
        environment: "SANDBOX",
        credentials: { clientId: "client-id", clientSecret: "client-secret" },
        fetchFn,
      },
      "/v1/rentals",
      new URLSearchParams({ limit: "1" }),
    );

    assert.match(capturedUrl, /^https:\/\/apisandbox\.buildium\.com\/v1\/rentals\?/);
    assert.ok(capturedInit?.method === undefined || capturedInit?.method === "GET");
    const headers = capturedInit?.headers as Record<string, string>;
    assert.equal(headers["x-buildium-client-id"], "client-id");
    assert.equal(headers["x-buildium-client-secret"], "client-secret");
    assert.equal(result.totalCount, 42);
    assert.equal(result.data[0]?.Name, "Sample Property");
  });

  it("maps 401 responses to unauthorized errors", async () => {
    const fetchFn: BuildiumFetchFn = async () =>
      new Response(JSON.stringify({ Message: "Unauthorized" }), { status: 401 });

    await assert.rejects(
      () =>
        buildiumGetJson(
          {
            environment: "PRODUCTION",
            credentials: { clientId: "bad", clientSecret: "bad" },
            fetchFn,
          },
          "/v1/rentals",
        ),
      (error: unknown) => {
        assert.ok(error instanceof BuildiumApiError);
        assert.equal(error.code, "UNAUTHORIZED");
        return true;
      },
    );
  });
});

describe("assertBuildiumWritesAllowed", () => {
  const originalReadOnly = process.env.BUILDIUM_READ_ONLY;

  afterEach(() => {
    if (originalReadOnly === undefined) {
      delete process.env.BUILDIUM_READ_ONLY;
    } else {
      process.env.BUILDIUM_READ_ONLY = originalReadOnly;
    }
  });

  it("throws when read-only mode is enabled", () => {
    process.env.BUILDIUM_READ_ONLY = "true";
    assert.throws(() => assertBuildiumWritesAllowed(), BuildiumApiError);
  });
});
