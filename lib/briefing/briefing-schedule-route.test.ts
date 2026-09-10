import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { GET, POST } from "@/app/api/internal/briefing/schedule/route";
import {
  BRIEFING_SCHEDULE_DECOMMISSIONED_MESSAGE,
  BRIEFING_SCHEDULE_DECOMMISSIONED_REASON,
} from "@/lib/jobs/policy";

const SECRET = "p0b-briefing-schedule-test-secret";

describe("decommissioned briefing schedule route", () => {
  const prevSecret = process.env.JOB_PROCESSOR_SECRET;
  const prevCron = process.env.CRON_SECRET;
  const prevBriefing = process.env.BRIEFING_AUTOMATION_ENABLED;

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.JOB_PROCESSOR_SECRET;
    else process.env.JOB_PROCESSOR_SECRET = prevSecret;
    if (prevCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevCron;
    if (prevBriefing === undefined) delete process.env.BRIEFING_AUTOMATION_ENABLED;
    else process.env.BRIEFING_AUTOMATION_ENABLED = prevBriefing;
  });

  it("rejects unauthenticated requests", async () => {
    process.env.JOB_PROCESSOR_SECRET = SECRET;
    const response = await POST(
      new Request("http://localhost/api/internal/briefing/schedule?slot=MORNING&dryRun=true", {
        method: "POST",
      }),
    );
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Unauthorized." });
  });

  it("returns 410 for authenticated calls even when automation env is on", async () => {
    process.env.JOB_PROCESSOR_SECRET = SECRET;
    process.env.BRIEFING_AUTOMATION_ENABLED = "true";

    const response = await POST(
      new Request("http://localhost/api/internal/briefing/schedule?slot=MORNING&dryRun=true", {
        method: "POST",
        headers: { authorization: `Bearer ${SECRET}` },
      }),
    );

    assert.equal(response.status, 410);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: BRIEFING_SCHEDULE_DECOMMISSIONED_MESSAGE,
      reason: BRIEFING_SCHEDULE_DECOMMISSIONED_REASON,
    });
  });

  it("returns the same decommissioned contract on GET", async () => {
    process.env.JOB_PROCESSOR_SECRET = SECRET;
    const response = await GET(
      new Request("http://localhost/api/internal/briefing/schedule", {
        headers: { authorization: `Bearer ${SECRET}` },
      }),
    );
    assert.equal(response.status, 410);
    const body = await response.json();
    assert.equal(body.reason, BRIEFING_SCHEDULE_DECOMMISSIONED_REASON);
    assert.equal(body.ok, false);
  });
});
