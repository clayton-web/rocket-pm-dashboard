import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PHOTO_ENHANCER_MAX_BYTES } from "./image-limits";
import { detectAllowedImageType, validatePhotoEnhancerUpload } from "./validate-upload";

const JPEG_HEADER = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_HEADER = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP_HEADER = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

describe("detectAllowedImageType", () => {
  it("recognizes jpeg, png, and webp magic bytes", () => {
    assert.equal(detectAllowedImageType(JPEG_HEADER), "image/jpeg");
    assert.equal(detectAllowedImageType(PNG_HEADER), "image/png");
    assert.equal(detectAllowedImageType(WEBP_HEADER), "image/webp");
  });

  it("rejects unknown bytes", () => {
    assert.equal(detectAllowedImageType(Uint8Array.from([0x25, 0x50, 0x44, 0x46])), null);
  });
});

describe("validatePhotoEnhancerUpload", () => {
  it("accepts allowed types from the client without bytes", () => {
    const result = validatePhotoEnhancerUpload({
      fileName: "living-room.jpg",
      contentType: "image/jpeg",
      sizeBytes: 120_000,
    });
    assert.deepEqual(result, { ok: true, contentType: "image/jpeg" });
  });

  it("accepts a png/webp extension when the browser omits MIME", () => {
    assert.equal(
      validatePhotoEnhancerUpload({
        fileName: "kitchen.webp",
        contentType: "",
        sizeBytes: 80_000,
      }).ok,
      true,
    );
  });

  it("rejects empty files, unsupported types, and oversized uploads", () => {
    const empty = validatePhotoEnhancerUpload({
      fileName: "empty.jpg",
      contentType: "image/jpeg",
      sizeBytes: 0,
    });
    const unsupported = validatePhotoEnhancerUpload({
      fileName: "notes.pdf",
      contentType: "application/pdf",
      sizeBytes: 12_000,
    });
    const oversized = validatePhotoEnhancerUpload({
      fileName: "huge.jpg",
      contentType: "image/jpeg",
      sizeBytes: PHOTO_ENHANCER_MAX_BYTES + 1,
    });
    assert.equal(empty.ok, false);
    assert.equal(unsupported.ok, false);
    assert.equal(oversized.ok, false);
    if (!empty.ok) assert.equal(empty.code, "empty_file");
    if (!unsupported.ok) assert.equal(unsupported.code, "unsupported_type");
    if (!oversized.ok) assert.equal(oversized.code, "file_too_large");
  });

  it("trusts magic bytes and rejects a MIME/content mismatch", () => {
    const ok = validatePhotoEnhancerUpload({
      fileName: "shot.bin",
      contentType: "application/octet-stream",
      sizeBytes: JPEG_HEADER.byteLength,
      bytes: JPEG_HEADER,
    });
    assert.deepEqual(ok, { ok: true, contentType: "image/jpeg" });

    const mismatch = validatePhotoEnhancerUpload({
      fileName: "shot.png",
      contentType: "image/png",
      sizeBytes: JPEG_HEADER.byteLength,
      bytes: JPEG_HEADER,
    });
    assert.equal(mismatch.ok, false);
    if (!mismatch.ok) {
      assert.equal(mismatch.code, "unsupported_type");
    }
  });

  it("can skip the size cap for client-side preview before compression", () => {
    const result = validatePhotoEnhancerUpload({
      fileName: "phone.jpg",
      contentType: "image/jpeg",
      sizeBytes: PHOTO_ENHANCER_MAX_BYTES + 1,
      enforceSize: false,
    });
    assert.deepEqual(result, { ok: true, contentType: "image/jpeg" });
  });
});
