import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { INBOX_CLASSIFICATION_BATCH_SIZE } from "./constants";

describe("INBOX_CLASSIFICATION_BATCH_SIZE", () => {
  it("uses a conservative Gemini-safe batch limit", () => {
    assert.equal(INBOX_CLASSIFICATION_BATCH_SIZE, 5);
    assert.ok(INBOX_CLASSIFICATION_BATCH_SIZE <= 5);
  });
});
