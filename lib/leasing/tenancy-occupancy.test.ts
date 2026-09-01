import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TenancyStatus } from "@prisma/client";
import { isPublishBlockingTenancyStatus } from "./rental-listing-active-tenancy";
import {
  CURRENT_TENANCY_STATUSES,
  getTenancyOccupancyCurrency,
  HISTORICAL_TENANCY_STATUSES,
  isCurrentTenancyStatus,
} from "./tenancy-occupancy";

const ALL_STATUSES: TenancyStatus[] = [
  "pending_move_in",
  "active",
  "notice_received",
  "move_out_scheduled",
  "inspection_scheduled",
  "inspection_completed",
  "ended",
  "archived",
];

describe("tenancy occupancy currency", () => {
  it("classifies every TenancyStatus exactly once", () => {
    const combined = [...CURRENT_TENANCY_STATUSES, ...HISTORICAL_TENANCY_STATUSES];
    assert.deepEqual(combined.slice().sort(), ALL_STATUSES.slice().sort());
    assert.equal(new Set(combined).size, combined.length);
  });

  it("treats the full in-progress lifecycle as current", () => {
    for (const status of CURRENT_TENANCY_STATUSES) {
      assert.equal(getTenancyOccupancyCurrency(status), "current", status);
    }
    assert.equal(isCurrentTenancyStatus("pending_move_in"), true);
    assert.equal(isCurrentTenancyStatus("inspection_completed"), true);
  });

  it("treats ended and archived as historical", () => {
    assert.equal(getTenancyOccupancyCurrency("ended"), "historical");
    assert.equal(getTenancyOccupancyCurrency("archived"), "historical");
    assert.equal(isCurrentTenancyStatus("ended"), false);
  });

  it("defaults an unrecognized status to historical rather than current", () => {
    assert.equal(getTenancyOccupancyCurrency("something_new"), "historical");
  });

  it("is the same rule the rental listing publish guard uses", () => {
    for (const status of ALL_STATUSES) {
      assert.equal(
        isPublishBlockingTenancyStatus(status),
        isCurrentTenancyStatus(status),
        status,
      );
    }
  });
});
