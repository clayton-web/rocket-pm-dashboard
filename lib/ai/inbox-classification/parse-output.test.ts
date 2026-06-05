import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseInboxClassificationOutput } from "./parse-output";

describe("parseInboxClassificationOutput", () => {
  it("parses valid classification JSON", () => {
    const parsed = parseInboxClassificationOutput({
      category: "TENANT_COMMUNICATION",
      confidence: 0.91,
      reason: "Existing tenant reporting a maintenance issue.",
    });

    assert.deepEqual(parsed, {
      category: "TENANT_COMMUNICATION",
      confidence: 0.91,
      reason: "Existing tenant reporting a maintenance issue.",
    });
  });

  it("rejects invalid categories and confidence", () => {
    assert.equal(
      parseInboxClassificationOutput({
        category: "INVALID",
        confidence: 0.9,
        reason: "test",
      }),
      null,
    );
    assert.equal(
      parseInboxClassificationOutput({
        category: "STRATA",
        confidence: 1.2,
        reason: "test",
      }),
      null,
    );
  });
});
