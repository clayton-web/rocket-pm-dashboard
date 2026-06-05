import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isEligibleForClassificationQueue,
  shouldAttemptInboxClassification,
  shouldPersistInboxClassification,
} from "./should-classify";

describe("shouldAttemptInboxClassification", () => {
  it("skips manual categories", () => {
    assert.equal(
      shouldAttemptInboxClassification({
        category: "TENANT_COMMUNICATION",
        categorySource: "manual",
      }),
      false,
    );
  });

  it("allows only uncategorized non-manual threads", () => {
    assert.equal(
      shouldAttemptInboxClassification({
        category: "UNCATEGORIZED",
        categorySource: null,
      }),
      true,
    );
    assert.equal(
      shouldAttemptInboxClassification({
        category: "STRATA",
        categorySource: "rule",
      }),
      false,
    );
  });
});

describe("isEligibleForClassificationQueue", () => {
  it("skips threads with a prior classification attempt", () => {
    assert.equal(
      isEligibleForClassificationQueue({
        category: "UNCATEGORIZED",
        categorySource: null,
        lastClassificationAttemptAt: new Date("2026-06-10T12:00:00.000Z"),
      }),
      false,
    );
  });

  it("allows uncategorized threads that have never been attempted", () => {
    assert.equal(
      isEligibleForClassificationQueue({
        category: "UNCATEGORIZED",
        categorySource: null,
        lastClassificationAttemptAt: null,
      }),
      true,
    );
  });
});

describe("shouldPersistInboxClassification", () => {
  it("rejects low confidence and uncategorized results", () => {
    assert.equal(
      shouldPersistInboxClassification({
        category: "STRATA",
        confidence: 0.69,
        reason: "Maybe strata",
      }),
      false,
    );
    assert.equal(
      shouldPersistInboxClassification({
        category: "UNCATEGORIZED",
        confidence: 0.95,
        reason: "Not enough evidence",
      }),
      false,
    );
  });

  it("accepts confident non-uncategorized results", () => {
    assert.equal(
      shouldPersistInboxClassification({
        category: "TENANT_INQUIRY",
        confidence: 0.82,
        reason: "Prospective renter asking about a showing.",
      }),
      true,
    );
  });
});
