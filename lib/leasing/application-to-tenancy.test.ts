import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEmergencyContactFromApplication,
  buildInitialLeaseSetupFromApplication,
} from "./application-to-tenancy";

describe("buildInitialLeaseSetupFromApplication", () => {
  it("prefills occupant and pet data from application", () => {
    const setup = buildInitialLeaseSetupFromApplication(
      {
        occupantCount: 3,
        hasPets: true,
        petDetails: "One cat",
      },
      null,
    );
    assert.equal(setup.occupantCount, 3);
    assert.equal(setup.hasPets, true);
    assert.equal(setup.petDetails, "One cat");
    assert.equal(setup.petDepositNotApplicable, false);
    assert.equal(setup.rentPeriod, "month");
    assert.equal(setup.tenancyType, undefined);
  });

  it("sets fixed-term type when lease end date is provided", () => {
    const setup = buildInitialLeaseSetupFromApplication(
      { occupantCount: 1, hasPets: false, petDetails: null },
      new Date("2027-06-01"),
    );
    assert.equal(setup.tenancyType, "fixed_term");
    assert.equal(setup.petDepositNotApplicable, true);
  });
});

describe("buildEmergencyContactFromApplication", () => {
  it("returns null when emergency contact is incomplete", () => {
    assert.equal(
      buildEmergencyContactFromApplication({
        emergencyContactFirstName: "Sam",
        emergencyContactLastName: null,
        emergencyContactPhone: "604-555-0100",
        emergencyContactEmail: null,
        email: "tenant@example.com",
      }),
      null,
    );
  });

  it("creates emergency contact using tenant email as fallback", () => {
    const contact = buildEmergencyContactFromApplication({
      emergencyContactFirstName: "Alex",
      emergencyContactLastName: "Friend",
      emergencyContactPhone: "604-555-0199",
      emergencyContactEmail: null,
      email: "tenant@example.com",
    });
    assert.ok(contact);
    assert.equal(contact!.contactType, "emergency_contact");
    assert.equal(contact!.email, "tenant@example.com");
    assert.equal(contact!.portalAccessEnabled, false);
  });

  it("prefers dedicated emergency email when provided", () => {
    const contact = buildEmergencyContactFromApplication({
      emergencyContactFirstName: "Alex",
      emergencyContactLastName: "Friend",
      emergencyContactPhone: "604-555-0199",
      emergencyContactEmail: "alex@example.com",
      email: "tenant@example.com",
    });
    assert.equal(contact!.email, "alex@example.com");
  });
});
