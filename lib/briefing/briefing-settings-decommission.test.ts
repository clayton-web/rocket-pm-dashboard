import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { upsertBriefingSettings } from "@/lib/briefing/briefing-settings.service";
import { briefingDecommissionedActionResult } from "@/lib/jobs/policy";
import type { StaffContext } from "@/lib/services/staff-context";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("Briefing settings decommission", () => {
  it("rejects settings writes before any policy or settings mutation", async () => {
    const ctx = {
      organizationId: "org_1",
      userId: "user_1",
    } as StaffContext;

    await assert.rejects(
      () =>
        upsertBriefingSettings(ctx, {
          enabled: true,
          morningEnabled: true,
          afternoonEnabled: true,
          timezone: "America/Vancouver",
          morningLocalTime: "07:00",
          afternoonLocalTime: "14:00",
          emailRecipients: ["ops@example.com"],
          autoSyncBeforeBriefing: true,
          lookbackHours: 12,
          autoBriefingEnabled: true,
        }),
      /decommissioned/i,
    );
  });

  it("settings action and page no longer expose an editor", () => {
    const actions = readFileSync(join(root, "app/(dashboard)/briefing/actions.ts"), "utf8");
    assert.match(actions, /updateBriefingSettingsAction/);
    assert.match(actions, /briefingDecommissionedActionResult/);
    assert.doesNotMatch(actions, /upsertBriefingSettings/);
    assert.doesNotMatch(actions, /parseBriefingSettingsInput/);

    const page = readFileSync(join(root, "app/(dashboard)/briefing/settings/page.tsx"), "utf8");
    assert.doesNotMatch(page, /BriefingSettingsForm/);
    assert.match(page, /Daily Briefing is decommissioned/);

    assert.deepEqual(briefingDecommissionedActionResult().reason, "briefing_decommissioned");
  });
});
