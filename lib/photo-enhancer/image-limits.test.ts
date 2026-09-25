import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PHOTO_ENHANCER_MAX_BATCH,
  PHOTO_ENHANCER_MAX_BYTES,
  PHOTO_ENHANCER_MAX_CONCURRENCY,
  PHOTO_ENHANCER_MAX_LONG_EDGE,
  PHOTO_ENHANCER_RATE_LIMIT_MAX,
  photoNeedsClientCompression,
  targetPhotoDimensions,
} from "./image-limits";

describe("targetPhotoDimensions", () => {
  it("leaves already-small images unchanged", () => {
    assert.deepEqual(targetPhotoDimensions(1600, 900), { width: 1600, height: 900 });
  });

  it("scales a landscape phone photo without cropping", () => {
    const result = targetPhotoDimensions(4032, 3024);
    assert.equal(result.width, PHOTO_ENHANCER_MAX_LONG_EDGE);
    assert.equal(result.height, Math.round(3024 * (PHOTO_ENHANCER_MAX_LONG_EDGE / 4032)));
    assert.ok(result.width / result.height - 4032 / 3024 < 0.01);
  });

  it("scales a portrait photo on the long edge", () => {
    const result = targetPhotoDimensions(3024, 4032);
    assert.equal(result.height, PHOTO_ENHANCER_MAX_LONG_EDGE);
    assert.equal(result.width, Math.round(3024 * (PHOTO_ENHANCER_MAX_LONG_EDGE / 4032)));
  });
});

describe("photoNeedsClientCompression", () => {
  it("compresses oversized files even when dimensions are small", () => {
    assert.equal(photoNeedsClientCompression(PHOTO_ENHANCER_MAX_BYTES + 1, 800, 600), true);
  });

  it("compresses long-edge phone dimensions even when the file is small", () => {
    assert.equal(photoNeedsClientCompression(200_000, 4032, 3024), true);
  });

  it("skips already-safe files", () => {
    assert.equal(photoNeedsClientCompression(400_000, 1600, 900), false);
  });
});

describe("photo enhancer batch limits", () => {
  it("allows 20 photos with 3 concurrent requests and enough rate-limit headroom", () => {
    assert.equal(PHOTO_ENHANCER_MAX_BATCH, 20);
    assert.equal(PHOTO_ENHANCER_MAX_CONCURRENCY, 3);
    assert.ok(PHOTO_ENHANCER_RATE_LIMIT_MAX >= PHOTO_ENHANCER_MAX_BATCH);
  });
});
