import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPropertyServiceRelationship,
  isOngoingManagementRelationship,
  isPropertyServiceRelationship,
} from "./service-relationship";

describe("property service relationship helpers", () => {
  it("recognizes valid enum values", () => {
    assert.equal(isPropertyServiceRelationship("MANAGED"), true);
    assert.equal(isPropertyServiceRelationship("PRE_MANAGEMENT"), true);
    assert.equal(isPropertyServiceRelationship("PLACEMENT_ONLY"), true);
    assert.equal(isPropertyServiceRelationship("ACTIVE"), false);
  });

  it("formats short labels", () => {
    assert.equal(formatPropertyServiceRelationship("PLACEMENT_ONLY"), "Placement only");
    assert.equal(formatPropertyServiceRelationship("PRE_MANAGEMENT"), "Pre-management");
  });

  it("treats managed and pre-management as ongoing management intent", () => {
    assert.equal(isOngoingManagementRelationship("MANAGED"), true);
    assert.equal(isOngoingManagementRelationship("PRE_MANAGEMENT"), true);
    assert.equal(isOngoingManagementRelationship("PLACEMENT_ONLY"), false);
  });
});
