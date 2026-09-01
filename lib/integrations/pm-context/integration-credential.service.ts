import type {
  IntegrationApp,
  IntegrationCredential,
  IntegrationCredentialEnvironment,
  IntegrationCredentialScope,
  PrismaClient,
} from "@prisma/client";
import {
  auditIntegrationCredentialCreated,
  auditIntegrationCredentialRevoked,
} from "@/lib/integrations/pm-context/integration-audit";
import { generateCredentialToken } from "@/lib/integrations/pm-context/credential-token";
import { NotFoundError } from "@/lib/services/errors";
import { requireOrganizationAdmin } from "@/lib/services/property-access";
import type { StaffContext } from "@/lib/services/staff-context";

/** Only scope available in this phase. Read-only PM context; no maintenance or write scopes. */
export const DEFAULT_INTEGRATION_SCOPES: IntegrationCredentialScope[] = ["PM_CONTEXT_READ"];

export type IssueIntegrationCredentialInput = {
  app: IntegrationApp;
  environment: IntegrationCredentialEnvironment;
  name: string;
  scopes?: IntegrationCredentialScope[];
  expiresAt?: Date | null;
};

export type IssuedIntegrationCredential = {
  credential: IntegrationCredentialSummary;
  /**
   * The only time the raw token is ever available. It is not stored and cannot be recovered —
   * a lost token requires revoking and issuing a new credential.
   */
  rawToken: string;
};

/** Safe-to-display projection. Contains no secret material. */
export type IntegrationCredentialSummary = {
  id: string;
  organizationId: string;
  app: IntegrationApp;
  environment: IntegrationCredentialEnvironment;
  name: string;
  keyId: string;
  scopes: IntegrationCredentialScope[];
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
};

function toSummary(row: IntegrationCredential): IntegrationCredentialSummary {
  return {
    id: row.id,
    organizationId: row.organizationId,
    app: row.app,
    environment: row.environment,
    name: row.name,
    keyId: row.keyId,
    scopes: row.scopes,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };
}

/**
 * Issues a credential bound to the caller's active organization.
 *
 * Organization admins and owners only. The organization is taken from the admin's
 * {@link StaffContext} — there is no parameter to issue a credential for a different one.
 */
export async function issueIntegrationCredential(
  prisma: PrismaClient,
  principal: StaffContext,
  input: IssueIntegrationCredentialInput,
): Promise<IssuedIntegrationCredential> {
  requireOrganizationAdmin(principal);

  const name = input.name.trim();
  if (!name) throw new Error("Credential name is required");
  if (name.length > 120) throw new Error("Credential name is too long");

  const scopes = input.scopes?.length ? input.scopes : DEFAULT_INTEGRATION_SCOPES;
  if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) {
    throw new Error("expiresAt must be in the future");
  }

  const { rawToken, keyId, secretHash } = generateCredentialToken(input.environment);

  const row = await prisma.integrationCredential.create({
    data: {
      organizationId: principal.organizationId,
      app: input.app,
      environment: input.environment,
      name,
      keyId,
      secretHash,
      scopes,
      createdByUserId: principal.userId,
      expiresAt: input.expiresAt ?? null,
    },
  });

  await auditIntegrationCredentialCreated(
    {
      organizationId: principal.organizationId,
      actorUserId: principal.userId,
      credentialId: row.id,
      app: row.app,
      environment: row.environment,
      scopes,
      expiresAt: row.expiresAt,
    },
    prisma,
  );

  return { credential: toSummary(row), rawToken };
}

/**
 * Revokes immediately. Authentication reads `revokedAt` on every request with no caching, so the
 * next call after this returns fails closed.
 */
export async function revokeIntegrationCredential(
  prisma: PrismaClient,
  principal: StaffContext,
  credentialId: string,
): Promise<IntegrationCredentialSummary> {
  requireOrganizationAdmin(principal);

  // Organization-constrained update: a credential in another organization is simply not found.
  const updated = await prisma.integrationCredential.updateMany({
    where: {
      id: credentialId,
      organizationId: principal.organizationId,
      revokedAt: null,
    },
    data: { revokedAt: new Date(), revokedByUserId: principal.userId },
  });

  const row = await prisma.integrationCredential.findFirst({
    where: { id: credentialId, organizationId: principal.organizationId },
  });
  if (!row) throw new NotFoundError("Integration credential not found");

  if (updated.count > 0) {
    await auditIntegrationCredentialRevoked(
      {
        organizationId: principal.organizationId,
        actorUserId: principal.userId,
        credentialId: row.id,
      },
      prisma,
    );
  }

  return toSummary(row);
}

export async function listIntegrationCredentials(
  prisma: PrismaClient,
  principal: StaffContext,
): Promise<IntegrationCredentialSummary[]> {
  requireOrganizationAdmin(principal);
  const rows = await prisma.integrationCredential.findMany({
    where: { organizationId: principal.organizationId },
    // Active credentials first: `revokedAt` is null while active, and Postgres sorts nulls last.
    orderBy: [{ revokedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
  });
  return rows.map(toSummary);
}
