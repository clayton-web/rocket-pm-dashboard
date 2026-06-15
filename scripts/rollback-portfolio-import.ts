#!/usr/bin/env npx tsx
/**
 * Roll back a portfolio CSV import using an import manifest.
 *
 * Deletes in FK-safe order:
 * 1. TenancyContact
 * 2. Tenancy
 * 3. Application
 * 4. Unit (only if importCreated)
 * 5. Property (only if importCreated)
 *
 * Usage:
 *   ALLOW_PORTFOLIO_ROLLBACK=true \
 *   IMPORT_MANIFEST_PATH=./import-manifest-1234567890.json \
 *   DRY_RUN=true \
 *   npx tsx scripts/rollback-portfolio-import.ts
 */

import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import type { PortfolioImportManifest } from "@/lib/portfolio/import-manifest";

const prisma = new PrismaClient();

function requireRollbackEnv(): { manifestPath: string; dryRun: boolean } {
  if (process.env.ALLOW_PORTFOLIO_ROLLBACK !== "true") {
    throw new Error(
      "Refusing to run rollback. Set ALLOW_PORTFOLIO_ROLLBACK=true to confirm this is intentional.",
    );
  }

  const manifestPath = process.env.IMPORT_MANIFEST_PATH?.trim();
  if (!manifestPath) {
    throw new Error("IMPORT_MANIFEST_PATH is required.");
  }

  const dryRun = process.env.DRY_RUN === "true";
  return { manifestPath, dryRun };
}

async function loadManifest(manifestPath: string): Promise<PortfolioImportManifest> {
  const content = await readFile(manifestPath, "utf8");
  const parsed = JSON.parse(content) as PortfolioImportManifest;

  if (!parsed.organizationId || !Array.isArray(parsed.tenancyContacts)) {
    throw new Error("Manifest file is missing required portfolio import fields.");
  }

  if (parsed.dryRun) {
    throw new Error("Manifest is from a dry run and cannot be rolled back.");
  }

  return parsed;
}

async function main(): Promise<void> {
  const env = requireRollbackEnv();
  const manifestAbsolutePath = path.resolve(env.manifestPath);
  const manifest = await loadManifest(manifestAbsolutePath);

  const contactIds = manifest.tenancyContacts.map((entry) => entry.id);
  const tenancyIds = manifest.tenancies.map((entry) => entry.id);
  const applicationIds = manifest.applications.map((entry) => entry.id);
  const unitIds = manifest.units.filter((entry) => entry.importCreated).map((entry) => entry.id);
  const propertyIds = manifest.properties
    .filter((entry) => entry.importCreated)
    .map((entry) => entry.id);

  console.log(`${env.dryRun ? "DRY RUN — " : ""}Portfolio import rollback`);
  console.log(`Manifest: ${manifestAbsolutePath}`);
  console.log(`Organization: ${manifest.organizationSlug} (${manifest.organizationId})`);
  console.log(`Imported at: ${manifest.importedAt}`);
  console.log("");
  console.log(`Tenancy contacts to delete: ${contactIds.length}`);
  console.log(`Tenancies to delete: ${tenancyIds.length}`);
  console.log(`Applications to delete: ${applicationIds.length}`);
  console.log(`Import-created units to delete: ${unitIds.length}`);
  console.log(`Import-created properties to delete: ${propertyIds.length}`);
  console.log("");

  if (env.dryRun) {
    console.log("Dry run complete — no database deletes performed.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (contactIds.length > 0) {
      await tx.tenancyContact.deleteMany({ where: { id: { in: contactIds } } });
    }

    if (tenancyIds.length > 0) {
      await tx.tenancy.deleteMany({ where: { id: { in: tenancyIds } } });
    }

    if (applicationIds.length > 0) {
      await tx.application.deleteMany({ where: { id: { in: applicationIds } } });
    }

    for (const unitId of unitIds) {
      const otherTenancies = await tx.tenancy.count({
        where: { unitId, id: { notIn: tenancyIds } },
      });
      if (otherTenancies > 0) {
        throw new Error(
          `Refusing to delete import-created unit ${unitId}; other tenancies still reference it.`,
        );
      }
      await tx.unit.delete({ where: { id: unitId } });
    }

    for (const propertyId of propertyIds) {
      const otherUnits = await tx.unit.count({
        where: { propertyId, id: { notIn: unitIds } },
      });
      if (otherUnits > 0) {
        throw new Error(
          `Refusing to delete import-created property ${propertyId}; other units still exist.`,
        );
      }
      await tx.property.delete({ where: { id: propertyId } });
    }
  });

  console.log("Rollback complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
