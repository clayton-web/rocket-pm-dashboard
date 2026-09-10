#!/usr/bin/env npx tsx
/**
 * Issue, list, and revoke Rocket Communicator integration credentials.
 *
 * Runs the same admin-guarded service the application uses: it loads a real StaffContext for the
 * named administrator and requires org ADMIN/OWNER, so operating this script does not bypass the
 * authorization rules.
 *
 * Issue:
 *   ORGANIZATION_SLUG=axford \
 *   ADMIN_EMAIL=admin@example.com \
 *   CREDENTIAL_NAME="Rocket Communicator (production)" \
 *   CREDENTIAL_ENVIRONMENT=PRODUCTION \
 *   npx tsx scripts/integration-credential.ts issue
 *
 * List:
 *   ORGANIZATION_SLUG=axford ADMIN_EMAIL=admin@example.com \
 *   npx tsx scripts/integration-credential.ts list
 *
 * Revoke (takes effect on the next request):
 *   ORGANIZATION_SLUG=axford ADMIN_EMAIL=admin@example.com CREDENTIAL_ID=clx... \
 *   npx tsx scripts/integration-credential.ts revoke
 *
 * The raw token is printed once by `issue` and is never recoverable afterwards.
 */

import "dotenv/config";
import { PrismaClient, type IntegrationCredentialEnvironment } from "@prisma/client";
import {
  issueIntegrationCredential,
  listIntegrationCredentials,
  revokeIntegrationCredential,
} from "@/lib/integrations/pm-context/integration-credential.service";
import { loadStaffContext } from "@/lib/services/staff-context";

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseEnvironment(): IntegrationCredentialEnvironment {
  const raw = process.env.CREDENTIAL_ENVIRONMENT?.trim().toUpperCase() ?? "PRODUCTION";
  if (raw !== "PRODUCTION" && raw !== "DEVELOPMENT") {
    throw new Error("CREDENTIAL_ENVIRONMENT must be PRODUCTION or DEVELOPMENT.");
  }
  return raw;
}

async function loadAdminContext() {
  const organizationSlug = requireEnv("ORGANIZATION_SLUG");
  const adminEmail = requireEnv("ADMIN_EMAIL").toLowerCase();

  const organization = await prisma.organization.findUnique({ where: { slug: organizationSlug } });
  if (!organization) throw new Error(`Organization "${organizationSlug}" not found.`);

  const user = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!user) throw new Error(`User "${adminEmail}" not found.`);

  const ctx = await loadStaffContext(prisma, user.id, organization.id);
  if (!ctx) throw new Error(`"${adminEmail}" has no active membership in "${organizationSlug}".`);

  return ctx;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const ctx = await loadAdminContext();

  if (command === "issue") {
    const result = await issueIntegrationCredential(prisma, ctx, {
      app: "ROCKET_COMMUNICATOR",
      environment: parseEnvironment(),
      name: requireEnv("CREDENTIAL_NAME"),
    });

    console.log("Integration credential created.");
    console.log(`  id:          ${result.credential.id}`);
    console.log(`  keyId:       ${result.credential.keyId}`);
    console.log(`  environment: ${result.credential.environment}`);
    console.log(`  scopes:      ${result.credential.scopes.join(", ")}`);
    console.log("");
    console.log("Raw token (shown once — store it in the Rocket Communicator secret store now):");
    console.log(`  ${result.rawToken}`);
    return;
  }

  if (command === "list") {
    const rows = await listIntegrationCredentials(prisma, ctx);
    if (rows.length === 0) {
      console.log("No integration credentials for this organization.");
      return;
    }
    for (const row of rows) {
      const state = row.revokedAt ? `revoked ${row.revokedAt.toISOString()}` : "active";
      console.log(
        `${row.id}  ${row.environment.padEnd(11)}  ${state.padEnd(34)}  ${row.name} (keyId ${row.keyId})`,
      );
    }
    return;
  }

  if (command === "revoke") {
    const row = await revokeIntegrationCredential(prisma, ctx, requireEnv("CREDENTIAL_ID"));
    console.log(`Revoked ${row.id} at ${row.revokedAt?.toISOString()}.`);
    return;
  }

  throw new Error("Usage: npx tsx scripts/integration-credential.ts <issue|list|revoke>");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
