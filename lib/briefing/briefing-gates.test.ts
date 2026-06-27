import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import { BriefingSourceType } from "@prisma/client";
import {
  checkBriefingOrgGates,
  isEmailBriefingSourceActive,
  resolveMvpActiveSourceTypes,
} from "@/lib/briefing/briefing-gates";

describe("briefing org gates", () => {
  const prev = process.env.BRIEFING_AUTOMATION_ENABLED;

  afterEach(() => {
    if (prev === undefined) delete process.env.BRIEFING_AUTOMATION_ENABLED;
    else process.env.BRIEFING_AUTOMATION_ENABLED = prev;
  });

  it("ignores future financial source types unless EMAIL is active", () => {
    const effective = resolveMvpActiveSourceTypes([
      BriefingSourceType.RENT_PAYMENT,
      BriefingSourceType.DEPOSIT,
    ]);
    assert.deepEqual(effective, []);
    assert.equal(
      isEmailBriefingSourceActive([BriefingSourceType.RENT_PAYMENT, BriefingSourceType.DEPOSIT]),
      false,
    );
  });

  it("allows EMAIL when mixed with future source types", () => {
    const effective = resolveMvpActiveSourceTypes([
      BriefingSourceType.EMAIL,
      BriefingSourceType.RENT_PAYMENT,
    ]);
    assert.deepEqual(effective, [BriefingSourceType.EMAIL]);
    assert.equal(isEmailBriefingSourceActive(effective), true);
  });

  it("blocks org when briefing automation env is disabled", () => {
    process.env.BRIEFING_AUTOMATION_ENABLED = "false";
    const result = checkBriefingOrgGates({
      settings: {
        enabled: true,
        morningEnabled: true,
        afternoonEnabled: true,
        activeSourceTypes: [BriefingSourceType.EMAIL],
        autoSyncBeforeBriefing: true,
        lookbackHours: 12,
        timezone: "America/Vancouver",
        morningLocalTime: "07:00",
        afternoonLocalTime: "14:00",
        emailRecipients: [],
      },
      policy: {
        autoBriefingEnabled: true,
        maxBriefingRunsPerDay: 2,
        maxBriefingGeminiCallsPerRun: 5,
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "briefing_automation_disabled");
    }
  });

  it("blocks org when only Buildium-style source types are configured", () => {
    process.env.BRIEFING_AUTOMATION_ENABLED = "true";
    const result = checkBriefingOrgGates({
      settings: {
        enabled: true,
        morningEnabled: true,
        afternoonEnabled: true,
        activeSourceTypes: [BriefingSourceType.RENT_PAYMENT, BriefingSourceType.DEPOSIT],
        autoSyncBeforeBriefing: true,
        lookbackHours: 12,
        timezone: "America/Vancouver",
        morningLocalTime: "07:00",
        afternoonLocalTime: "14:00",
        emailRecipients: [],
      },
      policy: {
        autoBriefingEnabled: true,
        maxBriefingRunsPerDay: 2,
        maxBriefingGeminiCallsPerRun: 5,
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "email_source_inactive");
    }
  });
});
