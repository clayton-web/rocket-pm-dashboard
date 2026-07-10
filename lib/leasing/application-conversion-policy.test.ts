import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PLACEMENT_ONLY_MANAGED_CONVERSION_BLOCKED_MESSAGE,
  PlacementOnlyConversionBlockedError,
  assertCanConvertApplicationToManagedTenancy,
  getApplicationConversionPolicy,
} from "./application-conversion-policy";

describe("getApplicationConversionPolicy", () => {
  it("allows MANAGED approved applications", () => {
    const policy = getApplicationConversionPolicy({
      applicationStatus: "approved",
      hasTenancy: false,
      serviceRelationship: "MANAGED",
    });
    assert.equal(policy.allowed, true);
    assert.equal(policy.transitionPropertyToManaged, false);
    assert.equal(policy.staffStateLabel, "Ready to convert");
    assert.equal(policy.recommendedAction, "convert_managed_tenancy");
  });

  it("allows PRE_MANAGEMENT and requires transition", () => {
    const policy = getApplicationConversionPolicy({
      applicationStatus: "approved",
      hasTenancy: false,
      serviceRelationship: "PRE_MANAGEMENT",
    });
    assert.equal(policy.allowed, true);
    assert.equal(policy.transitionPropertyToManaged, true);
    assert.equal(policy.staffStateLabel, "Ready to convert + begin management");
  });

  it("blocks PLACEMENT_ONLY", () => {
    const policy = getApplicationConversionPolicy({
      applicationStatus: "approved",
      hasTenancy: false,
      serviceRelationship: "PLACEMENT_ONLY",
    });
    assert.equal(policy.allowed, false);
    assert.equal(policy.transitionPropertyToManaged, false);
    assert.equal(policy.recommendedAction, "await_placement_completion");
    assert.equal(policy.staffStateLabel, "Placement completion required");
    assert.match(policy.reason ?? "", /Tenant Placement Only/);
  });

  it("blocks when tenancy already exists", () => {
    const policy = getApplicationConversionPolicy({
      applicationStatus: "approved",
      hasTenancy: true,
      serviceRelationship: "MANAGED",
    });
    assert.equal(policy.allowed, false);
    assert.equal(policy.recommendedAction, "none");
  });

  it("blocks non-approved applications", () => {
    const policy = getApplicationConversionPolicy({
      applicationStatus: "submitted",
      hasTenancy: false,
      serviceRelationship: "MANAGED",
    });
    assert.equal(policy.allowed, false);
  });
});

describe("assertCanConvertApplicationToManagedTenancy", () => {
  it("throws PlacementOnlyConversionBlockedError for placement-only", () => {
    const policy = getApplicationConversionPolicy({
      applicationStatus: "approved",
      hasTenancy: false,
      serviceRelationship: "PLACEMENT_ONLY",
    });
    assert.throws(
      () => assertCanConvertApplicationToManagedTenancy(policy),
      (err: unknown) =>
        err instanceof PlacementOnlyConversionBlockedError &&
        err.message === PLACEMENT_ONLY_MANAGED_CONVERSION_BLOCKED_MESSAGE,
    );
  });

  it("does not throw when allowed", () => {
    const policy = getApplicationConversionPolicy({
      applicationStatus: "approved",
      hasTenancy: false,
      serviceRelationship: "MANAGED",
    });
    assert.doesNotThrow(() => assertCanConvertApplicationToManagedTenancy(policy));
  });
});
