import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBriefingSettingsInput } from "@/lib/validation/briefing-settings";

const validInput = {
  enabled: true,
  morningEnabled: true,
  afternoonEnabled: false,
  timezone: "America/Vancouver",
  morningLocalTime: "07:00",
  afternoonLocalTime: "14:30",
  emailRecipients: "ops@example.com, alerts@example.com",
  autoSyncBeforeBriefing: true,
  lookbackHours: 12,
  autoBriefingEnabled: true,
};

describe("parseBriefingSettingsInput", () => {
  it("accepts valid settings payload", () => {
    const parsed = parseBriefingSettingsInput(validInput);
    assert.equal("error" in parsed, false);
    if ("error" in parsed) return;
    assert.equal(parsed.enabled, true);
    assert.deepEqual(parsed.emailRecipients, ["ops@example.com", "alerts@example.com"]);
    assert.equal(parsed.lookbackHours, 12);
  });

  it("rejects invalid morning time format", () => {
    const parsed = parseBriefingSettingsInput({
      ...validInput,
      morningLocalTime: "7am",
    });
    assert.deepEqual(parsed, { error: "Morning time must use HH:mm format." });
  });

  it("rejects lookback hours outside allowed range", () => {
    const parsed = parseBriefingSettingsInput({
      ...validInput,
      lookbackHours: 72,
    });
    assert.deepEqual(parsed, { error: "Lookback hours must be between 1 and 48." });
  });

  it("rejects missing timezone", () => {
    const parsed = parseBriefingSettingsInput({
      ...validInput,
      timezone: "",
    });
    assert.equal("error" in parsed, true);
  });
});
