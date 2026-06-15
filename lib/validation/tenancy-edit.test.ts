import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTenancyEditFormInput } from "@/lib/validation/tenancy-edit";

const baseForm = {
  contactId: "contact_1",
  firstName: "MEZGHAN",
  lastName: "Alemy",
  email: "",
  phone: "",
  portalAccessEnabled: false,
  monthlyRent: "0",
  securityDeposit: "0",
  leaseStartDate: "2020-03-03",
  moveInDate: "2020-03-03",
  leaseEndDate: "",
  status: "active",
  parkingDescription: "",
  storageDescription: "",
  petDetails: "",
};

describe("parseTenancyEditFormInput", () => {
  it("accepts legacy tenant with name only and no email or phone", () => {
    const parsed = parseTenancyEditFormInput(baseForm);
    assert.equal("error" in parsed, false);
    if ("error" in parsed) return;
    assert.equal(parsed.firstName, "MEZGHAN");
    assert.equal(parsed.lastName, "Alemy");
    assert.equal(parsed.email, "");
    assert.equal(parsed.phone, null);
  });

  it("accepts optional phone and validates email when provided", () => {
    const parsed = parseTenancyEditFormInput({
      ...baseForm,
      firstName: "Audrey",
      lastName: "Angchangco",
      email: "angchangco.audrey@gmail.com",
      phone: "(604) 379-3398",
      monthlyRent: "2500",
      securityDeposit: "1250",
      leaseStartDate: "2022-02-15",
      moveInDate: "2022-02-15",
    });
    assert.equal("error" in parsed, false);
    if ("error" in parsed) return;
    assert.equal(parsed.email, "angchangco.audrey@gmail.com");
    assert.equal(parsed.phone, "(604) 379-3398");
    assert.equal(parsed.monthlyRent, 2500);
    assert.equal(parsed.securityDeposit, 1250);
  });

  it("rejects invalid email format", () => {
    const parsed = parseTenancyEditFormInput({
      ...baseForm,
      email: "not-an-email",
    });
    assert.equal("error" in parsed, true);
  });

  it("rejects missing first name", () => {
    const parsed = parseTenancyEditFormInput({
      ...baseForm,
      firstName: "",
    });
    assert.equal("error" in parsed, true);
  });
});
