import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assignmentSourceToLegacyString,
  deriveLegacyCategoryFromAssignments,
  deriveLegacyCategorySourceFromAssignments,
  getEffectiveCategories,
  isManualClassificationLocked,
  isUncategorizedForClassification,
  legacyStringToAssignmentSourceLabel,
  LEGACY_CATEGORY_PRIORITY,
} from "./thread-category-assignments";

describe("thread-category-assignments", () => {
  it("uses the approved legacy category priority order", () => {
    assert.deepEqual(LEGACY_CATEGORY_PRIORITY, [
      "LANDLORD_COMMUNICATION",
      "TENANT_COMMUNICATION",
      "STRATA",
      "TENANT_INQUIRY",
      "UNCATEGORIZED",
    ]);
  });

  it("derives the highest-priority legacy category from multiple assignments", () => {
    const category = deriveLegacyCategoryFromAssignments([
      { category: "STRATA", source: "RULE" },
      { category: "TENANT_COMMUNICATION", source: "RULE" },
      { category: "LANDLORD_COMMUNICATION", source: "RULE" },
    ]);

    assert.equal(category, "LANDLORD_COMMUNICATION");
  });

  it("maps assignment sources to legacy strings and labels", () => {
    assert.equal(assignmentSourceToLegacyString("MANUAL"), "manual");
    assert.equal(assignmentSourceToLegacyString("APPROVED_RULE"), "approved_rule");
    assert.equal(legacyStringToAssignmentSourceLabel("approved_rule"), "Approved rule");
    assert.equal(legacyStringToAssignmentSourceLabel("rule"), "Deterministic rule");
  });

  it("returns effective categories from assignments with legacy fallback", () => {
    assert.deepEqual(
      getEffectiveCategories(
        [
          { category: "STRATA", source: "RULE" },
          { category: "TENANT_COMMUNICATION", source: "RULE" },
        ],
        "UNCATEGORIZED",
      ),
      ["TENANT_COMMUNICATION", "STRATA"],
    );

    assert.deepEqual(getEffectiveCategories([], "STRATA"), ["STRATA"]);
  });

  it("detects manual locks and uncategorized eligibility", () => {
    const manual = [{ category: "STRATA", source: "MANUAL" as const }];
    assert.equal(isManualClassificationLocked(manual), true);
    assert.equal(
      isUncategorizedForClassification({
        assignments: manual,
        legacyCategory: "UNCATEGORIZED",
        legacySource: null,
      }),
      false,
    );

    assert.equal(
      isUncategorizedForClassification({
        assignments: [],
        legacyCategory: "UNCATEGORIZED",
        legacySource: null,
      }),
      true,
    );
  });

  it("derives legacy source from the winning category assignment", () => {
    const source = deriveLegacyCategorySourceFromAssignments([
      { category: "STRATA", source: "AI" },
      { category: "TENANT_COMMUNICATION", source: "RULE" },
    ]);

    assert.equal(source, "rule");
  });
});
