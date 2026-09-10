import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  assertJobTypeAllowedForPhase,
  getJobProcessorSecret,
  isAgentAutomationEnabled,
  isAutomatedBriefingScheduleEnabled,
  isBriefingExecutionEnabled,
  verifyJobProcessorRequest,
} from "@/lib/jobs/policy";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { JOB_TYPES } from "@/lib/jobs/types";

describe("job policy", () => {
  const prevAutomation = process.env.AGENT_AUTOMATION_ENABLED;
  const prevSecret = process.env.JOB_PROCESSOR_SECRET;
  const prevCronSecret = process.env.CRON_SECRET;

  afterEach(() => {
    if (prevAutomation === undefined) delete process.env.AGENT_AUTOMATION_ENABLED;
    else process.env.AGENT_AUTOMATION_ENABLED = prevAutomation;
    if (prevSecret === undefined) delete process.env.JOB_PROCESSOR_SECRET;
    else process.env.JOB_PROCESSOR_SECRET = prevSecret;
    if (prevCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevCronSecret;
  });

  it("defaults agent automation to disabled", () => {
    delete process.env.AGENT_AUTOMATION_ENABLED;
    assert.equal(isAgentAutomationEnabled(), false);
  });

  it("allows system.noop", () => {
    assert.doesNotThrow(() => assertJobTypeAllowedForPhase(JOB_TYPES.SYSTEM_NOOP));
  });

  it("allows gmail.sync in Phase 1", () => {
    assert.doesNotThrow(() => assertJobTypeAllowedForPhase(JOB_TYPES.GMAIL_SYNC));
  });

  it("decommissions automated briefing.schedule regardless of env flag", () => {
    process.env.BRIEFING_AUTOMATION_ENABLED = "true";
    assert.equal(isAutomatedBriefingScheduleEnabled(), false);
    assert.throws(
      () => assertJobTypeAllowedForPhase(JOB_TYPES.BRIEFING_SCHEDULE),
      /decommissioned/,
    );
  });

  it("blocks agent.triage when automation is disabled", () => {
    process.env.AGENT_AUTOMATION_ENABLED = "false";
    assert.throws(
      () => assertJobTypeAllowedForPhase(JOB_TYPES.AGENT_TRIAGE),
      /AGENT_AUTOMATION_ENABLED/,
    );
  });

  it("decommissions briefing.generate regardless of env flag", () => {
    process.env.BRIEFING_AUTOMATION_ENABLED = "true";
    assert.equal(isBriefingExecutionEnabled(), false);
    assert.throws(
      () => assertJobTypeAllowedForPhase(JOB_TYPES.BRIEFING_GENERATE),
      /decommissioned/,
    );
  });

  it("generic enqueue rejects briefing.generate before creating a job", async () => {
    await assert.rejects(
      () =>
        enqueueJob({
          organizationId: "org_1",
          jobType: JOB_TYPES.BRIEFING_GENERATE,
          idempotencyKey: "p0c-generate-should-not-create",
          triggerSource: "USER",
          triggeredByUserId: "user_1",
        }),
      /decommissioned/,
    );
  });

  it("generic enqueue still rejects briefing.schedule", async () => {
    await assert.rejects(
      () =>
        enqueueJob({
          organizationId: "org_1",
          jobType: JOB_TYPES.BRIEFING_SCHEDULE,
          idempotencyKey: "p0c-schedule-should-not-create",
          triggerSource: "CRON",
        }),
      /decommissioned/,
    );
  });

  it("verifies Bearer processor secret", () => {
    process.env.JOB_PROCESSOR_SECRET = "test-secret";
    const req = new Request("http://localhost/api/internal/jobs/process", {
      headers: { authorization: "Bearer test-secret" },
    });
    assert.equal(verifyJobProcessorRequest(req), true);
  });

  it("verifies Bearer CRON_SECRET", () => {
    delete process.env.JOB_PROCESSOR_SECRET;
    process.env.CRON_SECRET = "cron-secret";
    const req = new Request("http://localhost/api/internal/jobs/process", {
      headers: { authorization: "Bearer cron-secret" },
    });
    assert.equal(verifyJobProcessorRequest(req), true);
  });

  it("verifies x-cron-secret header", () => {
    process.env.JOB_PROCESSOR_SECRET = "test-secret";
    const req = new Request("http://localhost/api/internal/jobs/process", {
      headers: { "x-cron-secret": "test-secret" },
    });
    assert.equal(verifyJobProcessorRequest(req), true);
  });

  it("returns null when no processor secret is configured", () => {
    delete process.env.JOB_PROCESSOR_SECRET;
    delete process.env.CRON_SECRET;
    assert.equal(getJobProcessorSecret(), null);
  });

  it("rejects missing processor secret", () => {
    process.env.JOB_PROCESSOR_SECRET = "test-secret";
    const req = new Request("http://localhost/api/internal/jobs/process");
    assert.equal(verifyJobProcessorRequest(req), false);
  });
});

describe("job policy — agent automation enabled", () => {
  const prevAutomation = process.env.AGENT_AUTOMATION_ENABLED;

  beforeEach(() => {
    process.env.AGENT_AUTOMATION_ENABLED = "true";
  });

  afterEach(() => {
    if (prevAutomation === undefined) delete process.env.AGENT_AUTOMATION_ENABLED;
    else process.env.AGENT_AUTOMATION_ENABLED = prevAutomation;
  });

  it("allows agent.triage when automation is enabled", () => {
    assert.doesNotThrow(() => assertJobTypeAllowedForPhase(JOB_TYPES.AGENT_TRIAGE));
  });

  it("still blocks unregistered agent jobs", () => {
    assert.throws(
      () => assertJobTypeAllowedForPhase(JOB_TYPES.AGENT_DRAFT_GENERATE),
      /not enabled/,
    );
  });
});

describe("job policy — briefing automation enabled", () => {
  const prevBriefing = process.env.BRIEFING_AUTOMATION_ENABLED;

  beforeEach(() => {
    process.env.BRIEFING_AUTOMATION_ENABLED = "true";
  });

  afterEach(() => {
    if (prevBriefing === undefined) delete process.env.BRIEFING_AUTOMATION_ENABLED;
    else process.env.BRIEFING_AUTOMATION_ENABLED = prevBriefing;
  });

  it("still rejects briefing.generate when the legacy env flag is on", () => {
    assert.throws(
      () => assertJobTypeAllowedForPhase(JOB_TYPES.BRIEFING_GENERATE),
      /decommissioned/,
    );
  });

  it("still rejects briefing.schedule when the legacy env flag is on", () => {
    assert.throws(
      () => assertJobTypeAllowedForPhase(JOB_TYPES.BRIEFING_SCHEDULE),
      /decommissioned/,
    );
  });
});
