import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Prospect } from "@prisma/client";
import { prospectMatchesApplicationUnit } from "./prospect-match";
import { prospectToPrefillFields, toPublicProspectPrefillResponse } from "./prospect-prefill";

function minimalProspect(overrides: Partial<Prospect> = {}): Prospect {
  return {
    id: "pros_1",
    propertyId: "prop_1",
    unitId: null,
    email: "test@example.com",
    firstName: "Jane",
    lastName: "Doe",
    phone: "604-555-0100",
    status: "new",
    occupantCount: 2,
    hasPets: true,
    petDetails: "One cat",
    smokerStatus: "non_smoker",
    householdIncomeRange: "5000_7499",
    desiredMoveInDate: new Date("2026-08-01T12:00:00.000Z"),
    preferredViewingNotes: "staff only",
    message: "staff only",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Prospect;
}

describe("prospectMatchesApplicationUnit", () => {
  it("matches when prospect has no unit", () => {
    assert.equal(prospectMatchesApplicationUnit({ unitId: null }, "unit_a"), true);
  });

  it("matches when unit ids align", () => {
    assert.equal(prospectMatchesApplicationUnit({ unitId: "unit_a" }, "unit_a"), true);
  });

  it("rejects mismatched unit", () => {
    assert.equal(prospectMatchesApplicationUnit({ unitId: "unit_a" }, "unit_b"), false);
  });
});

describe("prospect prefill response", () => {
  it("returns found:false when no prospect", () => {
    assert.deepEqual(toPublicProspectPrefillResponse(null), { found: false });
  });

  it("returns safe prefill fields without staff-only notes", () => {
    const prospect = minimalProspect();
    const res = toPublicProspectPrefillResponse(prospect);
    assert.equal(res.found, true);
    if (!res.found) return;
    assert.equal(res.prospectId, "pros_1");
    const fields = prospectToPrefillFields(prospect);
    assert.equal(fields.firstName, "Jane");
    assert.equal(fields.desiredMoveInDate, "2026-08-01");
    assert.equal(fields.householdIncomeRangeLabel, "$5,000 – $7,499");
    assert.equal("preferredViewingNotes" in fields, false);
    assert.equal("message" in fields, false);
    assert.equal("monthlyIncome" in fields, false);
  });
});
