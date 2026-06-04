import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import { fillRtb1PdfTemplate } from "@/lib/leasing/rtb1/fill-rtb1-pdf";
import { mapTenancyToRtb1PdfValues } from "@/lib/leasing/rtb1/map-tenancy-to-rtb1";
import { emptyServicesIncluded } from "@/lib/leasing/lease-setup";
import { getRtb1TemplatePath } from "@/lib/leasing/rtb1/template-path";
import {
  createExecutedRtb1Pdf,
  initialsFromSignerName,
  RTB1_EXECUTION_PDF_FIELDS,
} from "@/lib/leasing/rtb1/execute-rtb1-pdf";

const ONE_BY_ONE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("execute RTB-1 PDF", () => {
  it("derives initials from signer names", () => {
    assert.equal(initialsFromSignerName("Jordan Tenant"), "JT");
    assert.equal(initialsFromSignerName("Acme"), "AC");
  });

  it("fills signature fields, embeds images, and flattens the PDF", async () => {
    const templateBytes = readFileSync(getRtb1TemplatePath());
    const draftValues = mapTenancyToRtb1PdfValues({
      org: {
        landlordLegalName: "Harbourview Holdings Ltd.",
        landlordServiceStreetLine1: "100 Main Street",
        landlordServiceStreetLine2: null,
        landlordServiceCity: "Vancouver",
        landlordServiceProvince: "BC",
        landlordServicePostalCode: "V6B 1A1",
        landlordServicePhone: "604-555-0100",
        landlordServiceEmail: "landlord@example.com",
        landlordIsAgent: false,
      },
      property: {
        streetLine1: "455 Harbourview Crescent",
        streetLine2: "Suite 200",
        city: "West Vancouver",
        province: "BC",
        postalCode: "V7W 1A1",
      },
      unit: { unitNumber: "204" },
      tenancy: {
        leaseStartDate: new Date("2026-07-01T12:00:00.000Z"),
        leaseEndDate: new Date("2027-06-30T12:00:00.000Z"),
        rentDueDay: 1,
        monthlyRent: 2500,
        securityDeposit: 1250,
        petDeposit: null,
      },
      leaseSetup: {
        tenancyType: "fixed_term",
        rentPeriod: "month",
        fixedTermEndBehavior: "vacate",
        vacateReason: "End of fixed term",
        servicesIncluded: emptyServicesIncluded(),
        securityDepositDueDate: "2026-06-15",
        petDepositNotApplicable: true,
      },
      tenantContacts: [
        {
          firstName: "Jane",
          lastName: "Applicant",
          email: "jane@example.com",
          phone: null,
          contactType: "tenant",
        },
      ],
    });
    const draftBytes = await fillRtb1PdfTemplate(templateBytes, draftValues);
    const tenantSignedAt = new Date("2026-06-03T12:00:00.000Z");
    const pmSignedAt = new Date("2026-06-04T12:00:00.000Z");

    const executedBytes = await createExecutedRtb1Pdf({
      draftPdfBytes: draftBytes,
      vacateClauseApplies: true,
      landlordDisplayName: "Harbourview Holdings Ltd.",
      signers: [
        {
          role: "tenant",
          signerName: "Jane Applicant",
          signedAt: tenantSignedAt,
          signatureImagePng: ONE_BY_ONE_PNG,
        },
        {
          role: "property_manager",
          signerName: "Pat Manager",
          signedAt: pmSignedAt,
          signatureImagePng: ONE_BY_ONE_PNG,
        },
      ],
    });

    assert.ok(executedBytes.length > 0);

    const pdf = await PDFDocument.load(executedBytes);
    assert.equal(pdf.getForm().getFields().length, 0);
  });

  it("uses expected execution field names from the template", () => {
    assert.equal(
      RTB1_EXECUTION_PDF_FIELDS.tenantSignatureLine,
      "last name first and middle names Signature Date TENANTSRow1",
    );
  });
});
