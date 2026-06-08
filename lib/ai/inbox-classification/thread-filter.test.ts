import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isEligibleForAttemptRecording,
  uncategorizedNonManualThreadWhere,
} from "./thread-filter";

describe("isEligibleForAttemptRecording", () => {
  it("allows UNCATEGORIZED threads where categorySource is null", () => {
    assert.equal(
      isEligibleForAttemptRecording({
        category: "UNCATEGORIZED",
        categorySource: null,
      }),
      true,
    );
  });

  it("protects manual categories from attempt recording", () => {
    assert.equal(
      isEligibleForAttemptRecording({
        category: "UNCATEGORIZED",
        categorySource: "manual",
      }),
      false,
    );
    assert.equal(
      isEligibleForAttemptRecording({
        category: "STRATA",
        categorySource: "manual",
      }),
      false,
    );
  });
});

describe("uncategorizedNonManualThreadWhere", () => {
  it("includes null categorySource in the writable filter", () => {
    assert.deepEqual(uncategorizedNonManualThreadWhere({
      threadId: "thread_1",
      organizationId: "org_1",
    }), {
      id: "thread_1",
      organizationId: "org_1",
      category: "UNCATEGORIZED",
      OR: [{ categorySource: null }, { categorySource: { not: "manual" } }],
    });
  });
});
