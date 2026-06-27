import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BriefingSlot } from "@prisma/client";
import {
  buildBriefingGenerateIdempotencyKey,
  buildBriefingScheduleIdempotencyKey,
} from "@/lib/briefing/briefing-idempotency";

describe("briefing idempotency keys", () => {
  it("builds stable schedule keys per org/slot/day", () => {
    const date = new Date("2026-06-26T14:30:00.000Z");
    const key = buildBriefingScheduleIdempotencyKey({
      organizationId: "org_1",
      slot: BriefingSlot.MORNING,
      scheduleDate: date,
    });
    assert.equal(key, "briefing-schedule:org_1:MORNING:2026-06-26");
  });

  it("builds stable generate keys per org/slot/windowEnd", () => {
    const windowEnd = new Date("2026-06-26T14:00:00.000Z");
    const key = buildBriefingGenerateIdempotencyKey({
      organizationId: "org_1",
      slot: BriefingSlot.AFTERNOON,
      windowEnd,
    });
    assert.equal(key, "briefing-generate:org_1:AFTERNOON:2026-06-26T14:00:00.000Z");
  });
});
