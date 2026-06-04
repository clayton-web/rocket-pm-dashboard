import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildApplicationDraftUpdateData } from "@/lib/services/application.service";
import { patchBodyToServiceInput } from "@/lib/validation/application";

describe("application draft emergency contact persistence", () => {
  it("maps emergency contact fields from PATCH body to service input", () => {
    const input = patchBodyToServiceInput({
      email: "tenant@example.com",
      emergencyContactFirstName: "Alex",
      emergencyContactLastName: "Friend",
      emergencyContactPhone: "604-555-0199",
      emergencyContactEmail: "alex@example.com",
    });

    assert.equal(input.emergencyContactFirstName, "Alex");
    assert.equal(input.emergencyContactLastName, "Friend");
    assert.equal(input.emergencyContactPhone, "604-555-0199");
    assert.equal(input.emergencyContactEmail, "alex@example.com");
  });

  it("buildApplicationDraftUpdateData persists emergency contact columns", () => {
    const data = buildApplicationDraftUpdateData({
      emergencyContactFirstName: "Alex",
      emergencyContactLastName: "Friend",
      emergencyContactPhone: "604-555-0199",
      emergencyContactEmail: "alex@example.com",
    });

    assert.equal(data.emergencyContactFirstName, "Alex");
    assert.equal(data.emergencyContactLastName, "Friend");
    assert.equal(data.emergencyContactPhone, "604-555-0199");
    assert.equal(data.emergencyContactEmail, "alex@example.com");
  });
});
