import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isStalePrismaConnectionError } from "./prisma-retry";

describe("isStalePrismaConnectionError", () => {
  it("detects Neon closed connection errors", () => {
    assert.equal(
      isStalePrismaConnectionError(
        new Error("Error in PostgreSQL connection: Error { kind: Closed, cause: None }"),
      ),
      true,
    );
  });

  it("ignores unrelated errors", () => {
    assert.equal(isStalePrismaConnectionError(new Error("Unique constraint failed")), false);
  });
});
