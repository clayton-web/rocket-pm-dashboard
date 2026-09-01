import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import type { IntegrationAuthFailureReason } from "@/lib/integrations/pm-context/authenticate-integration-request";
import type { ResolvedContext } from "@/lib/integrations/pm-context/resolve-context";
import type { IntegrationPrincipal } from "@/lib/integrations/pm-context/integration-principal";

/**
 * Audit for the Rocket Communicator context integration.
 *
 * Deliberately records identifiers and match reasons, never content. Nothing here writes the raw
 * credential, the request body, the sender email or phone, or any message text. The presence of a
 * lookup signal is recorded as a boolean/count so usage can be investigated without storing PII.
 */

type AuditMetadata = Prisma.InputJsonValue;

/** Narrow port so tests can capture audit writes without a database. `PrismaClient` satisfies it. */
type AuditDb = {
  auditLog: {
    create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown>;
  };
};

export type ContextResolveAuditSignals = {
  hasSenderEmail: boolean;
  addressHintCount: number;
  unitHintCount: number;
  hasKnownPropertyId: boolean;
  hasKnownUnitId: boolean;
  unsupportedSignals: string[];
};

function matchReasonCounts(result: ResolvedContext): Record<string, number> {
  const counts: Record<string, number> = {};
  const all = [
    ...result.contacts,
    ...result.properties,
    ...result.units,
    ...result.tenancies,
    ...result.ownerContactMatches,
  ];
  for (const candidate of all) {
    counts[candidate.matchReason] = (counts[candidate.matchReason] ?? 0) + 1;
  }
  return counts;
}

export async function auditContextResolved(
  args: {
    principal: IntegrationPrincipal;
    requestId: string;
    signals: ContextResolveAuditSignals;
    result: ResolvedContext;
  },
  db: AuditDb = prisma,
): Promise<void> {
  const { principal, result } = args;
  await db.auditLog.create({
    data: {
      organizationId: principal.organizationId,
      actorUserId: null,
      integrationCredentialId: principal.credentialId,
      action: "integration.pm_context.resolved",
      resourceType: "IntegrationCredential",
      resourceId: principal.credentialId,
      metadata: {
        requestId: args.requestId,
        app: principal.app,
        environment: principal.environment,
        signals: args.signals,
        counts: {
          contacts: result.contacts.length,
          properties: result.properties.length,
          units: result.units.length,
          tenancies: result.tenancies.length,
          ownerContactMatches: result.ownerContactMatches.length,
        },
        matchReasons: matchReasonCounts(result),
        matchedPropertyIds: result.properties.map((p) => p.id),
        matchedUnitIds: result.units.map((u) => u.id),
        matchedTenancyIds: result.tenancies.map((t) => t.id),
        propertyScanTruncated: result.diagnostics.propertyScanTruncated,
      } satisfies AuditMetadata,
    },
  });
}

export async function auditIntegrationAuthFailed(
  args: {
    reason: IntegrationAuthFailureReason;
    credentialId: string | null;
    organizationId: string | null;
    keyId: string | null;
    route: string;
  },
  db: AuditDb = prisma,
): Promise<void> {
  await db.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId: null,
      integrationCredentialId: args.credentialId,
      action: "integration.auth.failed",
      resourceType: "IntegrationCredential",
      resourceId: args.credentialId,
      metadata: {
        reason: args.reason,
        route: args.route,
        keyId: args.keyId,
      } satisfies AuditMetadata,
    },
  });
}

export async function auditIntegrationRateLimited(
  args: { credentialId: string; organizationId: string; route: string },
  db: AuditDb = prisma,
): Promise<void> {
  await db.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId: null,
      integrationCredentialId: args.credentialId,
      action: "integration.rate_limited",
      resourceType: "IntegrationCredential",
      resourceId: args.credentialId,
      metadata: { route: args.route } satisfies AuditMetadata,
    },
  });
}

export async function auditIntegrationCredentialCreated(
  args: {
    organizationId: string;
    actorUserId: string;
    credentialId: string;
    app: string;
    environment: string;
    scopes: string[];
    expiresAt: Date | null;
  },
  db: AuditDb = prisma,
): Promise<void> {
  await db.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId: args.actorUserId,
      integrationCredentialId: args.credentialId,
      action: "integration.credential.created",
      resourceType: "IntegrationCredential",
      resourceId: args.credentialId,
      metadata: {
        app: args.app,
        environment: args.environment,
        scopes: args.scopes,
        expiresAt: args.expiresAt?.toISOString() ?? null,
      } satisfies AuditMetadata,
    },
  });
}

export async function auditIntegrationCredentialRevoked(
  args: { organizationId: string; actorUserId: string; credentialId: string },
  db: AuditDb = prisma,
): Promise<void> {
  await db.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId: args.actorUserId,
      integrationCredentialId: args.credentialId,
      action: "integration.credential.revoked",
      resourceType: "IntegrationCredential",
      resourceId: args.credentialId,
    },
  });
}
