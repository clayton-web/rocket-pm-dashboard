import "dotenv/config";
import { PrismaClient, type RoleKey } from "@prisma/client";

const prisma = new PrismaClient();

const ROLE_SEEDS: { key: RoleKey; name: string }[] = [
  { key: "administrator", name: "Administrator" },
  { key: "property_manager", name: "Property Manager" },
  { key: "field_agent", name: "Field Agent" },
  { key: "tenant", name: "Tenant" },
];

async function seedRoles() {
  for (const row of ROLE_SEEDS) {
    await prisma.role.upsert({
      where: { key: row.key },
      update: { name: row.name },
      create: { key: row.key, name: row.name },
    });
  }
}

async function main() {
  await seedRoles();

  const administratorRole = await prisma.role.findUniqueOrThrow({
    where: { key: "administrator" },
  });
  const propertyManagerRole = await prisma.role.findUniqueOrThrow({
    where: { key: "property_manager" },
  });

  const org = await prisma.organization.upsert({
    where: { slug: "axford" },
    update: { name: "Axford Property Management" },
    create: { name: "Axford Property Management", slug: "axford" },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@axford.test" },
    update: {
      name: "Axford Admin",
      firstName: "Axford",
      lastName: "Admin",
      isActive: true,
      primaryRoleId: administratorRole.id,
    },
    create: {
      name: "Axford Admin",
      firstName: "Axford",
      lastName: "Admin",
      email: "admin@axford.test",
      isActive: true,
      primaryRoleId: administratorRole.id,
    },
  });

  await prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: { userId: admin.id, organizationId: org.id },
    },
    update: { role: "ADMIN" },
    create: {
      userId: admin.id,
      organizationId: org.id,
      role: "ADMIN",
    },
  });

  const pm = await prisma.user.upsert({
    where: { email: "pm@axford.test" },
    update: {
      name: "Axford Property Manager",
      firstName: "Axford",
      lastName: "Property Manager",
      isActive: true,
      primaryRoleId: propertyManagerRole.id,
    },
    create: {
      name: "Axford Property Manager",
      firstName: "Axford",
      lastName: "Property Manager",
      email: "pm@axford.test",
      isActive: true,
      primaryRoleId: propertyManagerRole.id,
    },
  });

  await prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: { userId: pm.id, organizationId: org.id },
    },
    update: { role: "MEMBER" },
    create: {
      userId: pm.id,
      organizationId: org.id,
      role: "MEMBER",
    },
  });

  await prisma.user.upsert({
    where: { email: "operator@rocket-logic.test" },
    update: { platformAccessLevel: "OPERATOR", name: "Rocket Operator" },
    create: {
      name: "Rocket Operator",
      email: "operator@rocket-logic.test",
      platformAccessLevel: "OPERATOR",
    },
  });

  const seededAi = await prisma.aiResponderRule.count({
    where: { organizationId: org.id },
  });
  if (seededAi === 0) {
    await prisma.aiResponderRule.create({
      data: {
        organizationId: org.id,
        priority: 10,
        title: "No legal guarantees",
        instruction:
          "Do not guarantee legal outcomes. For tenancy disputes, deposits, notices, eviction risk, strata issues, or human rights topics, recommend escalation to a licensed property manager or legal counsel.",
        active: true,
      },
    });

    await prisma.aiKnowledgeSource.create({
      data: {
        organizationId: org.id,
        type: "BC_CONTEXT",
        title: "BC property management tone (baseline)",
        content:
          "Communicate in clear Canadian English. Be respectful to tenants, owners, and trades. Reference that timelines and rights depend on the specific tenancy agreement and the Residential Tenancy Act where applicable, without quoting law unless the user provided verified text.",
      },
    });

    await prisma.aiStyleExample.create({
      data: {
        organizationId: org.id,
        userId: null,
        title: "Neutral acknowledgement",
        content:
          "Thank you for your email. We have received your message and are reviewing the details. We will follow up with next steps shortly.",
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
