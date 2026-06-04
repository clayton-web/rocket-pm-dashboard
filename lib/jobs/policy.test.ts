import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  assertJobTypeAllowedForPhase,
  isAgentAutomationEnabled,
  verifyJobProcessorRequest,
} from "@/lib/jobs/policy";
import { JOB_TYPES } from "@/lib/jobs/types";

describe("job policy", () => {
  const prevAutomation = process.env.AGENT_AUTOMATION_ENABLED;
  const prevSecret = process.env.JOB_PROCESSOR_SECRET;

  afterEach(() => {
    if (prevAutomation === undefined) delete process.env.AGENT_AUTOMATION_ENABLED;
    else process.env.AGENT_AUTOMATION_ENABLED = prevAutomation;
    if (prevSecret === undefined) delete process.env.JOB_PROCESSOR_SECRET;
    else process.env.JOB_PROCESSOR_SECRET = prevSecret;
  });

  it("defaults agent automation to disabled", () => {
    delete process.env.AGENT_AUTOMATION_ENABLED;
    assert.equal(isAgentAutomationEnabled(), false);
  });

  it("allows system.noop in Phase 0", () => {
    assert.doesNotThrow(() => assertJobTypeAllowedForPhase(JOB_TYPES.SYSTEM_NOOP));
  });

  it("blocks agent.triage when automation is disabled", () => {
    process.env.AGENT_AUTOMATION_ENABLED = "false";
    assert.throws(
      () => assertJobTypeAllowedForPhase(JOB_TYPES.AGENT_TRIAGE),
      /AGENT_AUTOMATION_ENABLED/,
    );
  });

  it("blocks gmail.sync in Phase 0", () => {
    assert.throws(
      () => assertJobTypeAllowedForPhase(JOB_TYPES.GMAIL_SYNC),
      /not enabled in Phase 0/,
    );
  });

  it("verifies Bearer processor secret", () => {
    process.env.JOB_PROCESSOR_SECRET = "test-secret";
    const req = new Request("http://localhost/api/internal/jobs/process", {
      headers: { authorization: "Bearer test-secret" },
    });
    assert.equal(verifyJobProcessorRequest(req), true);
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

  it("still blocks agent jobs until Phase allows them", () => {
    assert.throws(
      () => assertJobTypeAllowedForPhase(JOB_TYPES.AGENT_DRAFT_GENERATE),
      /not enabled in Phase 0/,
    );
  });
});
