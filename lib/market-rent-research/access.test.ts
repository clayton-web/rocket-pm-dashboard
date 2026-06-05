import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { StaffContext } from "@/lib/services/staff-context";
import {
  canRunMarketRentResearch,
  resolvePropertyDetailMarketRentResearch,
} from "./access";

const PROPERTY_ID = "prop_test";

function adminContext(): StaffContext {
  return {
    userId: "user_admin",
    organizationId: "org_test",
    organizationRole: "ADMIN",
    primaryRoleKey: "administrator",
    assignmentRolesByProperty: new Map(),
  };
}

function propertyManagerContext(): StaffContext {
  return {
    userId: "user_pm",
    organizationId: "org_test",
    organizationRole: "MEMBER",
    primaryRoleKey: "property_manager",
    assignmentRolesByProperty: new Map([[PROPERTY_ID, new Set(["property_manager"])]]),
  };
}

function fieldAgentContext(): StaffContext {
  return {
    userId: "user_agent",
    organizationId: "org_test",
    organizationRole: "MEMBER",
    primaryRoleKey: "field_agent",
    assignmentRolesByProperty: new Map([[PROPERTY_ID, new Set(["field_agent"])]]),
  };
}

describe("market rent research access", () => {
  it("does not mount panel props when feature flag is off", () => {
    assert.equal(
      resolvePropertyDetailMarketRentResearch({
        featureEnabled: false,
        canManagePropertyUnits: true,
      }),
      undefined,
    );
  });

  it("allows org admin when feature flag is on", () => {
    assert.equal(canRunMarketRentResearch(adminContext(), PROPERTY_ID, true), true);
    assert.deepEqual(
      resolvePropertyDetailMarketRentResearch({
        featureEnabled: true,
        canManagePropertyUnits: true,
      }),
      { enabled: true },
    );
  });

  it("allows property manager when feature flag is on", () => {
    assert.equal(canRunMarketRentResearch(propertyManagerContext(), PROPERTY_ID, true), true);
  });

  it("denies field agents when feature flag is on", () => {
    assert.equal(canRunMarketRentResearch(fieldAgentContext(), PROPERTY_ID, true), false);
    assert.equal(
      resolvePropertyDetailMarketRentResearch({
        featureEnabled: true,
        canManagePropertyUnits: false,
      }),
      undefined,
    );
  });
});
