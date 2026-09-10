import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canManagePropertyFromContext } from "@/lib/services/property-access";
import type { StaffContext } from "@/lib/services/staff-context";

const PROPERTY_ID = "prop_1";

function context(overrides: Partial<StaffContext> = {}): StaffContext {
  return {
    userId: "user_1",
    organizationId: "org_1",
    organizationRole: "MEMBER",
    primaryRoleKey: "property_manager",
    assignmentRolesByProperty: new Map(),
    ...overrides,
  };
}

describe("canManagePropertyFromContext", () => {
  it("allows organization admins and owners on any property", () => {
    for (const organizationRole of ["ADMIN", "OWNER"] as const) {
      assert.equal(
        canManagePropertyFromContext(context({ organizationRole }), PROPERTY_ID),
        true,
        organizationRole,
      );
    }
  });

  it("allows a member holding property_manager on that property", () => {
    const ctx = context({
      assignmentRolesByProperty: new Map([[PROPERTY_ID, new Set(["property_manager"])]]),
    });
    assert.equal(canManagePropertyFromContext(ctx, PROPERTY_ID), true);
  });

  it("denies a member assigned only as a field agent", () => {
    const ctx = context({
      assignmentRolesByProperty: new Map([[PROPERTY_ID, new Set(["field_agent"])]]),
    });
    assert.equal(canManagePropertyFromContext(ctx, PROPERTY_ID), false);
  });

  it("denies a member with no assignment on that property", () => {
    const ctx = context({
      assignmentRolesByProperty: new Map([["other_prop", new Set(["property_manager"])]]),
    });
    assert.equal(canManagePropertyFromContext(ctx, PROPERTY_ID), false);
  });

  it("denies tenant accounts outright", () => {
    const ctx = context({
      primaryRoleKey: "tenant",
      organizationRole: "ADMIN",
      assignmentRolesByProperty: new Map([[PROPERTY_ID, new Set(["property_manager"])]]),
    });
    assert.equal(canManagePropertyFromContext(ctx, PROPERTY_ID), false);
  });
});
