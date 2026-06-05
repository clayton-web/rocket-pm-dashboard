import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertOpenAiApiKeyConfigured,
  getOpenAiRentalAdModel,
} from "./openai-client";

describe("openai rental ad client", () => {
  it("defaults to a cost-efficient model", () => {
    const original = process.env.OPENAI_RENTAL_AD_MODEL;
    delete process.env.OPENAI_RENTAL_AD_MODEL;
    try {
      assert.equal(getOpenAiRentalAdModel(), "gpt-4o-mini");
    } finally {
      if (original === undefined) delete process.env.OPENAI_RENTAL_AD_MODEL;
      else process.env.OPENAI_RENTAL_AD_MODEL = original;
    }
  });

  it("requires OPENAI_API_KEY for generation", () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      assert.throws(() => assertOpenAiApiKeyConfigured(), /OPENAI_API_KEY/);
    } finally {
      if (original === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = original;
    }
  });
});
