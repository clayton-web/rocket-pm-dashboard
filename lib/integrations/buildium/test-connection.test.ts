import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { testBuildiumConnection } from "@/lib/integrations/buildium/test-connection";
import type { BuildiumFetchFn } from "@/lib/integrations/buildium/client";

describe("testBuildiumConnection", () => {
  it("returns property count from a successful rentals request", async () => {
    const fetchFn: BuildiumFetchFn = async () =>
      new Response(JSON.stringify([{ Id: 10, Name: "Axford House" }]), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Total-Count": "3",
        },
      });

    const result = await testBuildiumConnection({
      environment: "SANDBOX",
      clientId: "client",
      clientSecret: "secret",
      fetchFn,
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.propertyCount, 3);
      assert.equal(result.samplePropertyName, "Axford House");
    }
  });

  it("returns a friendly error for unauthorized credentials", async () => {
    const fetchFn: BuildiumFetchFn = async () =>
      new Response(JSON.stringify({ Message: "Unauthorized" }), { status: 401 });

    const result = await testBuildiumConnection({
      environment: "PRODUCTION",
      clientId: "bad",
      clientSecret: "bad",
      fetchFn,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "UNAUTHORIZED");
      assert.match(result.error, /authorized/i);
    }
  });

  it("requires credentials", async () => {
    const result = await testBuildiumConnection({
      environment: "PRODUCTION",
      clientId: "",
      clientSecret: "",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "VALIDATION");
    }
  });
});
