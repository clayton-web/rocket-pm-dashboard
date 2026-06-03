import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getAdvanceTenancyStatusLabel,
  getNextTenancyStatus,
  isValidTenancyStatusTransition,
} from "./tenancy-lifecycle";

describe("tenancy lifecycle — move-out inspection", () => {
  it("chains move-out through inspection to ended", () => {
    assert.equal(getNextTenancyStatus("move_out_scheduled"), "inspection_scheduled");
    assert.equal(getNextTenancyStatus("inspection_scheduled"), "inspection_completed");
    assert.equal(getNextTenancyStatus("inspection_completed"), "ended");
    assert.equal(getNextTenancyStatus("ended"), "archived");
  });

  it("validates inspection transitions", () => {
    assert.equal(
      isValidTenancyStatusTransition("move_out_scheduled", "inspection_scheduled"),
      true,
    );
    assert.equal(
      isValidTenancyStatusTransition("inspection_scheduled", "inspection_completed"),
      true,
    );
    assert.equal(
      isValidTenancyStatusTransition("move_out_scheduled", "ended"),
      false,
    );
    assert.equal(
      isValidTenancyStatusTransition("move_out_scheduled", "inspection_completed"),
      false,
    );
  });

  it("does not offer staff advance labels for offboarding steps", () => {
    assert.equal(getAdvanceTenancyStatusLabel("active"), null);
    assert.equal(getAdvanceTenancyStatusLabel("notice_received"), null);
    assert.equal(getAdvanceTenancyStatusLabel("move_out_scheduled"), null);
    assert.equal(getAdvanceTenancyStatusLabel("inspection_scheduled"), null);
    assert.equal(getAdvanceTenancyStatusLabel("inspection_completed"), "Mark ended");
  });
});
