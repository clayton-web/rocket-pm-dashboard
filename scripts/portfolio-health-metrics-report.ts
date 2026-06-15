#!/usr/bin/env npx tsx
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { loadPortfolioHealthForStaff } from "@/lib/property/portfolio-health-staff";
import type { StaffContext } from "@/lib/services/staff-context";

async function main() {
  const organizationSlug = process.env.ORGANIZATION_SLUG ?? "axford";
  const prisma = new PrismaClient();

  try {
    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
      select: { id: true, slug: true },
    });
    if (!organization) {
      throw new Error(`Organization not found: ${organizationSlug}`);
    }

    const ctx: StaffContext = {
      userId: "portfolio-health-metrics-report",
      organizationId: organization.id,
      organizationRole: "ADMIN",
      primaryRoleKey: "administrator",
      assignmentRolesByProperty: new Map(),
    };

    const { rows, summary } = await loadPortfolioHealthForStaff(ctx);
    console.log(
      JSON.stringify(
        {
          organization: organization.slug,
          rowCount: rows.length,
          summary,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
