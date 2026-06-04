import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Rtb1DraftBlockedDuringSigningError } from "@/lib/leasing/lease-signing-guards";
import { isActiveLeaseSignatureRequest } from "@/lib/leasing/lease-signing-progress";

describe("lease signing guards", () => {
  it("treats draft, sent, and viewed as active signature statuses", () => {
    assert.equal(isActiveLeaseSignatureRequest("draft"), true);
    assert.equal(isActiveLeaseSignatureRequest("sent"), true);
    assert.equal(isActiveLeaseSignatureRequest("viewed"), true);
    assert.equal(isActiveLeaseSignatureRequest("completed"), false);
  });

  it("exposes a clear error when draft generation is blocked", () => {
    const error = new Rtb1DraftBlockedDuringSigningError();
    assert.match(error.message, /signature request is in progress/i);
    assert.equal(error.name, "Rtb1DraftBlockedDuringSigningError");
  });
});
