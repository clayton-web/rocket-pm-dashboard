import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTE_LENGTH = 32;

export function hashLeaseSigningToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function generateLeaseSigningToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTE_LENGTH).toString("base64url");
  return { token, tokenHash: hashLeaseSigningToken(token) };
}

export function isValidLeaseSigningTokenFormat(token: string): boolean {
  const trimmed = token.trim();
  if (trimmed.length < 16) return false;
  return /^[A-Za-z0-9_-]+$/.test(trimmed);
}

export function tokensMatch(storedHash: string, providedToken: string): boolean {
  const providedHash = hashLeaseSigningToken(providedToken);
  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(providedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Default tenant signing link validity after send. */
export const LEASE_SIGNING_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function leaseSigningTokenExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + LEASE_SIGNING_TOKEN_TTL_MS);
}
