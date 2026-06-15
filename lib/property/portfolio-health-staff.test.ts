import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterPropertiesForPortfolioHealth } from "@/lib/property/portfolio-health-staff";

describe("filterPropertiesForPortfolioHealth", () => {
  it("excludes archived properties from the health queue scope", () => {
    const filtered = filterPropertiesForPortfolioHealth([
      { id: "active", isActive: true },
      { id: "archived", isActive: false },
    ]);
    assert.deepEqual(
      filtered.map((property) => property.id),
      ["active"],
    );
  });
});
