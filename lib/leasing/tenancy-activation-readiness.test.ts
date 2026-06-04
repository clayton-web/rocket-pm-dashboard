import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RTB1_EXECUTED_DOCUMENT_TYPE } from "@/lib/leasing/rtb1/constants";
import { assessTenancyActivationReadiness } from "@/lib/leasing/tenancy-activation-readiness";

describe("assessTenancyActivationReadiness", () => {
  it("requires a locked signed executed RTB-1", () => {
    const result = assessTenancyActivationReadiness({
      executedDocuments: [
        {
          id: "exec-1",
          documentType: RTB1_EXECUTED_DOCUMENT_TYPE,
          isSigned: true,
          isLocked: true,
        },
      ],
    });
    assert.equal(result.ready, true);
    assert.equal(result.executedDocumentId, "exec-1");
  });

  it("rejects draft or unsigned documents", () => {
    const result = assessTenancyActivationReadiness({
      executedDocuments: [
        {
          id: "draft-1",
          documentType: "lease_rtb1_draft",
          isSigned: false,
          isLocked: false,
        },
      ],
    });
    assert.equal(result.ready, false);
    assert.match(result.reason, /executed/i);
  });

  it("rejects unlocked executed documents", () => {
    const result = assessTenancyActivationReadiness({
      executedDocuments: [
        {
          id: "exec-1",
          documentType: RTB1_EXECUTED_DOCUMENT_TYPE,
          isSigned: true,
          isLocked: false,
        },
      ],
    });
    assert.equal(result.ready, false);
  });
});
