import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { INBOX_CLASSIFICATION_BATCH_SIZE } from "@/lib/ai/inbox-classification/constants";
import type { ClassifyInboxThreadResult } from "@/lib/ai/inbox-classification/classify-thread";

function capThreadIds(threadIds: string[]): string[] {
  return threadIds.slice(0, INBOX_CLASSIFICATION_BATCH_SIZE);
}

function shouldStopAfterResult(result: ClassifyInboxThreadResult): boolean {
  return result.status === "rate_limited";
}

describe("agent.triage batch handling", () => {
  it("caps payload thread ids to the configured batch size", () => {
    const threadIds = Array.from({ length: 12 }, (_, index) => `thread_${index}`);
    assert.deepEqual(capThreadIds(threadIds), [
      "thread_0",
      "thread_1",
      "thread_2",
      "thread_3",
      "thread_4",
    ]);
  });

  it("stops the batch when Gemini returns rate limited", () => {
    const results: ClassifyInboxThreadResult[] = [
      { status: "low_confidence", category: "TENANT_INQUIRY", confidence: 0.5, reason: "Maybe" },
      { status: "rate_limited", error: "quota exceeded" },
      { status: "failed", error: "should not run" },
    ];

    let processed = 0;
    let rateLimited = 0;

    for (const result of results) {
      processed += 1;
      if (shouldStopAfterResult(result)) {
        rateLimited += 1;
        break;
      }
    }

    assert.equal(processed, 2);
    assert.equal(rateLimited, 1);
  });
});
