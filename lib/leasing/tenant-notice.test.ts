import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAcceptedTenantEndNotice,
  isPendingTenantEndNotice,
  TENANT_NOTICE_TO_END_TYPE,
} from "./tenant-notice";

describe("tenant notice helpers", () => {
  it("pending vs accepted", () => {
    assert.equal(
      isPendingTenantEndNotice({
        noticeType: TENANT_NOTICE_TO_END_TYPE,
        servedAt: null,
      }),
      true,
    );
    assert.equal(
      isAcceptedTenantEndNotice({
        noticeType: TENANT_NOTICE_TO_END_TYPE,
        servedAt: new Date(),
        tenantRequestedMoveOutDate: new Date("2026-08-01"),
      }),
      true,
    );
    assert.equal(
      isAcceptedTenantEndNotice({
        noticeType: TENANT_NOTICE_TO_END_TYPE,
        servedAt: new Date(),
        tenantRequestedMoveOutDate: null,
      }),
      false,
    );
    assert.equal(
      isAcceptedTenantEndNotice({
        noticeType: "welcome",
        servedAt: new Date(),
        tenantRequestedMoveOutDate: new Date("2026-08-01"),
      }),
      false,
    );
  });
});
