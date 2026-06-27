import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BriefingSourceType } from "@prisma/client";
import { BRIEFING_SOURCE_MODULES, resolveEnabledBriefingModules } from "@/lib/briefing/sources/registry";
import type { BriefingSourceModule } from "@/lib/briefing/sources/types";

describe("briefing source registry", () => {
  it("registers email plus future stub modules", () => {
    const moduleIds = BRIEFING_SOURCE_MODULES.map((module) => module.moduleId);
    assert.deepEqual(moduleIds, [
      "email",
      "maintenance",
      "building",
      "leasing",
      "owner-rent-accounting",
      "buildium",
    ]);
  });

  it("enables only EMAIL in MVP production configuration", async () => {
    const enabled = await resolveEnabledBriefingModules({
      organizationId: "org_1",
      activeSourceTypes: [BriefingSourceType.EMAIL],
    });

    assert.equal(enabled.length, 1);
    assert.equal(enabled[0]?.moduleId, "email");
  });

  it("does not enable stub modules even when listed in activeSourceTypes", async () => {
    const enabled = await resolveEnabledBriefingModules({
      organizationId: "org_1",
      activeSourceTypes: [
        BriefingSourceType.EMAIL,
        BriefingSourceType.MAINTENANCE,
        BriefingSourceType.SYSTEM,
        BriefingSourceType.APPLICATION,
        BriefingSourceType.RENT_PAYMENT,
        BriefingSourceType.DEPOSIT,
      ],
    });

    assert.equal(enabled.length, 1);
    assert.equal(enabled[0]?.sourceType, BriefingSourceType.EMAIL);
  });

  it("respects custom module registry for tests", async () => {
    const rogueStub: BriefingSourceModule = {
      sourceType: BriefingSourceType.MAINTENANCE,
      moduleId: "rogue-maintenance",
      async isAvailable() {
        return true;
      },
      async collect() {
        return {
          sourceType: BriefingSourceType.MAINTENANCE,
          scannedCount: 99,
          skippedCount: 0,
          includedCount: 99,
          geminiCallCount: 0,
          warnings: [],
          moduleExecutiveLine: null,
          output: null,
          context: null,
        };
      },
    };

    const enabled = await resolveEnabledBriefingModules({
      organizationId: "org_1",
      activeSourceTypes: [BriefingSourceType.EMAIL, BriefingSourceType.MAINTENANCE],
      modules: [BRIEFING_SOURCE_MODULES[0]!, rogueStub],
    });

    assert.equal(enabled.length, 2);
    assert.equal(enabled[1]?.moduleId, "rogue-maintenance");
  });
});
