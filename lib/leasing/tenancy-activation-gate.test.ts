import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RTB1_DOCUMENT_TYPE, RTB1_EXECUTED_DOCUMENT_TYPE } from "@/lib/leasing/rtb1/constants";
import { activationBlockReasonForAdvance } from "@/lib/leasing/tenancy-activation-gate";
import { assessTenancyActivationReadiness } from "@/lib/leasing/tenancy-activation-readiness";

describe("activationBlockReasonForAdvance", () => {
  it("blocks activation without a locked executed lease", () => {
    const readiness = assessTenancyActivationReadiness({ executedDocuments: [] });
    const reason = activationBlockReasonForAdvance("pending_move_in", "active", readiness);
    assert.ok(reason);
    assert.match(reason, /executed/i);
  });

  it("allows activation when readiness passes", () => {
    const readiness = assessTenancyActivationReadiness({
      executedDocuments: [
        {
          id: "exec-1",
          documentType: RTB1_EXECUTED_DOCUMENT_TYPE,
          isSigned: true,
          isLocked: true,
        },
      ],
    });
    const reason = activationBlockReasonForAdvance("pending_move_in", "active", readiness);
    assert.equal(reason, null);
  });

  it("does not block non-activation transitions", () => {
    const readiness = assessTenancyActivationReadiness({ executedDocuments: [] });
    const reason = activationBlockReasonForAdvance("inspection_completed", "ended", readiness);
    assert.equal(reason, null);
  });

  it("rejects draft documents for activation readiness", () => {
    const readiness = assessTenancyActivationReadiness({
      executedDocuments: [
        {
          id: "draft-1",
          documentType: RTB1_DOCUMENT_TYPE,
          isSigned: false,
          isLocked: false,
        },
      ],
    });
    assert.equal(readiness.ready, false);
    const reason = activationBlockReasonForAdvance("pending_move_in", "active", readiness);
    assert.ok(reason);
  });
});
