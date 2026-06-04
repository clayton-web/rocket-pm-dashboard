import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyServicesIncluded } from "@/lib/leasing/lease-setup";
import { RTB1_FIELD_MAP } from "./field-map";
import {
  mapLogicalFieldsToPdfValues,
  mapTenancyToRtb1LogicalFields,
  mapTenancyToRtb1PdfValues,
} from "./map-tenancy-to-rtb1";

const sampleInput = {
  org: {
    landlordLegalName: "Harbourview Holdings Ltd.",
    landlordServiceStreetLine1: "100 Main Street",
    landlordServiceStreetLine2: "Suite 200",
    landlordServiceCity: "Vancouver",
    landlordServiceProvince: "BC",
    landlordServicePostalCode: "V6B 1A1",
    landlordServicePhone: "604-555-0100",
    landlordServiceEmail: "landlord@example.com",
    landlordIsAgent: false,
  },
  property: {
    streetLine1: "455 Harbourview Crescent",
    streetLine2: null,
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
    petDeposit: 250,
  },
  leaseSetup: {
    tenancyType: "fixed_term" as const,
    rentPeriod: "month" as const,
    fixedTermEndBehavior: "continue" as const,
    servicesIncluded: {
      ...emptyServicesIncluded(),
      water: true,
      heat: true,
      parking: true,
    },
    securityDepositDueDate: "2026-06-15",
    petDepositDueDate: "2026-06-15",
    parkingDescription: "One underground stall",
    addendumAttached: true,
    addendumPageCount: 2,
    addendumTermCount: 3,
  },
  tenantContacts: [
    {
      firstName: "Jane",
      lastName: "Applicant",
      email: "jane@example.com",
      phone: "604-555-0200",
      contactType: "tenant" as const,
    },
    {
      firstName: "John",
      lastName: "Coapplicant",
      email: "john@example.com",
      phone: null,
      contactType: "co_tenant" as const,
    },
  ],
};

describe("RTB1_FIELD_MAP", () => {
  it("maps landlord legal name to the RTB-1 last name field", () => {
    assert.equal(RTB1_FIELD_MAP["landlord.lastNameOrBusiness"].pdfFieldName, "last name");
  });

  it("maps tenant 1 to row 2 fields on the form", () => {
    assert.equal(RTB1_FIELD_MAP["tenant1.lastName"].pdfFieldName, "last name_2");
    assert.equal(RTB1_FIELD_MAP["tenant1.firstMiddle"].pdfFieldName, "first and middle names_2");
  });
});

describe("mapTenancyToRtb1PdfValues", () => {
  it("maps sample tenancy data to expected PDF field names and values", () => {
    const pdfValues = mapTenancyToRtb1PdfValues(sampleInput);

    assert.equal(pdfValues["last name"]?.kind, "text");
    if (pdfValues["last name"]?.kind === "text") {
      assert.equal(pdfValues["last name"].value, "Harbourview Holdings Ltd.");
    }

    assert.equal(pdfValues["last name_2"]?.kind, "text");
    if (pdfValues["last name_2"]?.kind === "text") {
      assert.equal(pdfValues["last name_2"].value, "Applicant");
    }

    assert.equal(pdfValues["The tenant will pay the rent of"]?.kind, "text");
    if (pdfValues["The tenant will pay the rent of"]?.kind === "text") {
      assert.equal(pdfValues["The tenant will pay the rent of"].value, "$2,500.00");
    }

    assert.equal(
      pdfValues["C and is for a fixed term ending on"]?.kind,
      "checkbox",
    );
    if (pdfValues["C and is for a fixed term ending on"]?.kind === "checkbox") {
      assert.equal(pdfValues["C and is for a fixed term ending on"].checked, true);
    }

    assert.equal(pdfValues["Water"]?.kind, "checkbox");
    assert.equal(pdfValues["Parking for"]?.kind, "text");
    if (pdfValues["Parking for"]?.kind === "text") {
      assert.equal(pdfValues["Parking for"].value, "One underground stall");
    }
  });

  it("checks RTB-26 when more than two agreement signers are present", () => {
    const pdfValues = mapTenancyToRtb1PdfValues({
      ...sampleInput,
      tenantContacts: [
        ...sampleInput.tenantContacts,
        {
          firstName: "Extra",
          lastName: "Tenant",
          email: "extra@example.com",
          phone: null,
          contactType: "co_tenant",
        },
      ],
    });
    assert.equal(pdfValues["RTB26 used  attached"]?.kind, "checkbox");
    if (pdfValues["RTB26 used  attached"]?.kind === "checkbox") {
      assert.equal(pdfValues["RTB26 used  attached"].checked, true);
    }
  });
});

describe("mapLogicalFieldsToPdfValues", () => {
  it("translates logical keys through the field map", () => {
    const logical = mapTenancyToRtb1LogicalFields(sampleInput);
    const pdfValues = mapLogicalFieldsToPdfValues(logical);
    assert.ok(pdfValues["unit number"]);
    assert.ok(pdfValues["city_2"]);
  });
});
