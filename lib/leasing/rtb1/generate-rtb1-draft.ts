import { readFile } from "node:fs/promises";
import type { Document, PrismaClient } from "@prisma/client";
import { parseLeaseSetupJson } from "@/lib/leasing/lease-setup";
import { assessLeaseSetupReadiness } from "@/lib/leasing/lease-setup-readiness";
import { getOrganizationLandlordProfileForStaff } from "@/lib/org/organization-landlord-profile";
import { createDocument } from "@/lib/services/document.service";
import type { StaffContext } from "@/lib/services/staff-context";
import { getTenancyById } from "@/lib/services/tenancy.service";
import { listTenancyContacts } from "@/lib/services/tenancyContact.service";
import {
  buildTenancyDocumentStorageKey,
  writeLocalDocument,
} from "@/lib/storage/local-document-storage";
import { RTB1_DOCUMENT_TYPE, RTB1_TEMPLATE_VERSION } from "./constants";
import { getRtb1TemplatePath } from "./template-path";
import { fillRtb1PdfTemplate } from "./fill-rtb1-pdf";
import { mapTenancyToRtb1PdfValues } from "./map-tenancy-to-rtb1";

export class Rtb1GenerationNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Rtb1GenerationNotReadyError";
  }
}

export async function generateRtb1DraftForTenancy(
  prisma: PrismaClient,
  ctx: StaffContext,
  tenancyId: string,
): Promise<Document> {
  const tenancy = await getTenancyById(prisma, ctx, tenancyId);
  const leaseSetup = parseLeaseSetupJson(tenancy.leaseSetupJson);
  const orgProfile = await getOrganizationLandlordProfileForStaff(ctx);

  const readiness = assessLeaseSetupReadiness({
    org: orgProfile,
    setup: leaseSetup,
    tenancy: {
      leaseStartDate: tenancy.leaseStartDate,
      leaseEndDate: tenancy.leaseEndDate,
      rentDueDay: tenancy.rentDueDay,
      monthlyRent: Number(tenancy.monthlyRent),
      securityDeposit: Number(tenancy.securityDeposit),
      petDeposit: tenancy.petDeposit != null ? Number(tenancy.petDeposit) : null,
    },
  });

  if (readiness.status !== "ready_for_rtb1") {
    throw new Rtb1GenerationNotReadyError(
      readiness.status === "lease_setup_incomplete"
        ? "Lease setup is incomplete. Complete lease setup before generating an RTB-1 draft."
        : "Organization landlord profile or deposit rules must be resolved before generating an RTB-1 draft.",
    );
  }

  const [property, unit, contacts] = await Promise.all([
    prisma.property.findUnique({
      where: { id: tenancy.propertyId },
      select: {
        streetLine1: true,
        streetLine2: true,
        city: true,
        province: true,
        postalCode: true,
      },
    }),
    prisma.unit.findUnique({
      where: { id: tenancy.unitId },
      select: { unitNumber: true },
    }),
    listTenancyContacts(prisma, ctx, tenancy.id),
  ]);

  if (!property || !unit) {
    throw new Error("Property or unit not found for tenancy");
  }

  const fieldValues = mapTenancyToRtb1PdfValues({
    org: orgProfile,
    property,
    unit,
    tenancy,
    leaseSetup,
    tenantContacts: contacts,
  });

  const templateBytes = await readFile(getRtb1TemplatePath());
  const filledBytes = await fillRtb1PdfTemplate(templateBytes, fieldValues);

  const generatedAt = new Date();
  const fileName = `rtb1-draft-${RTB1_TEMPLATE_VERSION.replace("/", "-")}-${generatedAt.toISOString().slice(0, 10)}.pdf`;
  const title = `RTB-1 Draft (${RTB1_TEMPLATE_VERSION})`;
  const storageKey = buildTenancyDocumentStorageKey({
    organizationId: ctx.organizationId,
    propertyId: tenancy.propertyId,
    tenancyId: tenancy.id,
    documentId: String(generatedAt.getTime()),
    fileName,
  });

  await writeLocalDocument(storageKey, filledBytes);

  return createDocument(prisma, ctx, {
    propertyId: tenancy.propertyId,
    unitId: tenancy.unitId,
    tenancyId: tenancy.id,
    documentType: RTB1_DOCUMENT_TYPE,
    title,
    fileName,
    contentType: "application/pdf",
    sizeBytes: filledBytes.length,
    storageKey,
    isSigned: false,
    isLocked: false,
  });
}
