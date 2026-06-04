import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePmLeaseSigningAction } from "@/lib/leasing/lease-signing-pm-resolution";

describe("resolvePmLeaseSigningAction", () => {
  it("returns existing document when execution already completed", () => {
    const resolution = resolvePmLeaseSigningAction({
      hasTenantSignature: true,
      hasPmSignature: true,
      executedDocumentId: "doc-executed",
      status: "completed",
    });
    assert.deepEqual(resolution, {
      action: "return_existing",
      executedDocumentId: "doc-executed",
    });
  });

  it("retries execution when PM signature exists without executed document", () => {
    const resolution = resolvePmLeaseSigningAction({
      hasTenantSignature: true,
      hasPmSignature: true,
      executedDocumentId: null,
      status: "viewed",
    });
    assert.equal(resolution.action, "execute_only");
  });

  it("creates PM signature when tenant signed but PM has not", () => {
    const resolution = resolvePmLeaseSigningAction({
      hasTenantSignature: true,
      hasPmSignature: false,
      executedDocumentId: null,
      status: "viewed",
    });
    assert.equal(resolution.action, "create_signature_and_execute");
  });

  it("requires tenant signature before PM action", () => {
    assert.throws(
      () =>
        resolvePmLeaseSigningAction({
          hasTenantSignature: false,
          hasPmSignature: false,
          executedDocumentId: null,
          status: "sent",
        }),
      /Tenant must sign/,
    );
  });
});
