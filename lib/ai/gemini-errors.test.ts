import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isGeminiRateLimitError } from "./gemini-errors";

describe("isGeminiRateLimitError", () => {
  it("detects Gemini 429 quota errors", () => {
    const error = new Error(
      'Gemini request failed: {"error":{"code":429,"message":"You exceeded your current quota","status":"RESOURCE_EXHAUSTED"}}',
    );
    assert.equal(isGeminiRateLimitError(error), true);
  });

  it("ignores non-rate-limit Gemini failures", () => {
    const error = new Error(
      'Gemini request failed: {"error":{"code":403,"message":"Your API key was reported as leaked","status":"PERMISSION_DENIED"}}',
    );
    assert.equal(isGeminiRateLimitError(error), false);
  });
});
