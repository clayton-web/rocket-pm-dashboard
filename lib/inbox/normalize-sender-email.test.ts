import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeSenderEmail } from "./normalize-sender-email";

describe("normalizeSenderEmail", () => {
  it("lowercases and trims plain addresses", () => {
    assert.equal(normalizeSenderEmail("  Tenant@Example.COM "), "tenant@example.com");
  });

  it("extracts email from angle-bracket From headers", () => {
    assert.equal(
      normalizeSenderEmail("Jane Tenant <jane.tenant@example.com>"),
      "jane.tenant@example.com",
    );
  });

  it("rejects unknown and invalid values", () => {
    assert.equal(normalizeSenderEmail("unknown"), null);
    assert.equal(normalizeSenderEmail("not-an-email"), null);
    assert.equal(normalizeSenderEmail(""), null);
  });
});
