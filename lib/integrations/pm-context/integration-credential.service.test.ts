import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IntegrationCredential, PrismaClient } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import type { StaffContext } from "@/lib/services/staff-context";
import { credentialTokenMatches } from "./credential-token";
import {
  issueIntegrationCredential,
  listIntegrationCredentials,
  revokeIntegrationCredential,
} from "./integration-credential.service";

const ORG_A = "org_a";

function staffContext(overrides: Partial<StaffContext> = {}): StaffContext {
  return {
    userId: "user_admin",
    organizationId: ORG_A,
    organizationRole: "ADMIN",
    primaryRoleKey: "administrator",
    assignmentRolesByProperty: new Map(),
    ...overrides,
  };
}

function createMockPrisma(seed: IntegrationCredential[] = []) {
  const rows: IntegrationCredential[] = [...seed];
  const audits: Array<Record<string, unknown>> = [];

  const prisma = {
    rows,
    audits,
    integrationCredential: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `cred_${rows.length + 1}`,
          createdAt: new Date("2026-08-31T12:00:00.000Z"),
          updatedAt: new Date("2026-08-31T12:00:00.000Z"),
          lastUsedAt: null,
          revokedAt: null,
          revokedByUserId: null,
          ...data,
        } as IntegrationCredential;
        rows.push(row);
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; organizationId: string; revokedAt: null };
        data: { revokedAt: Date; revokedByUserId: string };
      }) => {
        let count = 0;
        for (const row of rows) {
          if (
            row.id === where.id &&
            row.organizationId === where.organizationId &&
            row.revokedAt === null
          ) {
            row.revokedAt = data.revokedAt;
            row.revokedByUserId = data.revokedByUserId;
            count += 1;
          }
        }
        return { count };
      },
      findFirst: async ({ where }: { where: { id: string; organizationId: string } }) =>
        rows.find((r) => r.id === where.id && r.organizationId === where.organizationId) ?? null,
      findMany: async ({ where }: { where: { organizationId: string } }) =>
        rows.filter((r) => r.organizationId === where.organizationId),
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        audits.push(data);
        return {};
      },
    },
  };

  return prisma;
}

describe("issueIntegrationCredential", () => {
  it("returns the raw token once and persists only its hash", async () => {
    const prisma = createMockPrisma();
    const result = await issueIntegrationCredential(
      prisma as unknown as PrismaClient,
      staffContext(),
      { app: "ROCKET_COMMUNICATOR", environment: "PRODUCTION", name: "Communicator prod" },
    );

    const stored = prisma.rows[0]!;
    assert.ok(result.rawToken.startsWith("pmctx_live_"));
    assert.ok(credentialTokenMatches(stored.secretHash, result.rawToken));

    // The raw token must be unrecoverable from anything persisted.
    const persisted = JSON.stringify(stored);
    assert.ok(!persisted.includes(result.rawToken));
    const secret = result.rawToken.split("_").slice(3).join("_");
    assert.ok(!persisted.includes(secret));

    // Nor may it appear in the summary handed back to callers or written to the audit log.
    assert.ok(!JSON.stringify(result.credential).includes(secret));
    assert.ok(!JSON.stringify(prisma.audits).includes(secret));
  });

  it("binds the credential to the admin's organization and defaults to the read scope", async () => {
    const prisma = createMockPrisma();
    const result = await issueIntegrationCredential(
      prisma as unknown as PrismaClient,
      staffContext(),
      { app: "ROCKET_COMMUNICATOR", environment: "PRODUCTION", name: "Communicator prod" },
    );

    assert.equal(result.credential.organizationId, ORG_A);
    assert.deepEqual(result.credential.scopes, ["PM_CONTEXT_READ"]);
    assert.equal(prisma.rows[0]?.createdByUserId, "user_admin");
  });

  it("keeps production and development credentials separable", async () => {
    const prisma = createMockPrisma();
    const dev = await issueIntegrationCredential(
      prisma as unknown as PrismaClient,
      staffContext(),
      { app: "ROCKET_COMMUNICATOR", environment: "DEVELOPMENT", name: "Communicator dev" },
    );
    assert.ok(dev.rawToken.startsWith("pmctx_test_"));
    assert.equal(dev.credential.environment, "DEVELOPMENT");
  });

  it("refuses non-admin members", async () => {
    const prisma = createMockPrisma();
    await assert.rejects(
      issueIntegrationCredential(
        prisma as unknown as PrismaClient,
        staffContext({ organizationRole: "MEMBER" }),
        { app: "ROCKET_COMMUNICATOR", environment: "PRODUCTION", name: "Nope" },
      ),
      ForbiddenError,
    );
    assert.equal(prisma.rows.length, 0);
  });

  it("rejects a blank name and a past expiry", async () => {
    const prisma = createMockPrisma();
    await assert.rejects(
      issueIntegrationCredential(prisma as unknown as PrismaClient, staffContext(), {
        app: "ROCKET_COMMUNICATOR",
        environment: "PRODUCTION",
        name: "   ",
      }),
      /name is required/,
    );
    await assert.rejects(
      issueIntegrationCredential(prisma as unknown as PrismaClient, staffContext(), {
        app: "ROCKET_COMMUNICATOR",
        environment: "PRODUCTION",
        name: "Expired",
        expiresAt: new Date("2020-01-01"),
      }),
      /must be in the future/,
    );
  });

  it("writes an audit row without secret material", async () => {
    const prisma = createMockPrisma();
    await issueIntegrationCredential(prisma as unknown as PrismaClient, staffContext(), {
      app: "ROCKET_COMMUNICATOR",
      environment: "PRODUCTION",
      name: "Communicator prod",
    });

    const audit = prisma.audits[0]!;
    assert.equal(audit.action, "integration.credential.created");
    assert.equal(audit.organizationId, ORG_A);
    assert.equal(audit.actorUserId, "user_admin");
    assert.ok(!JSON.stringify(audit).includes(prisma.rows[0]!.secretHash));
  });
});

describe("revokeIntegrationCredential", () => {
  it("revokes a credential in the caller's organization", async () => {
    const prisma = createMockPrisma();
    const issued = await issueIntegrationCredential(
      prisma as unknown as PrismaClient,
      staffContext(),
      { app: "ROCKET_COMMUNICATOR", environment: "PRODUCTION", name: "Communicator prod" },
    );

    const revoked = await revokeIntegrationCredential(
      prisma as unknown as PrismaClient,
      staffContext(),
      issued.credential.id,
    );

    assert.ok(revoked.revokedAt instanceof Date);
    assert.equal(prisma.rows[0]?.revokedByUserId, "user_admin");
    assert.ok(prisma.audits.some((a) => a.action === "integration.credential.revoked"));
  });

  it("cannot revoke another organization's credential", async () => {
    const prisma = createMockPrisma();
    const issued = await issueIntegrationCredential(
      prisma as unknown as PrismaClient,
      staffContext(),
      { app: "ROCKET_COMMUNICATOR", environment: "PRODUCTION", name: "Communicator prod" },
    );

    await assert.rejects(
      revokeIntegrationCredential(
        prisma as unknown as PrismaClient,
        staffContext({ organizationId: "org_b" }),
        issued.credential.id,
      ),
      NotFoundError,
    );
    assert.equal(prisma.rows[0]?.revokedAt, null);
  });

  it("is idempotent and does not re-audit an already revoked credential", async () => {
    const prisma = createMockPrisma();
    const issued = await issueIntegrationCredential(
      prisma as unknown as PrismaClient,
      staffContext(),
      { app: "ROCKET_COMMUNICATOR", environment: "PRODUCTION", name: "Communicator prod" },
    );

    await revokeIntegrationCredential(prisma as unknown as PrismaClient, staffContext(), issued.credential.id);
    const first = prisma.rows[0]!.revokedAt;
    await revokeIntegrationCredential(prisma as unknown as PrismaClient, staffContext(), issued.credential.id);

    assert.equal(prisma.rows[0]?.revokedAt, first);
    assert.equal(
      prisma.audits.filter((a) => a.action === "integration.credential.revoked").length,
      1,
    );
  });
});

describe("listIntegrationCredentials", () => {
  it("returns only the caller's organization and never the secret hash", async () => {
    const prisma = createMockPrisma();
    await issueIntegrationCredential(prisma as unknown as PrismaClient, staffContext(), {
      app: "ROCKET_COMMUNICATOR",
      environment: "PRODUCTION",
      name: "Communicator prod",
    });

    const rows = await listIntegrationCredentials(prisma as unknown as PrismaClient, staffContext());
    assert.equal(rows.length, 1);
    assert.ok(!("secretHash" in rows[0]!));

    const other = await listIntegrationCredentials(
      prisma as unknown as PrismaClient,
      staffContext({ organizationId: "org_b" }),
    );
    assert.deepEqual(other, []);
  });

  it("refuses non-admin members", async () => {
    const prisma = createMockPrisma();
    await assert.rejects(
      listIntegrationCredentials(
        prisma as unknown as PrismaClient,
        staffContext({ organizationRole: "MEMBER" }),
      ),
      ForbiddenError,
    );
  });
});
