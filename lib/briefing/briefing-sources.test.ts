import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BriefingSourceType } from "@prisma/client";
import {
  BRIEFING_MVP_ACTIVE_SOURCE_TYPES,
  BRIEFING_MVP_SCOPE_NOTE,
  isMvpActiveBriefingSourceType,
} from "@/lib/briefing/briefing-sources";

describe("briefing source configuration", () => {
  it("activates EMAIL only in MVP", () => {
    assert.deepEqual(BRIEFING_MVP_ACTIVE_SOURCE_TYPES, [BriefingSourceType.EMAIL]);
    assert.equal(isMvpActiveBriefingSourceType(BriefingSourceType.EMAIL), true);
    assert.equal(isMvpActiveBriefingSourceType(BriefingSourceType.RENT_PAYMENT), false);
    assert.equal(isMvpActiveBriefingSourceType(BriefingSourceType.DEPOSIT), false);
    assert.equal(isMvpActiveBriefingSourceType(BriefingSourceType.MAINTENANCE), false);
  });

  it("documents Buildium-ready scope note", () => {
    assert.ok(BRIEFING_MVP_SCOPE_NOTE.includes("Buildium"));
    assert.ok(BRIEFING_MVP_SCOPE_NOTE.includes("email mentions"));
  });
});
