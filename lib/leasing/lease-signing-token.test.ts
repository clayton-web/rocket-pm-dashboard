import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateLeaseSigningToken,
  hashLeaseSigningToken,
  isValidLeaseSigningTokenFormat,
  leaseSigningTokenExpiresAt,
  tokensMatch,
} from "@/lib/leasing/lease-signing-token";

describe("lease signing token", () => {
  it("generates unique tokens and stable hashes", () => {
    const first = generateLeaseSigningToken();
    const second = generateLeaseSigningToken();
    assert.notEqual(first.token, second.token);
    assert.equal(first.tokenHash, hashLeaseSigningToken(first.token));
    assert.equal(tokensMatch(first.tokenHash, first.token), true);
    assert.equal(tokensMatch(first.tokenHash, second.token), false);
  });

  it("validates token format", () => {
    assert.equal(isValidLeaseSigningTokenFormat(""), false);
    assert.equal(isValidLeaseSigningTokenFormat("short"), false);
    assert.equal(isValidLeaseSigningTokenFormat(generateLeaseSigningToken().token), true);
  });

  it("sets expiry 30 days ahead", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const expires = leaseSigningTokenExpiresAt(now);
    assert.equal(expires.toISOString(), "2026-07-01T00:00:00.000Z");
  });
});
