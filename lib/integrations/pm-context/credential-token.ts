import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { IntegrationCredentialEnvironment } from "@prisma/client";

/**
 * Raw credential token format: `pmctx_<env>_<keyId>_<secret>`.
 *
 * `keyId` is a public lookup handle stored in `IntegrationCredential.keyId`; `secret` is the
 * only confidential part. The persisted `secretHash` is SHA-256 of the *entire* raw token, so a
 * token cannot be replayed against a different environment or key id.
 *
 * `keyId` is hex so it never contains the `_` separator; the secret is base64url and may, so the
 * parser treats everything after the third separator as the secret.
 *
 * The raw token is returned once at issuance and is never stored, logged, or recoverable.
 */
export const TOKEN_PREFIX = "pmctx";

const KEY_ID_BYTE_LENGTH = 12;
const SECRET_BYTE_LENGTH = 32;

const ENVIRONMENT_SEGMENT: Record<IntegrationCredentialEnvironment, string> = {
  PRODUCTION: "live",
  DEVELOPMENT: "test",
};

const SEGMENT_ENVIRONMENT: Record<string, IntegrationCredentialEnvironment> = {
  live: "PRODUCTION",
  test: "DEVELOPMENT",
};

export type ParsedCredentialToken = {
  environment: IntegrationCredentialEnvironment;
  keyId: string;
};

export type GeneratedCredentialToken = {
  /** Show once to the operator, then discard. Never persist this. */
  rawToken: string;
  keyId: string;
  secretHash: string;
};

export function hashCredentialToken(rawToken: string): string {
  return createHash("sha256").update(rawToken.trim()).digest("hex");
}

export function generateCredentialToken(
  environment: IntegrationCredentialEnvironment,
): GeneratedCredentialToken {
  const keyId = randomBytes(KEY_ID_BYTE_LENGTH).toString("hex");
  const secret = randomBytes(SECRET_BYTE_LENGTH).toString("base64url");
  const rawToken = `${TOKEN_PREFIX}_${ENVIRONMENT_SEGMENT[environment]}_${keyId}_${secret}`;
  return { rawToken, keyId, secretHash: hashCredentialToken(rawToken) };
}

/**
 * Structural parse only — proves nothing about validity. Callers must still look up the key id
 * and verify the hash with {@link credentialTokenMatches}.
 */
export function parseCredentialToken(rawToken: string): ParsedCredentialToken | null {
  const trimmed = rawToken.trim();
  if (!trimmed) return null;

  const parts = trimmed.split("_");
  if (parts.length < 4) return null;

  const [prefix, envSegment, keyId] = parts;
  // The secret is base64url and may itself contain `_`, so it is the remainder, not one segment.
  const secret = parts.slice(3).join("_");

  if (prefix !== TOKEN_PREFIX) return null;

  const environment = SEGMENT_ENVIRONMENT[envSegment ?? ""];
  if (!environment) return null;

  if (!keyId || !secret) return null;
  if (!/^[0-9a-f]{24}$/.test(keyId)) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(secret)) return null;
  if (secret.length < 32) return null;

  return { environment, keyId };
}

export function credentialTokenMatches(storedHash: string, rawToken: string): boolean {
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashCredentialToken(rawToken), "hex");
  if (expected.length === 0 || expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/** Safe-to-log identifier for a credential: environment + key id, never the secret. */
export function credentialTokenDisplayHint(
  environment: IntegrationCredentialEnvironment,
  keyId: string,
): string {
  return `${TOKEN_PREFIX}_${ENVIRONMENT_SEGMENT[environment]}_${keyId}`;
}

/** Extracts the bearer token from an Authorization header without leaking it into errors. */
export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}
