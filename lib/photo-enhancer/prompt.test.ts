import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PHOTO_ENHANCER_PROMPT } from "./prompt";
import { enhancedDownloadFileName } from "./prepare-upload";

describe("PHOTO_ENHANCER_PROMPT", () => {
  it("is a non-empty server-owned contract", () => {
    assert.ok(PHOTO_ENHANCER_PROMPT.length > 80);
  });

  it("allows photographic correction and forbids property changes", () => {
    const text = PHOTO_ENHANCER_PROMPT.toLowerCase();
    for (const allowed of ["exposure", "white balance", "perspective", "lens-distortion"]) {
      assert.match(text, new RegExp(allowed));
    }
    for (const forbidden of ["do not add", "do not stage", "do not renovate", "do not invent"]) {
      assert.match(text, new RegExp(forbidden));
    }
    assert.match(text, /same property/);
  });
});

describe("enhancedDownloadFileName", () => {
  it("turns the original name into a png download name", () => {
    assert.equal(enhancedDownloadFileName("Kitchen South.jpg"), "Kitchen-South-enhanced.png");
    assert.equal(enhancedDownloadFileName(""), "photo-enhanced.png");
  });
});
