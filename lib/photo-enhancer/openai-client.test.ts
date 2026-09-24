import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertOpenAiApiKeyConfigured,
  DEFAULT_PHOTO_ENHANCER_MODEL,
  getOpenAiPhotoEnhancerModel,
  shouldSendInputFidelity,
} from "./openai-client";

describe("photo enhancer openai client", () => {
  it("defaults to the current official edit-precision model", () => {
    const original = process.env.OPENAI_PHOTO_ENHANCER_MODEL;
    delete process.env.OPENAI_PHOTO_ENHANCER_MODEL;
    try {
      assert.equal(getOpenAiPhotoEnhancerModel(), DEFAULT_PHOTO_ENHANCER_MODEL);
      assert.equal(getOpenAiPhotoEnhancerModel(), "gpt-image-2.5-sunburst");
    } finally {
      if (original === undefined) delete process.env.OPENAI_PHOTO_ENHANCER_MODEL;
      else process.env.OPENAI_PHOTO_ENHANCER_MODEL = original;
    }
  });

  it("uses OPENAI_PHOTO_ENHANCER_MODEL when set", () => {
    const original = process.env.OPENAI_PHOTO_ENHANCER_MODEL;
    process.env.OPENAI_PHOTO_ENHANCER_MODEL = "gpt-image-2.5-flare";
    try {
      assert.equal(getOpenAiPhotoEnhancerModel(), "gpt-image-2.5-flare");
    } finally {
      if (original === undefined) delete process.env.OPENAI_PHOTO_ENHANCER_MODEL;
      else process.env.OPENAI_PHOTO_ENHANCER_MODEL = original;
    }
  });

  it("requires OPENAI_API_KEY", () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      assert.throws(() => assertOpenAiApiKeyConfigured(), /OPENAI_API_KEY/);
    } finally {
      if (original === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = original;
    }
  });

  it("sends input_fidelity only for GPT Image 1 family models", () => {
    assert.equal(shouldSendInputFidelity("gpt-image-1"), true);
    assert.equal(shouldSendInputFidelity("gpt-image-1.5"), true);
    assert.equal(shouldSendInputFidelity("gpt-image-1-mini"), true);
    assert.equal(shouldSendInputFidelity("gpt-image-2"), false);
    assert.equal(shouldSendInputFidelity("gpt-image-2.5-sunburst"), false);
    assert.equal(shouldSendInputFidelity("gpt-image-2.5-flare"), false);
  });
});
