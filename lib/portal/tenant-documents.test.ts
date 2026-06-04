import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RTB1_DOCUMENT_TYPE, RTB1_EXECUTED_DOCUMENT_TYPE } from "@/lib/leasing/rtb1/constants";
import {
  isTenantPortalDocument,
  tenantCanAccessDocument,
} from "@/lib/portal/tenant-documents";

const session = { tenancyId: "tenancy-a" };

describe("isTenantPortalDocument", () => {
  it("includes locked signed executed RTB-1 documents", () => {
    assert.equal(
      isTenantPortalDocument({
        tenancyId: "tenancy-a",
        documentType: RTB1_EXECUTED_DOCUMENT_TYPE,
        isSigned: true,
        isLocked: true,
      }),
      true,
    );
  });

  it("excludes draft documents", () => {
    assert.equal(
      isTenantPortalDocument({
        tenancyId: "tenancy-a",
        documentType: RTB1_DOCUMENT_TYPE,
        isSigned: false,
        isLocked: false,
      }),
      false,
    );
  });

  it("excludes unsigned or unlocked executed documents", () => {
    assert.equal(
      isTenantPortalDocument({
        tenancyId: "tenancy-a",
        documentType: RTB1_EXECUTED_DOCUMENT_TYPE,
        isSigned: false,
        isLocked: true,
      }),
      false,
    );
    assert.equal(
      isTenantPortalDocument({
        tenancyId: "tenancy-a",
        documentType: RTB1_EXECUTED_DOCUMENT_TYPE,
        isSigned: true,
        isLocked: false,
      }),
      false,
    );
  });
});

describe("tenantCanAccessDocument", () => {
  it("allows access to the tenant's executed lease", () => {
    assert.equal(
      tenantCanAccessDocument(session, {
        tenancyId: "tenancy-a",
        documentType: RTB1_EXECUTED_DOCUMENT_TYPE,
        isSigned: true,
        isLocked: true,
      }),
      true,
    );
  });

  it("denies access to another tenancy's document", () => {
    assert.equal(
      tenantCanAccessDocument(session, {
        tenancyId: "tenancy-b",
        documentType: RTB1_EXECUTED_DOCUMENT_TYPE,
        isSigned: true,
        isLocked: true,
      }),
      false,
    );
  });

  it("denies access when document is not tenant-visible", () => {
    assert.equal(
      tenantCanAccessDocument(session, {
        tenancyId: "tenancy-a",
        documentType: RTB1_DOCUMENT_TYPE,
        isSigned: false,
        isLocked: false,
      }),
      false,
    );
  });
});
