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
});
