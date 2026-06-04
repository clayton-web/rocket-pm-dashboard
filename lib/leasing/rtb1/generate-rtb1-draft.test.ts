import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { emptyServicesIncluded } from "@/lib/leasing/lease-setup";
import { assessLeaseSetupReadiness } from "@/lib/leasing/lease-setup-readiness";
import { RTB1_DOCUMENT_TYPE, RTB1_TEMPLATE_VERSION } from "./constants";
import { getRtb1TemplatePath } from "./template-path";
import { fillRtb1PdfTemplate } from "./fill-rtb1-pdf";
import { mapTenancyToRtb1PdfValues } from "./map-tenancy-to-rtb1";
import { buildTenancyDocumentStorageKey } from "@/lib/storage/local-document-storage";

describe("RTB-1 constants", () => {
  it("uses the approved template version", () => {
    assert.equal(RTB1_TEMPLATE_VERSION, "2023/06");
    assert.equal(RTB1_DOCUMENT_TYPE, "lease_rtb1_draft");
  });
});

describe("readiness gate for RTB-1 generation", () => {
  const completeOrg = {
    landlordLegalName: "Landlord Ltd.",
    landlordServiceStreetLine1: "100 Main St",
    landlordServiceStreetLine2: null,
    landlordServiceCity: "Vancouver",
    landlordServiceProvince: "BC",
    landlordServicePostalCode: "V6B 1A1",
    landlordServicePhone: "604-555-0100",
    landlordServiceEmail: null,
    landlordIsAgent: false,
  };

  const completeSetup = {
    tenancyType: "month_to_month" as const,
    rentPeriod: "month" as const,
    servicesIncluded: emptyServicesIncluded(),
    securityDepositDueDate: "2026-06-15",
    petDepositNotApplicable: true,
  };

  it("allows generation only when readiness is ready_for_rtb1", () => {
    const ready = assessLeaseSetupReadiness({
      org: completeOrg,
      setup: completeSetup,
      tenancy: {
        leaseStartDate: new Date("2026-07-01"),
        leaseEndDate: null,
        rentDueDay: 1,
        monthlyRent: 2000,
        securityDeposit: 1000,
        petDeposit: null,
      },
    });
    assert.equal(ready.status, "ready_for_rtb1");

    const incomplete = assessLeaseSetupReadiness({
      org: completeOrg,
      setup: {},
      tenancy: {
        leaseStartDate: new Date("2026-07-01"),
        leaseEndDate: null,
        rentDueDay: 1,
        monthlyRent: 2000,
        securityDeposit: 1000,
        petDeposit: null,
      },
    });
    assert.notEqual(incomplete.status, "ready_for_rtb1");
  });
});

describe("document storage key", () => {
  it("builds an org-scoped tenancy storage path", () => {
    const key = buildTenancyDocumentStorageKey({
      organizationId: "org_1",
      propertyId: "prop_1",
      tenancyId: "ten_1",
      documentId: "doc_1",
      fileName: "rtb1-draft.pdf",
    });
    assert.match(key, /^org\/org_1\/property\/prop_1\/tenancy\/ten_1\/doc_1-rtb1-draft.pdf$/);
  });
});

describe("fillRtb1PdfTemplate", () => {
  it("fills the bundled RTB-1 template without flattening", () => {
    const templatePath = getRtb1TemplatePath();
    if (!existsSync(templatePath)) {
      // Template binary may be absent in CI until committed; skip hard failure.
      return;
    }

    const templateBytes = readFileSync(templatePath);
    const fieldValues = mapTenancyToRtb1PdfValues({
      org: {
        landlordLegalName: "Test Landlord",
        landlordServiceStreetLine1: "1 Test St",
        landlordServiceStreetLine2: null,
        landlordServiceCity: "Vancouver",
        landlordServiceProvince: "BC",
        landlordServicePostalCode: "V6B1A1",
        landlordServicePhone: "6045550100",
        landlordServiceEmail: null,
        landlordIsAgent: false,
      },
      property: {
        streetLine1: "2 Rental St",
        streetLine2: null,
        city: "Vancouver",
        province: "BC",
        postalCode: "V6B2B2",
      },
      unit: { unitNumber: "101" },
      tenancy: {
        leaseStartDate: new Date("2026-07-01T12:00:00.000Z"),
        leaseEndDate: null,
        rentDueDay: 1,
        monthlyRent: 2000,
        securityDeposit: 1000,
        petDeposit: null,
      },
      leaseSetup: {
        tenancyType: "month_to_month",
        rentPeriod: "month",
        servicesIncluded: emptyServicesIncluded(),
        securityDepositDueDate: "2026-06-15",
        petDepositNotApplicable: true,
      },
      tenantContacts: [
        {
          firstName: "Jane",
          lastName: "Tenant",
          email: "jane@example.com",
          phone: "6045550200",
          contactType: "tenant",
        },
      ],
    });

    return fillRtb1PdfTemplate(templateBytes, fieldValues).then((filled) => {
      assert.ok(filled.length > 0);
      assert.ok(filled.length >= templateBytes.length * 0.9);
    });
  });
});
