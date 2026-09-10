import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_HINTS_PER_FIELD,
  MAX_HINT_LENGTH,
  parseContextResolveRequest,
} from "./context-resolve-request";

function ok(body: unknown) {
  const parsed = parseContextResolveRequest(body);
  assert.ok(!("error" in parsed), `expected success, got ${JSON.stringify(parsed)}`);
  return parsed;
}

function err(body: unknown): string {
  const parsed = parseContextResolveRequest(body);
  assert.ok("error" in parsed, `expected an error, got ${JSON.stringify(parsed)}`);
  return parsed.error;
}

describe("parseContextResolveRequest", () => {
  it("accepts a minimal request with only a sender email", () => {
    const parsed = ok({ senderEmail: "Tenant@Example.COM" });
    assert.equal(parsed.request.senderEmail, "tenant@example.com");
    assert.deepEqual(parsed.request.addressHints, []);
    assert.equal(parsed.request.knownPropertyId, null);
  });

  it("accepts hints without a sender email", () => {
    const parsed = ok({ addressHints: ["123 Main Street"], unitHints: ["204"] });
    assert.deepEqual(parsed.request.addressHints, ["123 Main Street"]);
    assert.deepEqual(parsed.request.unitHints, ["204"]);
  });

  it("strips a display name from an RFC-style sender address", () => {
    const parsed = ok({ senderEmail: "Jane Doe <jane@example.com>" });
    assert.equal(parsed.request.senderEmail, "jane@example.com");
  });

  it("rejects a client-supplied organizationId instead of silently ignoring it", () => {
    const message = err({ senderEmail: "a@b.com", organizationId: "org_b" });
    assert.match(message, /organizationId is not accepted/);
  });

  it("requires at least one usable signal", () => {
    assert.match(err({}), /At least one lookup signal/);
    assert.match(err({ addressHints: [], unitHints: [] }), /At least one lookup signal/);
    assert.match(err({ senderEmail: null, knownPropertyId: null }), /At least one lookup signal/);
  });

  it("rejects a non-object body", () => {
    assert.match(err(null), /must be a JSON object/);
    assert.match(err("string"), /must be a JSON object/);
    assert.match(err([{ senderEmail: "a@b.com" }]), /must be a JSON object/);
  });

  it("rejects an invalid sender email", () => {
    assert.match(err({ senderEmail: "not-an-email" }), /not a valid email/);
    assert.match(err({ senderEmail: 42 }), /must be a string/);
  });

  it("bounds hint count and length", () => {
    const tooMany = Array.from({ length: MAX_HINTS_PER_FIELD + 1 }, (_, i) => `${i} Main St`);
    assert.match(err({ addressHints: tooMany }), /at most/);
    assert.match(err({ addressHints: ["x".repeat(MAX_HINT_LENGTH + 1)] }), /characters or fewer/);
    assert.match(err({ addressHints: "123 Main St" }), /must be an array/);
    assert.match(err({ unitHints: [204] }), /must be an array of strings/);
  });

  it("drops blank hints while keeping the rest", () => {
    const parsed = ok({ addressHints: ["  ", "123 Main St", ""] });
    assert.deepEqual(parsed.request.addressHints, ["123 Main St"]);
  });

  it("reports senderPhone as an unsupported signal rather than dropping it silently", () => {
    const parsed = ok({ senderEmail: "a@b.com", senderPhone: "+1 604 555 0101" });
    assert.deepEqual(parsed.unsupportedSignals, ["senderPhone"]);
  });

  it("reports no unsupported signals when senderPhone is absent or null", () => {
    assert.deepEqual(ok({ senderEmail: "a@b.com" }).unsupportedSignals, []);
    assert.deepEqual(ok({ senderEmail: "a@b.com", senderPhone: null }).unsupportedSignals, []);
  });

  it("does not treat senderPhone alone as a usable signal", () => {
    assert.match(err({ senderPhone: "+1 604 555 0101" }), /At least one lookup signal/);
  });

  it("rejects an oversized id", () => {
    assert.match(err({ knownPropertyId: "x".repeat(200) }), /not a valid id/);
  });
});
