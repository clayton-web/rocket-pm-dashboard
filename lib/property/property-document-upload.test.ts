import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROPERTY_DOCUMENT_MAX_BYTES,
  titleFromUploadFileName,
  validatePropertyDocumentUpload,
} from "@/lib/property/property-document-upload";

describe("validatePropertyDocumentUpload", () => {
  it("accepts valid property-scoped uploads", () => {
    const result = validatePropertyDocumentUpload({
      fileName: "strata-rules.pdf",
      contentType: "application/pdf",
      sizeBytes: 1024,
      documentType: "strata_bylaws",
      title: "Strata rules",
      scope: "property",
      hasActiveTenancy: false,
    });
    assert.equal(result.ok, true);
  });

  it("rejects oversize and unsupported file types", () => {
    assert.equal(
      validatePropertyDocumentUpload({
        fileName: "big.pdf",
        contentType: "application/pdf",
        sizeBytes: PROPERTY_DOCUMENT_MAX_BYTES + 1,
        documentType: "property_misc",
        title: "Big",
        scope: "property",
        hasActiveTenancy: false,
      }).ok,
      false,
    );
    assert.equal(
      validatePropertyDocumentUpload({
        fileName: "notes.txt",
        contentType: "text/plain",
        sizeBytes: 100,
        documentType: "property_misc",
        title: "Notes",
        scope: "property",
        hasActiveTenancy: false,
      }).ok,
      false,
    );
  });

  it("requires an active tenancy for tenancy scope", () => {
    const result = validatePropertyDocumentUpload({
      fileName: "lease.pdf",
      contentType: "application/pdf",
      sizeBytes: 1000,
      documentType: "lease_agreement",
      title: "Lease",
      scope: "tenancy",
      hasActiveTenancy: false,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /active tenancy/i);
    }
  });
});

describe("titleFromUploadFileName", () => {
  it("derives a readable title from file names", () => {
    assert.equal(titleFromUploadFileName("strata-rules_final.pdf"), "strata rules final");
    assert.equal(titleFromUploadFileName(".pdf"), "Untitled document");
  });
});
