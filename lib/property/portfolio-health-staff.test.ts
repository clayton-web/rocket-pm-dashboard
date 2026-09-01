import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
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

describe("portfolio health loader wiring", () => {
  it("supplies updatedAt and a derived canEdit flag without an extra query", async () => {
    const source = await readFile(
      new URL("./portfolio-health-staff.ts", import.meta.url),
      "utf8",
    );

    assert.match(source, /updatedAt: property\.updatedAt/);
    assert.match(source, /canEdit: canManagePropertyFromContext\(ctx, property\.id\)/);

    // `listPropertiesForUser` already returns whole Property rows, so neither field may add a
    // query. Guard the existing fan-out: document counts, units, tenancies, tenancy contacts.
    const queryCount = source.match(/prisma\.\w+\.(findMany|groupBy)\(/g) ?? [];
    assert.equal(queryCount.length, 4, `unexpected query count: ${queryCount.join(", ")}`);
  });
});

describe("property mutation revalidation", () => {
  it("revalidates Property Health from every property server action", async () => {
    const source = await readFile(
      new URL("../../app/(dashboard)/properties/actions.ts", import.meta.url),
      "utf8",
    );

    assert.match(source, /revalidatePath\("\/properties\/health"\)/);

    const actions = source.match(/export async function (\w+)/g) ?? [];
    assert.ok(actions.length >= 6, `expected the property actions, found ${actions.join(", ")}`);

    // A handful of actions in this file only read — the duplicate-address advisory and the
    // cleanup-queue lookup. They have nothing to invalidate, so they are exempt, but they must
    // stay read-only for that exemption to hold.
    const readOnlyActions = new Set([
      "checkPropertyAddressDuplicatesAction",
      "resolveNextHealthCleanupPropertyAction",
    ]);

    for (const block of source.split(/(?=export async function )/).slice(1)) {
      const name = /export async function (\w+)/.exec(block)?.[1] ?? "unknown";
      const revalidates =
        /revalidatePropertyPaths\(/.test(block) ||
        /revalidatePath\("\/properties\/health"\)/.test(block);

      if (readOnlyActions.has(name)) {
        assert.ok(
          !/\b(update|create|delete|archive|restore)[A-Z]\w*\(/.test(block),
          `${name} is declared read-only but appears to mutate`,
        );
        continue;
      }

      assert.ok(revalidates, `${name} does not revalidate /properties/health`);
    }
  });

  it("skips revalidation when an address save changed nothing", async () => {
    const source = await readFile(
      new URL("../../app/(dashboard)/properties/actions.ts", import.meta.url),
      "utf8",
    );
    const block = source
      .split(/(?=export async function )/)
      .find((b) => b.includes("export async function updatePropertyAddressAction"));
    assert.ok(block, "updatePropertyAddressAction is missing");
    // Nothing moved, so there is no cache entry to invalidate.
    assert.match(block, /if \(result\.changed\) \{\s*revalidatePropertyPaths\(/);
  });

  it("revalidates Property Health from document actions", async () => {
    const source = await readFile(
      new URL("../../app/(dashboard)/properties/document-actions.ts", import.meta.url),
      "utf8",
    );
    assert.match(source, /revalidatePath\("\/properties\/health"\)/);
  });
});
