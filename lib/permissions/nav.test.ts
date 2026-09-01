import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { navigationItems } from "@/config/navigation";
import { canSeeNavItem, type EffectivePermissions } from "@/lib/permissions/nav";

function perms(overrides: Partial<EffectivePermissions> = {}): EffectivePermissions {
  return { role: "MEMBER", isPlatformOperator: false, ...overrides };
}

function navItem(id: string) {
  const item = navigationItems.find((entry) => entry.id === id);
  assert.ok(item, `missing navigation item ${id}`);
  return item;
}

describe("canSeeNavItem", () => {
  it("hides ADMIN-only items from members", () => {
    const adminOnly = navItem("nav-settings");
    assert.equal(adminOnly.minimumRole, "ADMIN");
    assert.equal(canSeeNavItem(adminOnly, perms({ role: "MEMBER" })), false);
    assert.equal(canSeeNavItem(adminOnly, perms({ role: "ADMIN" })), true);
    assert.equal(canSeeNavItem(adminOnly, perms({ role: "OWNER" })), true);
  });

  it("hides every gated item from users with no organization role", () => {
    assert.equal(canSeeNavItem(navItem("nav-inbox"), perms({ role: null })), false);
  });
});

describe("Property Health navigation access", () => {
  it("is visible to members, matching the loader's assignment-scoped access model", () => {
    const health = navItem("nav-properties-health");

    assert.equal(health.href, "/properties/health");
    assert.equal(health.enabled, true);
    assert.equal(health.minimumRole, "MEMBER");

    for (const role of ["MEMBER", "ADMIN", "OWNER"] as const) {
      assert.equal(canSeeNavItem(health, perms({ role })), true, role);
    }
  });

  it("stays hidden from signed-in users with no organization role", () => {
    assert.equal(canSeeNavItem(navItem("nav-properties-health"), perms({ role: null })), false);
  });
});
