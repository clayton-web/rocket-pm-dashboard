import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("photo enhancer route boundary", () => {
  it("is not added to middleware public-route exemptions", () => {
    const source = readFileSync(join(repoRoot, "middleware.ts"), "utf8");
    assert.doesNotMatch(source, /photo-enhancer/);
  });

  it("keeps the staff enhance route on the existing per-photo endpoint", () => {
    const source = readFileSync(join(repoRoot, "app/api/photo-enhancer/enhance/route.ts"), "utf8");
    assert.match(source, /PHOTO_ENHANCER_RATE_LIMIT_MAX/);
    assert.match(source, /enhanceRealEstatePhoto/);
    assert.doesNotMatch(source, /prisma/i);
    assert.doesNotMatch(source, /S3_/);
  });
});
