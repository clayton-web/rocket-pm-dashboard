import type {
  IntegrationApp,
  IntegrationCredentialEnvironment,
  IntegrationCredentialScope,
  PrismaClient,
} from "@prisma/client";
import {
  credentialTokenMatches,
  extractBearerToken,
  parseCredentialToken,
  type ParsedCredentialToken,
} from "@/lib/integrations/pm-context/credential-token";
import type { IntegrationPrincipal } from "@/lib/integrations/pm-context/integration-principal";

/** Optional caller assertion, checked against the credential. Never used to *select* an org. */
export const ORGANIZATION_ASSERTION_HEADER = "x-pm-organization-id";

/** Skip the `lastUsedAt` write when the credential was already seen this recently. */
export const LAST_USED_THROTTLE_MS = 60_000;

/**
 * Failure reasons are for audit logs and server-side diagnostics only. The HTTP response
 * collapses all of them to a single generic 401/403 so a caller cannot probe credential state.
 */
export type IntegrationAuthFailureReason =
  | "missing_credentials"
  | "malformed_token"
  | "unknown_credential"
  | "invalid_secret"
  | "environment_mismatch"
  | "revoked"
  | "expired"
  | "missing_scope"
  | "organization_mismatch";

/** Minimal credential shape the evaluator needs; keeps the pure logic free of Prisma types. */
export type AuthenticatableCredential = {
  id: string;
  organizationId: string;
  app: IntegrationApp;
  environment: IntegrationCredentialEnvironment;
  keyId: string;
  secretHash: string;
  scopes: IntegrationCredentialScope[];
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
};

export const AUTHENTICATABLE_CREDENTIAL_SELECT = {
  id: true,
  organizationId: true,
  app: true,
  environment: true,
  keyId: true,
  secretHash: true,
  scopes: true,
  expiresAt: true,
  revokedAt: true,
  lastUsedAt: true,
} as const;

export type IntegrationAuthResult =
  | { ok: true; principal: IntegrationPrincipal; shouldTouchLastUsed: boolean }
  | {
      ok: false;
      reason: IntegrationAuthFailureReason;
      /** Populated only once the secret has been verified, so audit rows cannot be forged. */
      credentialId: string | null;
      organizationId: string | null;
      keyId: string | null;
    };

function failure(
  reason: IntegrationAuthFailureReason,
  identified?: { credentialId: string; organizationId: string; keyId: string },
): IntegrationAuthResult {
  return {
    ok: false,
    reason,
    credentialId: identified?.credentialId ?? null,
    organizationId: identified?.organizationId ?? null,
    keyId: identified?.keyId ?? null,
  };
}

/**
 * Pure credential evaluation.
 *
 * Check order is deliberate: the secret hash is verified before revocation, expiry, and scope so
 * that an attacker holding only a key id cannot learn whether a credential exists, is revoked, or
 * carries a given scope. Everything before a successful hash comparison reports an anonymous
 * failure with no credential identity attached.
 */
export function evaluateIntegrationCredential(args: {
  rawToken: string;
  parsed: ParsedCredentialToken;
  credential: AuthenticatableCredential | null;
  requiredScope: IntegrationCredentialScope;
  assertedOrganizationId: string | null;
  now: Date;
}): IntegrationAuthResult {
  const { rawToken, parsed, credential, requiredScope, assertedOrganizationId, now } = args;

  if (!credential) {
    return failure("unknown_credential");
  }
  if (!credentialTokenMatches(credential.secretHash, rawToken)) {
    return failure("invalid_secret");
  }

  const identified = {
    credentialId: credential.id,
    organizationId: credential.organizationId,
    keyId: credential.keyId,
  };

  if (credential.environment !== parsed.environment) {
    return failure("environment_mismatch", identified);
  }
  if (credential.revokedAt !== null) {
    return failure("revoked", identified);
  }
  if (credential.expiresAt !== null && credential.expiresAt.getTime() <= now.getTime()) {
    return failure("expired", identified);
  }
  if (!credential.scopes.includes(requiredScope)) {
    return failure("missing_scope", identified);
  }
  if (assertedOrganizationId !== null && assertedOrganizationId !== credential.organizationId) {
    return failure("organization_mismatch", identified);
  }

  const shouldTouchLastUsed =
    credential.lastUsedAt === null ||
    now.getTime() - credential.lastUsedAt.getTime() >= LAST_USED_THROTTLE_MS;

  return {
    ok: true,
    shouldTouchLastUsed,
    principal: {
      credentialId: credential.id,
      organizationId: credential.organizationId,
      app: credential.app,
      environment: credential.environment,
      scopes: credential.scopes,
    },
  };
}

type CredentialLookupDb = {
  integrationCredential: {
    findUnique: (args: {
      where: { keyId: string };
      select: typeof AUTHENTICATABLE_CREDENTIAL_SELECT;
    }) => Promise<AuthenticatableCredential | null>;
    update: (args: {
      where: { id: string };
      data: { lastUsedAt: Date };
    }) => Promise<unknown>;
  };
};

/**
 * Authenticates a server-to-server request from its `Authorization: Bearer` header.
 *
 * Reads the organization from the credential row only. An `X-PM-Organization-Id` header, when
 * present, is treated purely as a caller assertion and a mismatch fails closed.
 */
export async function authenticateIntegrationRequest(
  prisma: PrismaClient | CredentialLookupDb,
  request: Request,
  options: { requiredScope: IntegrationCredentialScope; now?: Date },
): Promise<IntegrationAuthResult> {
  const now = options.now ?? new Date();

  const rawToken = extractBearerToken(request.headers.get("authorization"));
  if (!rawToken) {
    return failure("missing_credentials");
  }

  const parsed = parseCredentialToken(rawToken);
  if (!parsed) {
    return failure("malformed_token");
  }

  const db = prisma as CredentialLookupDb;
  const credential = await db.integrationCredential.findUnique({
    where: { keyId: parsed.keyId },
    select: AUTHENTICATABLE_CREDENTIAL_SELECT,
  });

  const assertedOrganizationId =
    request.headers.get(ORGANIZATION_ASSERTION_HEADER)?.trim() || null;

  const result = evaluateIntegrationCredential({
    rawToken,
    parsed,
    credential,
    requiredScope: options.requiredScope,
    assertedOrganizationId,
    now,
  });

  if (result.ok && result.shouldTouchLastUsed) {
    await db.integrationCredential
      .update({ where: { id: result.principal.credentialId }, data: { lastUsedAt: now } })
      .catch(() => undefined);
  }

  return result;
}
