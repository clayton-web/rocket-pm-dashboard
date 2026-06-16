import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPromptSyncAfterEnqueue,
  applyPromptSyncAfterRestart,
  schedulePromptGmailSyncProcessing,
} from "@/lib/gmail/trigger-sync-processing";

describe("applyPromptSyncAfterEnqueue", () => {
  it("schedules prompt processing when a new job is enqueued", () => {
    let scheduled = 0;
    applyPromptSyncAfterEnqueue(
      { jobId: "job_1", alreadyQueued: false },
      { schedule: () => { scheduled += 1; } },
    );
    assert.equal(scheduled, 1);
  });

  it("does not schedule processing when job is already queued", () => {
    let scheduled = 0;
    applyPromptSyncAfterEnqueue(
      { jobId: "job_1", alreadyQueued: true },
      { schedule: () => { scheduled += 1; } },
    );
    assert.equal(scheduled, 0);
  });
});

describe("applyPromptSyncAfterRestart", () => {
  it("schedules prompt processing when restart creates a new job", () => {
    let scheduled = 0;
    applyPromptSyncAfterRestart(
      { restarted: true, jobId: "job_2" },
      { schedule: () => { scheduled += 1; } },
    );
    assert.equal(scheduled, 1);
  });

  it("does not schedule processing when job is still running", () => {
    let scheduled = 0;
    applyPromptSyncAfterRestart(
      { restarted: false, reason: "still_running", jobId: "job_1" },
      { schedule: () => { scheduled += 1; } },
    );
    assert.equal(scheduled, 0);
  });
});

describe("schedulePromptGmailSyncProcessing", () => {
  it("registers an async callback with after() so redirect is not blocked", () => {
    let scheduledCallback: (() => void | Promise<void>) | null = null;

    schedulePromptGmailSyncProcessing({
      scheduleAfter: (callback) => {
        scheduledCallback = callback;
      },
    });

    assert.ok(scheduledCallback);
    assert.equal(typeof scheduledCallback, "function");
  });
});
