#!/usr/bin/env npx tsx
/**
 * One-time portfolio CSV import for Rocket PM.
 *
 * CSV columns:
 * - Property Address
 * - Tenant Name
 * - Tenant Email
 * - Tenant Phone
 * - Owner Email
 * - Owner Phone
 * - Strata Information
 *
 * Usage:
 *   ALLOW_PORTFOLIO_IMPORT=true \
 *   ORGANIZATION_SLUG=axford \
 *   IMPORT_CSV_PATH=./portfolio.csv \
 *   DRY_RUN=true \
 *   npx tsx scripts/import-portfolio-csv.ts
 *
 * On a successful non-dry run, writes import-manifest-{timestamp}.json in cwd.
 */

import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { ENTIRE_PROPERTY_UNIT_NUMBER } from "@/lib/property/entire-property-unit";
import {
  propertyImportDedupKey,
  type ParsedBcPropertyAddress,
} from "@/lib/property/parse-bc-address";
import { normalizeCsvHeader, parseCsv } from "@/lib/portfolio/csv";
import {
  createEmptyManifest,
  finalizeManifestSummary,
  type PortfolioImportManifest,
} from "@/lib/portfolio/import-manifest";
import {
  mapCsvRecord,
  portfolioImportPlaceholderDate,
  PORTFOLIO_CSV_COLUMNS,
  validatePortfolioRow,
  type ValidatedPortfolioRow,
} from "@/lib/portfolio/import-row";

const prisma = new PrismaClient();

type ImportEnv = {
  organizationSlug: string;
  csvPath: string;
  dryRun: boolean;
};

function requireImportEnv(): ImportEnv {
  if (process.env.ALLOW_PORTFOLIO_IMPORT !== "true") {
    throw new Error(
      "Refusing to run import. Set ALLOW_PORTFOLIO_IMPORT=true to confirm this is intentional.",
    );
  }

  const organizationSlug = process.env.ORGANIZATION_SLUG?.trim();
  if (!organizationSlug) {
    throw new Error("ORGANIZATION_SLUG is required.");
  }

  const csvPath = process.env.IMPORT_CSV_PATH?.trim();
  if (!csvPath) {
    throw new Error("IMPORT_CSV_PATH is required.");
  }

  const dryRun = process.env.DRY_RUN === "true";
  return { organizationSlug, csvPath, dryRun };
}

function recordsFromCsv(content: string): Record<string, string>[] {
  const rows = parseCsv(content);
  if (rows.length === 0) {
    throw new Error("CSV file is empty.");
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((cell) => normalizeCsvHeader(cell));
  const requiredHeaders = Object.values(PORTFOLIO_CSV_COLUMNS);
  const missing = requiredHeaders.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    throw new Error(`CSV is missing required columns: ${missing.join(", ")}`);
  }

  return dataRows.map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = cells[index]?.trim() ?? "";
    });
    return record;
  });
}

type ExistingPropertyIndex = Map<
  string,
  {
    id: string;
    ownerEmail: string | null;
    ownerPhone: string | null;
    strataNotes: string | null;
  }
>;

async function loadExistingPropertyIndex(
  organizationId: string,
): Promise<ExistingPropertyIndex> {
  const properties = await prisma.property.findMany({
    where: { organizationId },
    select: {
      id: true,
      streetLine1: true,
      postalCode: true,
      ownerEmail: true,
      ownerPhone: true,
      strataNotes: true,
    },
  });

  const index: ExistingPropertyIndex = new Map();
  for (const property of properties) {
    const key = propertyImportDedupKey(property.streetLine1, property.postalCode);
    index.set(key, {
      id: property.id,
      ownerEmail: property.ownerEmail,
      ownerPhone: property.ownerPhone,
      strataNotes: property.strataNotes,
    });
  }
  return index;
}

async function findDefaultUnit(propertyId: string) {
  return prisma.unit.findFirst({
    where: { propertyId, unitNumber: ENTIRE_PROPERTY_UNIT_NUMBER },
    select: { id: true },
  });
}

async function findExistingActiveTenancyForTenant(
  propertyId: string,
  unitId: string,
  tenantEmail: string,
): Promise<{ tenancyId: string; contactId: string } | null> {
  const contact = await prisma.tenancyContact.findFirst({
    where: {
      email: tenantEmail,
      tenancy: {
        propertyId,
        unitId,
        status: "active",
      },
    },
    select: { id: true, tenancyId: true },
  });
  if (!contact) return null;
  return { tenancyId: contact.tenancyId, contactId: contact.id };
}

function ownerStrataChanged(
  existing: {
    ownerEmail: string | null;
    ownerPhone: string | null;
    strataNotes: string | null;
  },
  next: Pick<ValidatedPortfolioRow, "ownerEmail" | "ownerPhone" | "strataNotes">,
): boolean {
  return (
    (next.ownerEmail ?? null) !== existing.ownerEmail ||
    (next.ownerPhone ?? null) !== existing.ownerPhone ||
    (next.strataNotes ?? null) !== existing.strataNotes
  );
}

async function ensurePropertyAndUnit(args: {
  organizationId: string;
  validated: ValidatedPortfolioRow;
  propertyIndex: ExistingPropertyIndex;
  manifest: PortfolioImportManifest;
  dryRun: boolean;
}): Promise<{ propertyId: string; unitId: string; propertyCreated: boolean; unitCreated: boolean }> {
  const { address, ownerEmail, ownerPhone, strataNotes } = args.validated;
  const dedupKey = propertyImportDedupKey(address.streetLine1, address.postalCode);
  const existing = args.propertyIndex.get(dedupKey);

  if (existing) {
    const needsUpdate = ownerStrataChanged(existing, args.validated);
    if (needsUpdate) {
      if (args.dryRun) {
        console.log(
          `  [dry-run] Would update property ${existing.id} owner/strata fields`,
        );
      } else {
        await prisma.property.update({
          where: { id: existing.id },
          data: { ownerEmail, ownerPhone, strataNotes },
        });
      }
      args.manifest.properties.push({ id: existing.id, importCreated: false });
    } else if (!args.validated.tenant) {
      args.manifest.skipped.push({
        row: args.validated.row.rowNumber,
        reason: `Property already exists (${dedupKey})`,
      });
    }

    const unit = await findDefaultUnit(existing.id);
    if (!unit) {
      throw new Error(`Property ${existing.id} is missing the default "${ENTIRE_PROPERTY_UNIT_NUMBER}" unit`);
    }
    return {
      propertyId: existing.id,
      unitId: unit.id,
      propertyCreated: false,
      unitCreated: false,
    };
  }

  if (args.dryRun) {
    console.log(`  [dry-run] Would create property at ${address.streetLine1}, ${address.city}`);
    args.manifest.properties.push({ id: `dry-run-property-${dedupKey}`, importCreated: true });
    args.manifest.units.push({
      id: `dry-run-unit-${dedupKey}`,
      propertyId: `dry-run-property-${dedupKey}`,
      importCreated: true,
    });
    return {
      propertyId: `dry-run-property-${dedupKey}`,
      unitId: `dry-run-unit-${dedupKey}`,
      propertyCreated: true,
      unitCreated: true,
    };
  }

  const property = await prisma.property.create({
    data: {
      organizationId: args.organizationId,
      name: address.streetLine1,
      streetLine1: address.streetLine1,
      streetLine2: address.streetLine2,
      city: address.city,
      province: address.province,
      postalCode: address.postalCode,
      country: address.country,
      ownerEmail,
      ownerPhone,
      strataNotes,
    },
  });

  const unit = await prisma.unit.create({
    data: {
      propertyId: property.id,
      unitNumber: ENTIRE_PROPERTY_UNIT_NUMBER,
    },
  });

  args.propertyIndex.set(dedupKey, {
    id: property.id,
    ownerEmail,
    ownerPhone,
    strataNotes,
  });

  args.manifest.properties.push({ id: property.id, importCreated: true });
  args.manifest.units.push({ id: unit.id, propertyId: property.id, importCreated: true });

  await prisma.activityLog.create({
    data: {
      propertyId: property.id,
      entityType: "Property",
      entityId: property.id,
      action: "portfolio.imported",
      newValues: {
        source: "import-portfolio-csv",
        streetLine1: address.streetLine1,
        postalCode: address.postalCode,
      },
    },
  });

  return {
    propertyId: property.id,
    unitId: unit.id,
    propertyCreated: true,
    unitCreated: true,
  };
}

async function importTenantChain(args: {
  validated: ValidatedPortfolioRow;
  propertyId: string;
  unitId: string;
  manifest: PortfolioImportManifest;
  dryRun: boolean;
}): Promise<void> {
  const tenant = args.validated.tenant;
  if (!tenant) return;

  if (args.propertyId.startsWith("dry-run-")) {
    console.log(
      `  [dry-run] Would create active tenancy for ${tenant.email} at ${args.validated.address.streetLine1}`,
    );
    args.manifest.applications.push({ id: `dry-run-app-${tenant.email}`, importCreated: true });
    args.manifest.tenancies.push({
      id: `dry-run-tenancy-${tenant.email}`,
      propertyId: args.propertyId,
      importCreated: true,
    });
    args.manifest.tenancyContacts.push({
      id: `dry-run-contact-${tenant.email}`,
      importCreated: true,
    });
    return;
  }

  const existing = await findExistingActiveTenancyForTenant(
    args.propertyId,
    args.unitId,
    tenant.email,
  );
  if (existing) {
    args.manifest.skipped.push({
      row: args.validated.row.rowNumber,
      reason: `Active tenancy already exists for tenant ${tenant.email}`,
    });
    return;
  }

  if (args.dryRun) {
    console.log(
      `  [dry-run] Would create active tenancy for ${tenant.email} at ${args.validated.address.streetLine1}`,
    );
    args.manifest.applications.push({ id: `dry-run-app-${tenant.email}`, importCreated: true });
    args.manifest.tenancies.push({
      id: `dry-run-tenancy-${tenant.email}`,
      propertyId: args.propertyId,
      importCreated: true,
    });
    args.manifest.tenancyContacts.push({
      id: `dry-run-contact-${tenant.email}`,
      importCreated: true,
    });
    return;
  }

  const placeholderDate = portfolioImportPlaceholderDate();

  const result = await prisma.$transaction(async (tx) => {
    const application = await tx.application.create({
      data: {
        propertyId: args.propertyId,
        unitId: args.unitId,
        email: tenant.email,
        firstName: tenant.firstName,
        lastName: tenant.lastName,
        phone: tenant.phone,
        status: "approved",
        submittedAt: placeholderDate,
        decisionAt: placeholderDate,
        consentCreditCheck: false,
      },
    });

    const tenancy = await tx.tenancy.create({
      data: {
        propertyId: args.propertyId,
        unitId: args.unitId,
        applicationId: application.id,
        status: "active",
        leaseStartDate: placeholderDate,
        moveInDate: placeholderDate,
        monthlyRent: new Prisma.Decimal("0"),
        securityDeposit: new Prisma.Decimal("0"),
        contacts: {
          create: {
            firstName: tenant.firstName,
            lastName: tenant.lastName,
            email: tenant.email,
            phone: tenant.phone,
            contactType: "tenant",
            portalAccessEnabled: true,
          },
        },
      },
      include: {
        contacts: {
          where: { contactType: "tenant" },
          take: 1,
        },
      },
    });

    await tx.activityLog.create({
      data: {
        propertyId: args.propertyId,
        entityType: "Tenancy",
        entityId: tenancy.id,
        action: "portfolio.imported",
        newValues: {
          source: "import-portfolio-csv",
          tenantEmail: tenant.email,
          status: "active",
        },
      },
    });

    return {
      applicationId: application.id,
      tenancyId: tenancy.id,
      contactId: tenancy.contacts[0]?.id ?? null,
    };
  });

  if (!result.contactId) {
    throw new Error("Imported tenancy was created without a tenant contact");
  }

  args.manifest.applications.push({ id: result.applicationId, importCreated: true });
  args.manifest.tenancies.push({
    id: result.tenancyId,
    propertyId: args.propertyId,
    importCreated: true,
  });
  args.manifest.tenancyContacts.push({ id: result.contactId, importCreated: true });
}

function logAddressSummary(address: ParsedBcPropertyAddress): string {
  return `${address.streetLine1}, ${address.city}, ${address.province} ${address.postalCode}`;
}

async function main(): Promise<void> {
  const env = requireImportEnv();
  const csvAbsolutePath = path.resolve(env.csvPath);
  const csvContent = await readFile(csvAbsolutePath, "utf8");

  const organization = await prisma.organization.findUnique({
    where: { slug: env.organizationSlug },
    select: { id: true, slug: true, name: true },
  });
  if (!organization) {
    throw new Error(`Organization not found for slug: ${env.organizationSlug}`);
  }

  const records = recordsFromCsv(csvContent);
  const manifest = createEmptyManifest({
    organizationId: organization.id,
    organizationSlug: organization.slug,
    csvPath: csvAbsolutePath,
    dryRun: env.dryRun,
  });

  const propertyIndex = await loadExistingPropertyIndex(organization.id);

  console.log(
    `${env.dryRun ? "DRY RUN — " : ""}Portfolio import for ${organization.name} (${organization.slug})`,
  );
  console.log(`CSV: ${csvAbsolutePath}`);
  console.log(`Rows: ${records.length}`);
  console.log("");

  for (let index = 0; index < records.length; index += 1) {
    const rowNumber = index + 2;
    const row = mapCsvRecord(rowNumber, records[index]);
    console.log(`Row ${rowNumber}: ${row.propertyAddress || "(no address)"}`);

    const validated = validatePortfolioRow(row);
    if ("error" in validated) {
      console.log(`  ERROR: ${validated.error}`);
      manifest.errors.push({ row: rowNumber, error: validated.error });
      continue;
    }

    try {
      const { propertyId, unitId } = await ensurePropertyAndUnit({
        organizationId: organization.id,
        validated,
        propertyIndex,
        manifest,
        dryRun: env.dryRun,
      });

      if (!validated.tenant) {
        console.log(`  Property only: ${logAddressSummary(validated.address)}`);
        continue;
      }

      await importTenantChain({
        validated,
        propertyId,
        unitId,
        manifest,
        dryRun: env.dryRun,
      });
      console.log(`  Imported tenant ${validated.tenant.email} at ${logAddressSummary(validated.address)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR: ${message}`);
      manifest.errors.push({ row: rowNumber, error: message });
    }
  }

  finalizeManifestSummary(manifest);

  console.log("");
  console.log("Summary:");
  console.log(`  Created properties: ${manifest.summary.createdProperties}`);
  console.log(`  Updated properties: ${manifest.summary.updatedProperties}`);
  console.log(`  Created units: ${manifest.summary.createdUnits}`);
  console.log(`  Created applications: ${manifest.summary.createdApplications}`);
  console.log(`  Created tenancies: ${manifest.summary.createdTenancies}`);
  console.log(`  Created tenancy contacts: ${manifest.summary.createdTenancyContacts}`);
  console.log(`  Skipped rows: ${manifest.summary.skippedRows}`);
  console.log(`  Error rows: ${manifest.summary.errorRows}`);

  if (!env.dryRun) {
    const manifestName = `import-manifest-${Date.now()}.json`;
    const manifestPath = path.resolve(manifestName);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log("");
    console.log(`Manifest written: ${manifestPath}`);
  } else {
    console.log("");
    console.log("Dry run complete — no database writes or manifest file.");
  }
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
