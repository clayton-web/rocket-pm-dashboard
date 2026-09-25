import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectPhotoEnhancerBatch } from "./batch";
import { PHOTO_ENHANCER_MAX_BATCH } from "./image-limits";
import { enhancedDownloadFileName } from "./prepare-upload";

function jpeg(name: string, sizeBytes = 12_000) {
  return { fileName: name, contentType: "image/jpeg", sizeBytes };
}

describe("selectPhotoEnhancerBatch", () => {
  it("accepts multiple valid photos", () => {
    const result = selectPhotoEnhancerBatch([jpeg("a.jpg"), jpeg("b.png"), jpeg("c.webp")]);
    assert.deepEqual(result.acceptedIndexes, [0, 1, 2]);
    assert.equal(result.truncated, false);
    assert.equal(result.error, null);
  });

  it("caps a selection at 20 photos", () => {
    const inputs = Array.from({ length: 25 }, (_, index) => jpeg(`photo-${index}.jpg`));
    const result = selectPhotoEnhancerBatch(inputs);
    assert.equal(PHOTO_ENHANCER_MAX_BATCH, 20);
    assert.deepEqual(result.acceptedIndexes, Array.from({ length: 20 }, (_, index) => index));
    assert.equal(result.truncated, true);
    assert.match(result.error ?? "", /20/);
  });

  it("keeps valid photos when some files are the wrong type", () => {
    const result = selectPhotoEnhancerBatch([
      jpeg("a.jpg"),
      { fileName: "notes.pdf", contentType: "application/pdf", sizeBytes: 1000 },
      jpeg("b.jpg"),
    ]);
    assert.deepEqual(result.acceptedIndexes, [0, 2]);
    assert.equal(result.rejected.length, 1);
    assert.equal(result.rejected[0].index, 1);
    assert.ok(result.error);
  });

  it("rejects an empty selection", () => {
    const result = selectPhotoEnhancerBatch([]);
    assert.deepEqual(result.acceptedIndexes, []);
    assert.equal(result.error, "A photo file is required.");
  });

  it("builds an individual PNG download name for each original", () => {
    assert.equal(enhancedDownloadFileName("kitchen.jpg"), "kitchen-enhanced.png");
    assert.equal(enhancedDownloadFileName("living room.png"), "living-room-enhanced.png");
  });
});
