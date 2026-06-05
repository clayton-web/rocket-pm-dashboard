import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeOpenAiApiKey,
  resolveOpenAiApiKeyForMarketRent,
} from "./resolve-api-key";

describe("normalizeOpenAiApiKey", () => {
  it("accepts a well-formed sk- key", () => {
    const key = "sk-" + "a".repeat(48);
    assert.equal(normalizeOpenAiApiKey(key), key);
  });

  it("rejects empty, placeholder, and non-OpenAI keys", () => {
    assert.equal(normalizeOpenAiApiKey(""), undefined);
    assert.equal(normalizeOpenAiApiKey("your-api-key"), undefined);
    assert.equal(normalizeOpenAiApiKey("AIzaSyCVbjIhDGizJ8q9FBHbDiqUVL_Z4rgY_Tg"), undefined);
    assert.equal(normalizeOpenAiApiKey("sk-"), undefined);
  });

  it("prefers OPENAI_MARKET_RENT_API_KEY over OPENAI_API_KEY", () => {
    const rentKey = "sk-" + "b".repeat(48);
    const sharedKey = "sk-" + "c".repeat(48);
    assert.equal(
      resolveOpenAiApiKeyForMarketRent({
        OPENAI_MARKET_RENT_API_KEY: rentKey,
        OPENAI_API_KEY: sharedKey,
      }),
      rentKey,
    );
  });
});
