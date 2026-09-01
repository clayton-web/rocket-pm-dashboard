import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  credentialTokenMatches,
  extractBearerToken,
  generateCredentialToken,
  hashCredentialToken,
  parseCredentialToken,
} from "./credential-token";

describe("generateCredentialToken", () => {
  it("returns a raw token whose hash is what gets persisted", () => {
    const generated = generateCredentialToken("PRODUCTION");
    assert.equal(generated.secretHash, hashCredentialToken(generated.rawToken));
    assert.ok(credentialTokenMatches(generated.secretHash, generated.rawToken));
  });

  it("never puts the raw secret inside the persisted representation", () => {
    const generated = generateCredentialToken("PRODUCTION");
    const secret = generated.rawToken.split("_").slice(3).join("_");

    assert.ok(secret.length >= 32);
    assert.ok(!generated.secretHash.includes(secret));
    assert.ok(!generated.keyId.includes(secret));
    assert.ok(!generated.rawToken.includes(generated.secretHash));
  });

  it("tags environment so production and development tokens are distinguishable", () => {
    assert.match(generateCredentialToken("PRODUCTION").rawToken, /^pmctx_live_/);
    assert.match(generateCredentialToken("DEVELOPMENT").rawToken, /^pmctx_test_/);
  });

  it("produces unique key ids and secrets across issuances", () => {
    const keyIds = new Set<string>();
    const hashes = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const generated = generateCredentialToken("PRODUCTION");
      keyIds.add(generated.keyId);
      hashes.add(generated.secretHash);
    }
    assert.equal(keyIds.size, 50);
    assert.equal(hashes.size, 50);
  });
});

describe("parseCredentialToken", () => {
  it("extracts environment and key id without validating the secret", () => {
    const generated = generateCredentialToken("DEVELOPMENT");
    const parsed = parseCredentialToken(generated.rawToken);
    assert.deepEqual(parsed, { environment: "DEVELOPMENT", keyId: generated.keyId });
  });

  it("rejects malformed tokens", () => {
    const generated = generateCredentialToken("PRODUCTION");
    const cases = [
      "",
      "   ",
      "not-a-token",
      "pmctx_live_onlythree",
      "pmctx_staging_abc_" + "x".repeat(40),
      "other_live_abc_" + "x".repeat(40),
      `pmctx_live_${generated.keyId}_short`,
      `pmctx_live_bad key_${"x".repeat(40)}`,
      `pmctx_live_nothexadecimalXY_${"x".repeat(40)}`,
      `pmctx_live_${generated.keyId.slice(0, 12)}_${"x".repeat(40)}`,
    ];
    for (const raw of cases) {
      assert.equal(parseCredentialToken(raw), null, `expected null for ${JSON.stringify(raw)}`);
    }
  });
});

describe("credentialTokenMatches", () => {
  it("rejects a token whose secret was altered", () => {
    const generated = generateCredentialToken("PRODUCTION");
    const tampered = `${generated.rawToken.slice(0, -1)}${generated.rawToken.endsWith("A") ? "B" : "A"}`;
    assert.equal(credentialTokenMatches(generated.secretHash, tampered), false);
  });

  it("rejects a valid secret replayed under a different environment segment", () => {
    const generated = generateCredentialToken("PRODUCTION");
    const swapped = generated.rawToken.replace("pmctx_live_", "pmctx_test_");
    assert.equal(credentialTokenMatches(generated.secretHash, swapped), false);
  });

  it("rejects an empty stored hash rather than matching everything", () => {
    assert.equal(credentialTokenMatches("", "anything"), false);
  });
});

describe("extractBearerToken", () => {
  it("reads the token from a bearer header case-insensitively", () => {
    assert.equal(extractBearerToken("Bearer abc123"), "abc123");
    assert.equal(extractBearerToken("bearer abc123"), "abc123");
  });

  it("returns null for missing or non-bearer schemes", () => {
    assert.equal(extractBearerToken(null), null);
    assert.equal(extractBearerToken(""), null);
    assert.equal(extractBearerToken("Basic abc123"), null);
    assert.equal(extractBearerToken("Bearer"), null);
    assert.equal(extractBearerToken("Bearer a b"), null);
  });
});
