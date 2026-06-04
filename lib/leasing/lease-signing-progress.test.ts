import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertLeaseSigningTransition,
  deriveLeaseSigningProgress,
  isActiveLeaseSignatureRequest,
} from "@/lib/leasing/lease-signing-progress";
import { RTB1_DOCUMENT_TYPE } from "@/lib/leasing/rtb1/constants";

describe("lease signing progress", () => {
  it("marks active signature request statuses", () => {
    assert.equal(isActiveLeaseSignatureRequest("sent"), true);
    assert.equal(isActiveLeaseSignatureRequest("completed"), false);
  });

  it("derives step completion from draft, request, and signatures", () => {
    const draftCreatedAt = new Date("2026-06-01T12:00:00.000Z");
    const sentAt = new Date("2026-06-02T12:00:00.000Z");
    const tenantSignedAt = new Date("2026-06-03T12:00:00.000Z");

    const progress = deriveLeaseSigningProgress({
      latestDraft: {
        id: "draft-1",
        createdAt: draftCreatedAt,
        documentType: RTB1_DOCUMENT_TYPE,
        isLocked: false,
      },
      signatureRequest: {
        id: "sig-1",
        status: "viewed",
        sentAt,
        completedAt: null,
        executedDocumentId: null,
        signingTokenHash: "abc",
        signatures: [{ signerRole: "tenant", signedAt: tenantSignedAt }],
      },
      executedDocument: null,
      readinessComplete: true,
      signingToken: "token-value",
    });

    assert.equal(progress.steps.find((s) => s.id === "draft_generated")?.complete, true);
    assert.equal(progress.steps.find((s) => s.id === "tenant_signed")?.complete, true);
    assert.equal(progress.canPmSign, true);
    assert.equal(progress.canSendForSignature, false);
    assert.equal(progress.signingUrl, "/sign/lease/token-value");
  });

  it("blocks PM signature until tenant has signed", () => {
    assert.throws(
      () =>
        assertLeaseSigningTransition({
          hasTenantSignature: false,
          hasPmSignature: false,
          target: "property_manager",
        }),
      /Tenant must sign/,
    );
  });

  it("blocks duplicate tenant signatures", () => {
    assert.throws(
      () =>
        assertLeaseSigningTransition({
          hasTenantSignature: true,
          hasPmSignature: false,
          target: "tenant",
        }),
      /already signed/,
    );
  });
});
