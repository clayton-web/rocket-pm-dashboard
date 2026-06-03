import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeInspectionNotes,
  normalizeInspectionReportUrl,
} from "./move-out-inspection";

describe("normalizeInspectionReportUrl", () => {
  it("accepts https URLs", () => {
    assert.equal(
      normalizeInspectionReportUrl("https://example.com/report.pdf"),
      "https://example.com/report.pdf",
    );
  });

  it("rejects invalid URLs", () => {
    assert.throws(() => normalizeInspectionReportUrl("not-a-url"), /valid URL/);
  });

  it("rejects non-http schemes", () => {
    assert.throws(() => normalizeInspectionReportUrl("ftp://example.com/x"), /http or https/);
  });

  it("treats blank as null", () => {
    assert.equal(normalizeInspectionReportUrl("  "), null);
  });
});

describe("normalizeInspectionNotes", () => {
  it("trims and returns text", () => {
    assert.equal(normalizeInspectionNotes("  hello  "), "hello");
  });

  it("treats blank as null", () => {
    assert.equal(normalizeInspectionNotes(""), null);
  });
});
