import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authenticateIntegrationRequest,
  evaluateIntegrationCredential,
  LAST_USED_THROTTLE_MS,
  ORGANIZATION_ASSERTION_HEADER,
  type AuthenticatableCredential,
} from "./authenticate-integration-request";
import { generateCredentialToken, parseCredentialToken } from "./credential-token";

const ORG_A = "org_a";
const NOW = new Date("2026-08-31T12:00:00.000Z");

function credentialFor(
  rawToken: string,
  secretHash: string,
  keyId: string,
  overrides: Partial<AuthenticatableCredential> = {},
): AuthenticatableCredential {
  void rawToken;
  return {
    id: "cred_a",
    organizationId: ORG_A,
    app: "ROCKET_COMMUNICATOR",
    environment: "PRODUCTION",
    keyId,
    secretHash,
    scopes: ["PM_CONTEXT_READ"],
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
    ...overrides,
  };
}

function evaluate(
  rawToken: string,
  credential: AuthenticatableCredential | null,
  options: { assertedOrganizationId?: string | null; now?: Date } = {},
) {
  const parsed = parseCredentialToken(rawToken);
  assert.ok(parsed, "token should parse");
  return evaluateIntegrationCredential({
    rawToken,
    parsed,
    credential,
    requiredScope: "PM_CONTEXT_READ",
    assertedOrganizationId: options.assertedOrganizationId ?? null,
    now: options.now ?? NOW,
  });
}

describe("evaluateIntegrationCredential", () => {
  it("accepts a valid active credential and derives the principal from the row", () => {
    const token = generateCredentialToken("PRODUCTION");
    const result = evaluate(token.rawToken, credentialFor(token.rawToken, token.secretHash, token.keyId));

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.principal, {
      credentialId: "cred_a",
      organizationId: ORG_A,
      app: "ROCKET_COMMUNICATOR",
      environment: "PRODUCTION",
      scopes: ["PM_CONTEXT_READ"],
    });
  });

  it("fails when the key id is unknown", () => {
    const token = generateCredentialToken("PRODUCTION");
    const result = evaluate(token.rawToken, null);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "unknown_credential");
  });

  it("fails when the secret does not match the stored hash", () => {
    const token = generateCredentialToken("PRODUCTION");
    const other = generateCredentialToken("PRODUCTION");
    const result = evaluate(token.rawToken, credentialFor(token.rawToken, other.secretHash, token.keyId));

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "invalid_secret");
  });

  it("does not reveal credential identity before the secret is verified", () => {
    const token = generateCredentialToken("PRODUCTION");
    const other = generateCredentialToken("PRODUCTION");
    const result = evaluate(
      token.rawToken,
      credentialFor(token.rawToken, other.secretHash, token.keyId, { revokedAt: NOW }),
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    // A wrong secret must not let a caller learn the credential exists or that it was revoked.
    assert.equal(result.reason, "invalid_secret");
    assert.equal(result.credentialId, null);
    assert.equal(result.organizationId, null);
    assert.equal(result.keyId, null);
  });

  it("fails a revoked credential", () => {
    const token = generateCredentialToken("PRODUCTION");
    const result = evaluate(
      token.rawToken,
      credentialFor(token.rawToken, token.secretHash, token.keyId, {
        revokedAt: new Date("2026-08-30T00:00:00.000Z"),
      }),
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "revoked");
    assert.equal(result.credentialId, "cred_a");
  });

  it("fails an expired credential and accepts one that has not expired yet", () => {
    const token = generateCredentialToken("PRODUCTION");

    const expired = evaluate(
      token.rawToken,
      credentialFor(token.rawToken, token.secretHash, token.keyId, {
        expiresAt: new Date(NOW.getTime() - 1),
      }),
    );
    assert.equal(expired.ok, false);
    if (!expired.ok) assert.equal(expired.reason, "expired");

    const atBoundary = evaluate(
      token.rawToken,
      credentialFor(token.rawToken, token.secretHash, token.keyId, { expiresAt: NOW }),
    );
    assert.equal(atBoundary.ok, false, "expiry is inclusive — expiresAt === now is expired");

    const live = evaluate(
      token.rawToken,
      credentialFor(token.rawToken, token.secretHash, token.keyId, {
        expiresAt: new Date(NOW.getTime() + 1000),
      }),
    );
    assert.equal(live.ok, true);
  });

  it("fails when the credential lacks the required scope", () => {
    const token = generateCredentialToken("PRODUCTION");
    const result = evaluate(
      token.rawToken,
      credentialFor(token.rawToken, token.secretHash, token.keyId, { scopes: [] }),
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "missing_scope");
  });

  it("fails closed when an asserted organization header disagrees with the credential", () => {
    const token = generateCredentialToken("PRODUCTION");
    const result = evaluate(
      token.rawToken,
      credentialFor(token.rawToken, token.secretHash, token.keyId),
      { assertedOrganizationId: "org_b" },
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "organization_mismatch");
  });

  it("accepts a matching organization assertion", () => {
    const token = generateCredentialToken("PRODUCTION");
    const result = evaluate(
      token.rawToken,
      credentialFor(token.rawToken, token.secretHash, token.keyId),
      { assertedOrganizationId: ORG_A },
    );
    assert.equal(result.ok, true);
  });

  it("fails when the token environment disagrees with the stored environment", () => {
    const token = generateCredentialToken("PRODUCTION");
    const result = evaluate(
      token.rawToken,
      credentialFor(token.rawToken, token.secretHash, token.keyId, { environment: "DEVELOPMENT" }),
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "environment_mismatch");
  });

  it("throttles the lastUsedAt write", () => {
    const token = generateCredentialToken("PRODUCTION");

    const recent = evaluate(
      token.rawToken,
      credentialFor(token.rawToken, token.secretHash, token.keyId, {
        lastUsedAt: new Date(NOW.getTime() - 1000),
      }),
    );
    assert.equal(recent.ok && recent.shouldTouchLastUsed, false);

    const stale = evaluate(
      token.rawToken,
      credentialFor(token.rawToken, token.secretHash, token.keyId, {
        lastUsedAt: new Date(NOW.getTime() - LAST_USED_THROTTLE_MS),
      }),
    );
    assert.equal(stale.ok && stale.shouldTouchLastUsed, true);
  });
});

function mockDb(credential: AuthenticatableCredential | null) {
  const updates: Array<{ id: string; lastUsedAt: Date }> = [];
  const lookups: string[] = [];
  return {
    updates,
    lookups,
    integrationCredential: {
      findUnique: async ({ where }: { where: { keyId: string } }) => {
        lookups.push(where.keyId);
        return credential && credential.keyId === where.keyId ? credential : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: { lastUsedAt: Date } }) => {
        updates.push({ id: where.id, lastUsedAt: data.lastUsedAt });
        return {};
      },
    },
  };
}

function requestWith(headers: Record<string, string>): Request {
  return new Request("https://pm.example.com/api/integrations/v1/context/resolve", {
    method: "POST",
    headers,
  });
}

describe("authenticateIntegrationRequest", () => {
  it("rejects a request with no Authorization header without touching the database", async () => {
    const db = mockDb(null);
    const result = await authenticateIntegrationRequest(db, requestWith({}), {
      requiredScope: "PM_CONTEXT_READ",
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "missing_credentials");
    assert.equal(db.lookups.length, 0);
  });

  it("rejects a structurally invalid token without a database lookup", async () => {
    const db = mockDb(null);
    const result = await authenticateIntegrationRequest(
      db,
      requestWith({ authorization: "Bearer garbage" }),
      { requiredScope: "PM_CONTEXT_READ" },
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "malformed_token");
    assert.equal(db.lookups.length, 0);
  });

  it("authenticates a valid credential and records last use", async () => {
    const token = generateCredentialToken("PRODUCTION");
    const db = mockDb(credentialFor(token.rawToken, token.secretHash, token.keyId));

    const result = await authenticateIntegrationRequest(
      db,
      requestWith({ authorization: `Bearer ${token.rawToken}` }),
      { requiredScope: "PM_CONTEXT_READ", now: NOW },
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.principal.organizationId, ORG_A);
    assert.deepEqual(db.updates, [{ id: "cred_a", lastUsedAt: NOW }]);
  });

  it("skips the last-use write when the credential was seen moments ago", async () => {
    const token = generateCredentialToken("PRODUCTION");
    const db = mockDb(
      credentialFor(token.rawToken, token.secretHash, token.keyId, {
        lastUsedAt: new Date(NOW.getTime() - 5_000),
      }),
    );

    await authenticateIntegrationRequest(
      db,
      requestWith({ authorization: `Bearer ${token.rawToken}` }),
      { requiredScope: "PM_CONTEXT_READ", now: NOW },
    );

    assert.equal(db.updates.length, 0);
  });

  it("fails closed on an organization header that disagrees with the credential", async () => {
    const token = generateCredentialToken("PRODUCTION");
    const db = mockDb(credentialFor(token.rawToken, token.secretHash, token.keyId));

    const result = await authenticateIntegrationRequest(
      db,
      requestWith({
        authorization: `Bearer ${token.rawToken}`,
        [ORGANIZATION_ASSERTION_HEADER]: "org_b",
      }),
      { requiredScope: "PM_CONTEXT_READ", now: NOW },
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "organization_mismatch");
    assert.equal(db.updates.length, 0, "a rejected request must not update last use");
  });
});
