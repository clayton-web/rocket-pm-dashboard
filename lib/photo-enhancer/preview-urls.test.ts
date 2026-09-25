import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { revokeObjectUrl, revokePhotoPreviewUrlList, revokePhotoPreviewUrls } from "./preview-urls";

describe("photo preview URL cleanup", () => {
  it("revokes original and enhanced URLs for a photo", () => {
    const revoked: string[] = [];
    const originalRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = (url: string) => {
      revoked.push(url);
    };

    try {
      revokePhotoPreviewUrls({
        originalUrl: "blob:original-1",
        enhancedUrl: "blob:enhanced-1",
      });
      assert.deepEqual(revoked, ["blob:original-1", "blob:enhanced-1"]);
    } finally {
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it("revokes every URL when a batch is cleared or Start Again runs", () => {
    const revoked: string[] = [];
    const originalRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = (url: string) => {
      revoked.push(url);
    };

    try {
      revokePhotoPreviewUrlList([
        { originalUrl: "blob:a", enhancedUrl: "blob:a-out" },
        { originalUrl: "blob:b", enhancedUrl: null },
        { originalUrl: "blob:c", enhancedUrl: "blob:c-out" },
      ]);
      assert.deepEqual(revoked, ["blob:a", "blob:a-out", "blob:b", "blob:c", "blob:c-out"]);
    } finally {
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it("ignores empty replacements", () => {
    const revoked: string[] = [];
    const originalRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = (url: string) => {
      revoked.push(url);
    };

    try {
      revokeObjectUrl(null);
      revokeObjectUrl(undefined);
      revokePhotoPreviewUrls({});
      assert.deepEqual(revoked, []);
    } finally {
      URL.revokeObjectURL = originalRevoke;
    }
  });
});
