import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RTB1_DOCUMENT_TYPE } from "@/lib/leasing/rtb1/constants";
import {
  assertDocumentTypeMatchesScope,
  documentTypeLabel,
  isStaffUploadDocumentType,
  isSystemManagedDocumentType,
  staffDocumentTypesForScope,
} from "@/lib/property/document-types";

describe("property document types", () => {
  it("labels staff and system document types", () => {
    assert.equal(documentTypeLabel("lease_agreement"), "Lease agreement (uploaded)");
    assert.equal(documentTypeLabel(RTB1_DOCUMENT_TYPE), "RTB-1 draft (system)");
  });

  it("returns scope-specific upload categories", () => {
    assert.ok(staffDocumentTypesForScope("property").includes("strata_bylaws"));
    assert.ok(staffDocumentTypesForScope("tenancy").includes("move_in_inspection"));
    assert.equal(
      staffDocumentTypesForScope("property").some((value) => value === "lease_agreement"),
      false,
    );
  });

  it("validates category against scope", () => {
    assert.equal(assertDocumentTypeMatchesScope("strata_bylaws", "property"), null);
    assert.equal(
      assertDocumentTypeMatchesScope("lease_agreement", "property"),
      "Selected category requires an active tenancy scope",
    );
    assert.equal(
      assertDocumentTypeMatchesScope("strata_bylaws", "tenancy"),
      "Selected category is only valid for property-level documents",
    );
  });

  it("identifies staff upload and system-managed types", () => {
    assert.equal(isStaffUploadDocumentType("property_misc"), true);
    assert.equal(isStaffUploadDocumentType(RTB1_DOCUMENT_TYPE), false);
    assert.equal(isSystemManagedDocumentType(RTB1_DOCUMENT_TYPE), true);
  });
});
