import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseProspectPrefillQuery } from "./prospect-prefill";

describe("parseProspectPrefillQuery", () => {
  it("parses required query params", () => {
    const params = new URLSearchParams({
      propertyId: "prop_1",
      unitId: "unit_1",
      email: " Test@Example.com ",
    });
    const parsed = parseProspectPrefillQuery(params);
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.propertyId, "prop_1");
    assert.equal(parsed.unitId, "unit_1");
    assert.equal(parsed.email, "Test@Example.com");
  });

  it("requires propertyId, unitId, and email", () => {
    assert.ok("error" in parseProspectPrefillQuery(new URLSearchParams()));
    assert.ok(
      "error" in parseProspectPrefillQuery(
        new URLSearchParams({ propertyId: "p", unitId: "u" }),
      ),
    );
  });
});
