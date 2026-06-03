import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePostViewingRequestBody } from "./leasing";

const validBase = {
  propertyId: "prop_1",
  unitId: "unit_1",
  email: "test@example.com",
  firstName: "Jane",
  lastName: "Doe",
  phone: "604-555-0100",
  occupantCount: 2,
  hasPets: false,
  smokerStatus: "non_smoker",
  householdIncomeRange: "5000_7499",
  desiredMoveInDate: "2026-08-01",
  preferredViewingNotes: "Weekday afternoons",
  message: "Looking forward to visiting.",
};

describe("parsePostViewingRequestBody", () => {
  it("accepts a complete viewing request", () => {
    const parsed = parsePostViewingRequestBody(validBase);
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.firstName, "Jane");
    assert.equal(parsed.occupantCount, 2);
    assert.equal(parsed.hasPets, false);
    assert.equal(parsed.desiredMoveInDate, "2026-08-01");
  });

  it("requires first and last name", () => {
    const parsed = parsePostViewingRequestBody({ ...validBase, firstName: "" });
    assert.ok("error" in parsed);
  });

  it("requires pet details when hasPets is true", () => {
    const parsed = parsePostViewingRequestBody({
      ...validBase,
      hasPets: true,
      petDetails: "",
    });
    assert.ok("error" in parsed);
  });

  it("rejects invalid income range", () => {
    const parsed = parsePostViewingRequestBody({
      ...validBase,
      householdIncomeRange: "invalid",
    });
    assert.ok("error" in parsed);
  });
});
