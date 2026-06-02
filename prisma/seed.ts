import "dotenv/config";
import { Prisma, PrismaClient, type RoleKey } from "@prisma/client";

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

const AXFORD_SEED_PROPERTY_NAME = "Harbourview Apartments (seed)";

const SEED_PROSPECT_EMAIL = "prospect.seed@axford.test";
const SEED_APPLICANT_EMAIL = "applicant.seed@axford.test";
const SEED_TENANT_EMAIL = "tenant.seed@axford.test";
const SEED_LEASE_STORAGE_KEY = "seed/axford/harbourview/lease-2026.pdf";
const SEED_CLIENT_PROFILE_EMAIL = "client.jordan.tenant@axford.test";

async function seedAxfordPropertyGraph(args: {
  organizationId: string;
  pmUserId: string;
  propertyManagerRoleId: string;
}): Promise<{ propertyId: string; unitId: string }> {
  let property = await prisma.property.findFirst({
    where: {
      organizationId: args.organizationId,
      name: AXFORD_SEED_PROPERTY_NAME,
    },
  });

  if (!property) {
    property = await prisma.property.create({
      data: {
        organizationId: args.organizationId,
        name: AXFORD_SEED_PROPERTY_NAME,
        streetLine1: "1000 Example Street",
        streetLine2: "Suite 200",
        city: "Vancouver",
        province: "BC",
        postalCode: "V6B 1A1",
        country: "CA",
      },
    });
  }

  const unitNumbers = ["101", "102"] as const;
  for (const unitNumber of unitNumbers) {
    await prisma.unit.upsert({
      where: {
        propertyId_unitNumber: {
          propertyId: property.id,
          unitNumber,
        },
      },
      update: { isActive: true },
      create: {
        propertyId: property.id,
        unitNumber,
        floor: unitNumber === "101" ? "1" : "1",
        bedrooms: 2,
      },
    });
  }

  await prisma.userPropertyAssignment.upsert({
    where: {
      userId_propertyId_roleId: {
        userId: args.pmUserId,
        propertyId: property.id,
        roleId: args.propertyManagerRoleId,
      },
    },
    update: {},
    create: {
      userId: args.pmUserId,
      propertyId: property.id,
      roleId: args.propertyManagerRoleId,
    },
  });

  const unit = await prisma.unit.findUniqueOrThrow({
    where: {
      propertyId_unitNumber: {
        propertyId: property.id,
        unitNumber: "101",
      },
    },
  });

  return { propertyId: property.id, unitId: unit.id };
}

async function seedAxfordLeasingTenancy(args: {
  propertyId: string;
  unitId: string;
  reviewedByUserId: string;
}) {
  let prospect = await prisma.prospect.findFirst({
    where: { propertyId: args.propertyId, email: SEED_PROSPECT_EMAIL },
  });
  if (!prospect) {
    prospect = await prisma.prospect.create({
      data: {
        propertyId: args.propertyId,
        unitId: args.unitId,
        email: SEED_PROSPECT_EMAIL,
        firstName: "Sam",
        lastName: "Prospect",
        phone: "604-555-0101",
        message: "Interested in a showing for unit 101.",
        status: "new",
      },
    });
  }

  let application = await prisma.application.findFirst({
    where: {
      propertyId: args.propertyId,
      email: SEED_APPLICANT_EMAIL,
      unitId: args.unitId,
    },
  });
  if (!application) {
    application = await prisma.application.create({
      data: {
        propertyId: args.propertyId,
        unitId: args.unitId,
        prospectId: prospect.id,
        email: SEED_APPLICANT_EMAIL,
        firstName: "Taylor",
        lastName: "Applicant",
        phone: "604-555-0102",
        status: "approved",
        submittedAt: new Date("2026-01-15"),
        decisionAt: new Date("2026-01-20"),
        reviewedByUserId: args.reviewedByUserId,
        consentCreditCheck: true,
        consentSignatureName: "Taylor Applicant",
        consentSignedAt: new Date("2026-01-15"),
        monthlyIncome: new Prisma.Decimal("5500.00"),
      },
    });
  }

  const existingTenancy = await prisma.tenancy.findUnique({
    where: { applicationId: application.id },
  });
  if (!existingTenancy) {
    const tenancy = await prisma.tenancy.create({
      data: {
        propertyId: args.propertyId,
        unitId: args.unitId,
        applicationId: application.id,
        status: "active",
        leaseStartDate: new Date("2026-02-01"),
        leaseEndDate: new Date("2027-01-31"),
        moveInDate: new Date("2026-02-01"),
        monthlyRent: new Prisma.Decimal("2500.00"),
        securityDeposit: new Prisma.Decimal("1250.00"),
        contacts: {
          create: {
            firstName: "Jordan",
            lastName: "Tenant",
            email: SEED_TENANT_EMAIL,
            phone: "604-555-0103",
            contactType: "tenant",
            portalAccessEnabled: false,
          },
        },
      },
    });

    const noticeExists = await prisma.notice.findFirst({
      where: { tenancyId: tenancy.id, noticeType: "welcome" },
    });
    if (!noticeExists) {
      await prisma.notice.create({
        data: {
          propertyId: args.propertyId,
          unitId: args.unitId,
          tenancyId: tenancy.id,
          noticeType: "welcome",
          title: "Welcome to Harbourview (seed)",
          body: "Sample welcome notice for seed tenancy.",
          serviceMethod: "email",
          servedAt: new Date("2026-02-01"),
        },
      });
    }
  }
}

async function seedAxfordDocumentsAndOps(args: {
  propertyId: string;
  unitId: string;
  actorUserId: string;
}) {
  const application = await prisma.application.findFirst({
    where: {
      propertyId: args.propertyId,
      email: SEED_APPLICANT_EMAIL,
    },
  });
  if (!application) {
    return;
  }

  const tenancy = await prisma.tenancy.findUnique({
    where: { applicationId: application.id },
  });
  if (!tenancy) {
    return;
  }

  await prisma.document.upsert({
    where: { storageKey: SEED_LEASE_STORAGE_KEY },
    update: {
      title: "Residential tenancy agreement (seed)",
      isLocked: true,
    },
    create: {
      propertyId: args.propertyId,
      unitId: args.unitId,
      tenancyId: tenancy.id,
      documentType: "lease",
      title: "Residential tenancy agreement (seed)",
      fileName: "lease-2026.pdf",
      contentType: "application/pdf",
      sizeBytes: 0,
      storageKey: SEED_LEASE_STORAGE_KEY,
      isLocked: true,
    },
  });

  const existingSig = await prisma.signatureRequest.findFirst({
    where: {
      tenancyId: tenancy.id,
      provider: "dropbox_sign",
      status: "draft",
    },
  });
  if (!existingSig) {
    await prisma.signatureRequest.create({
      data: {
        propertyId: args.propertyId,
        tenancyId: tenancy.id,
        provider: "dropbox_sign",
        status: "draft",
      },
    });
  }

  let checklist = await prisma.checklist.findFirst({
    where: {
      propertyId: args.propertyId,
      tenancyId: tenancy.id,
      checklistType: "move_in",
    },
  });
  if (!checklist) {
    checklist = await prisma.checklist.create({
      data: {
        propertyId: args.propertyId,
        tenancyId: tenancy.id,
        checklistType: "move_in",
        status: "in_progress",
        items: {
          create: [
            {
              itemKey: "keys_handover",
              label: "Keys handed to tenant",
              status: "complete",
              completedAt: new Date("2026-02-01"),
            },
            {
              itemKey: "smoke_alarm_test",
              label: "Smoke alarms tested",
              status: "pending",
            },
          ],
        },
      },
    });
  } else {
    for (const item of [
      {
        itemKey: "keys_handover",
        label: "Keys handed to tenant",
        status: "complete" as const,
        completedAt: new Date("2026-02-01"),
      },
      {
        itemKey: "smoke_alarm_test",
        label: "Smoke alarms tested",
        status: "pending" as const,
        completedAt: null as Date | null,
      },
    ]) {
      await prisma.checklistItem.upsert({
        where: {
          checklistId_itemKey: {
            checklistId: checklist.id,
            itemKey: item.itemKey,
          },
        },
        update: {
          label: item.label,
          status: item.status,
          completedAt: item.completedAt,
        },
        create: {
          checklistId: checklist.id,
          itemKey: item.itemKey,
          label: item.label,
          status: item.status,
          completedAt: item.completedAt,
        },
      });
    }
  }

  const existingProfile = await prisma.clientProfile.findFirst({
    where: { email: SEED_CLIENT_PROFILE_EMAIL },
  });
  if (!existingProfile) {
    await prisma.clientProfile.create({
      data: {
        firstName: "Jordan",
        lastName: "Tenant",
        email: SEED_CLIENT_PROFILE_EMAIL,
        phone: "604-555-0103",
        city: "Vancouver",
        sourceType: "former_tenant",
        sourceTenancyId: tenancy.id,
        createdByUserId: args.actorUserId,
        notes: "Seed client profile linked to Harbourview tenancy.",
      },
    });
  }

  const existingActivity = await prisma.activityLog.findFirst({
    where: {
      entityType: "Tenancy",
      entityId: tenancy.id,
      action: "tenancy.seeded",
    },
  });
  if (!existingActivity) {
    await prisma.activityLog.create({
      data: {
        propertyId: args.propertyId,
        actorUserId: args.actorUserId,
        entityType: "Tenancy",
        entityId: tenancy.id,
        action: "tenancy.seeded",
        newValues: { status: tenancy.status, unitId: tenancy.unitId },
      },
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

  const { propertyId, unitId } = await seedAxfordPropertyGraph({
    organizationId: org.id,
    pmUserId: pm.id,
    propertyManagerRoleId: propertyManagerRole.id,
  });

  await seedAxfordLeasingTenancy({
    propertyId,
    unitId,
    reviewedByUserId: admin.id,
  });

  await seedAxfordDocumentsAndOps({
    propertyId,
    unitId,
    actorUserId: admin.id,
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
