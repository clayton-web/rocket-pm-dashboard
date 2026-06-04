import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyServicesIncluded } from "./lease-setup";
import {
  assessLeaseSetupReadiness,
  validateDepositCaps,
  validateLeaseSetupFields,
  validateOrganizationLandlordProfile,
} from "./lease-setup-readiness";

const completeOrg = {
  landlordLegalName: "Rocket PM Holdings Ltd.",
  landlordServiceStreetLine1: "100 Main St",
  landlordServiceStreetLine2: null,
  landlordServiceCity: "Vancouver",
  landlordServiceProvince: "BC",
  landlordServicePostalCode: "V6B 1A1",
  landlordServicePhone: "604-555-0100",
  landlordServiceEmail: "landlord@example.com",
  landlordIsAgent: false,
};

const baseTenancy = {
  leaseStartDate: new Date("2026-07-01"),
  leaseEndDate: null,
  rentDueDay: 1,
  monthlyRent: 2000,
  securityDeposit: 1000,
  petDeposit: null,
};

const completeMonthToMonthSetup = {
  tenancyType: "month_to_month" as const,
  rentPeriod: "month" as const,
  servicesIncluded: emptyServicesIncluded(),
  securityDepositDueDate: "2026-06-15",
  petDepositNotApplicable: true,
};

describe("validateDepositCaps", () => {
  it("rejects security deposit above 50% of rent", () => {
    const issues = validateDepositCaps({
      ...baseTenancy,
      securityDeposit: 1200,
    });
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.field, "securityDeposit");
  });

  it("rejects pet deposit above 50% of rent", () => {
    const issues = validateDepositCaps({
      ...baseTenancy,
      petDeposit: 1200,
    });
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.field, "petDeposit");
  });

  it("accepts deposits within cap", () => {
    const issues = validateDepositCaps({
      ...baseTenancy,
      securityDeposit: 1000,
      petDeposit: 500,
    });
    assert.equal(issues.length, 0);
  });
});

describe("validateLeaseSetupFields fixed-term", () => {
  it("requires lease end date for fixed term", () => {
    const issues = validateLeaseSetupFields(
      {
        tenancyType: "fixed_term",
        rentPeriod: "month",
        servicesIncluded: emptyServicesIncluded(),
        securityDepositDueDate: "2026-06-15",
        fixedTermEndBehavior: "continue",
        petDepositNotApplicable: true,
      },
      { ...baseTenancy, leaseEndDate: null },
    );
    assert.ok(issues.some((i) => i.field === "leaseEndDate"));
  });
});

describe("validateLeaseSetupFields vacate clause", () => {
  it("requires reason, section, and attestation for vacate option", () => {
    const issues = validateLeaseSetupFields(
      {
        tenancyType: "fixed_term",
        rentPeriod: "month",
        servicesIncluded: emptyServicesIncluded(),
        securityDepositDueDate: "2026-06-15",
        fixedTermEndBehavior: "vacate",
        petDepositNotApplicable: true,
      },
      {
        ...baseTenancy,
        leaseEndDate: new Date("2027-06-30"),
      },
    );
    assert.ok(issues.some((i) => i.field === "vacateReason"));
    assert.ok(issues.some((i) => i.field === "vacateRtrSection"));
    assert.ok(issues.some((i) => i.field === "vacateClauseAttested"));
  });

  it("passes when vacate fields are complete", () => {
    const issues = validateLeaseSetupFields(
      {
        tenancyType: "fixed_term",
        rentPeriod: "month",
        servicesIncluded: emptyServicesIncluded(),
        securityDepositDueDate: "2026-06-15",
        fixedTermEndBehavior: "vacate",
        vacateReason: "Landlord will occupy the unit",
        vacateRtrSection: "49(6)(b)",
        vacateClauseAttested: true,
        petDepositNotApplicable: true,
      },
      {
        ...baseTenancy,
        leaseEndDate: new Date("2027-06-30"),
      },
    );
    assert.equal(issues.length, 0);
  });
});

describe("validateOrganizationLandlordProfile", () => {
  it("requires core landlord service fields", () => {
    const issues = validateOrganizationLandlordProfile({
      ...completeOrg,
      landlordLegalName: null,
      landlordServicePhone: "",
    });
    assert.ok(issues.some((i) => i.field === "landlordLegalName"));
    assert.ok(issues.some((i) => i.field === "landlordServicePhone"));
  });
});

describe("assessLeaseSetupReadiness", () => {
  it("is incomplete when lease setup fields are missing", () => {
    const result = assessLeaseSetupReadiness({
      org: completeOrg,
      setup: {},
      tenancy: baseTenancy,
    });
    assert.equal(result.status, "lease_setup_incomplete");
    assert.ok(result.issues.length > 0);
  });

  it("is complete when tenancy setup is done but org profile is missing", () => {
    const result = assessLeaseSetupReadiness({
      org: { ...completeOrg, landlordLegalName: null },
      setup: completeMonthToMonthSetup,
      tenancy: baseTenancy,
    });
    assert.equal(result.status, "lease_setup_complete");
  });

  it("is ready for RTB-1 when all validations pass", () => {
    const result = assessLeaseSetupReadiness({
      org: completeOrg,
      setup: completeMonthToMonthSetup,
      tenancy: baseTenancy,
    });
    assert.equal(result.status, "ready_for_rtb1");
    assert.equal(result.issues.length, 0);
  });
});
