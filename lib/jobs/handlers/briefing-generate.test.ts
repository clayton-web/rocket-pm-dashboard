import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { handleBriefingGenerate } from "@/lib/jobs/handlers/briefing-generate";
import { BRIEFING_DECOMMISSIONED_REASON } from "@/lib/jobs/policy";
import type { BackgroundJob } from "@prisma/client";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "briefing-generate.ts"),
  "utf8",
);

describe("handleBriefingGenerate", () => {
  it("skips stale briefing.generate jobs without Gemini, persistence, or email", async () => {
    const job = {
      id: "job_stale_generate",
      organizationId: "org_1",
      jobType: "briefing.generate",
      payload: { slot: "MORNING", organizationId: "org_1", force: true },
      triggeredByUserId: "user_1",
    } as unknown as BackgroundJob;

    const result = await handleBriefingGenerate({ job, workerId: "test-worker" });

    assert.deepEqual(result.metadata, {
      skippedReason: BRIEFING_DECOMMISSIONED_REASON,
      decommissioned: true,
    });
    assert.doesNotMatch(source, /runBriefingGenerate/);
    assert.doesNotMatch(source, /sendBriefingEmail/);
    assert.doesNotMatch(source, /@google\/genai/);
    assert.doesNotMatch(source, /BriefingRun/);
  });

  it("processor fails decommissioned job types without retry", () => {
    const processor = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../processor.ts"),
      "utf8",
    );
    assert.match(processor, /assertJobTypeAllowedForPhase\(job\.jobType\)/);
    assert.match(processor, /markJobFailed\(job, message, result, false\)/);
  });
});
