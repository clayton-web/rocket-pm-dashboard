import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertOpenAiApiKeyConfigured,
  getOpenAiMarketRentModel,
  isOpenAiApiKeyConfigured,
} from "./openai-client";

describe("market rent openai client", () => {
  it("requires OPENAI_API_KEY for generation", () => {
    const originalKey = process.env.OPENAI_API_KEY;
    const originalOverride = process.env.OPENAI_MARKET_RENT_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MARKET_RENT_API_KEY;
    try {
      assert.equal(isOpenAiApiKeyConfigured(), false);
      assert.throws(() => assertOpenAiApiKeyConfigured(), /OPENAI_API_KEY/);
    } finally {
      if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalKey;
      if (originalOverride === undefined) delete process.env.OPENAI_MARKET_RENT_API_KEY;
      else process.env.OPENAI_MARKET_RENT_API_KEY = originalOverride;
    }
  });

  it("prefers OPENAI_MARKET_RENT_API_KEY when set", () => {
    const originalKey = process.env.OPENAI_API_KEY;
    const originalOverride = process.env.OPENAI_MARKET_RENT_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.OPENAI_MARKET_RENT_API_KEY = "sk-test-market-rent-preview-key";
    try {
      assert.equal(isOpenAiApiKeyConfigured(), true);
    } finally {
      if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalKey;
      if (originalOverride === undefined) delete process.env.OPENAI_MARKET_RENT_API_KEY;
      else process.env.OPENAI_MARKET_RENT_API_KEY = originalOverride;
    }
  });

  it("defaults model to gpt-4o-mini", () => {
    const original = process.env.OPENAI_MARKET_RENT_MODEL;
    delete process.env.OPENAI_MARKET_RENT_MODEL;
    try {
      assert.equal(getOpenAiMarketRentModel(), "gpt-4o-mini");
    } finally {
      if (original === undefined) delete process.env.OPENAI_MARKET_RENT_MODEL;
      else process.env.OPENAI_MARKET_RENT_MODEL = original;
    }
  });
});
