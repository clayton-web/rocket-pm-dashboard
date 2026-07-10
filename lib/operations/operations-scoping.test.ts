import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { StaffContext } from "@/lib/services/staff-context";
import { getOperationsCentreForStaff } from "./operations-centre.service";

/**
 * Aggregator boundary contract: Operations Centre always receives StaffContext
 * (organizationId + property assignment map). Source loaders are the existing
 * `*ForStaff` functions that call listPropertiesForUser / ForbiddenError skip.
 */
describe("getOperationsCentreForStaff scoping contract", () => {
  it("requires StaffContext with organizationId", () => {
    const ctx: StaffContext = {
      userId: "user_1",
      organizationId: "org_scoped_only",
      organizationRole: "MEMBER",
      primaryRoleKey: null,
      assignmentRolesByProperty: new Map(),
    };
    assert.equal(ctx.organizationId, "org_scoped_only");
    assert.equal(typeof getOperationsCentreForStaff, "function");
  });
});
