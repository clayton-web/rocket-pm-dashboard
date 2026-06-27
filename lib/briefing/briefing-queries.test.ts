import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BriefingItemCategory, BriefingItemUrgency, BriefingSourceType } from "@prisma/client";
import {
  getBriefingOverview,
  getBriefingRunDetail,
  groupBriefingItemsByCategory,
  shouldShowEmailMentionLabel,
  sortBriefingItemsForDisplay,
  type BriefingItemView,
} from "@/lib/briefing/briefing-queries";
import { BRIEFING_DATA_PROVENANCE } from "@/lib/briefing/briefing-sources";
import prisma from "@/lib/db/prisma";

function item(partial: Partial<BriefingItemView> & Pick<BriefingItemView, "id">): BriefingItemView {
  return {
    summaryTitle: partial.summaryTitle ?? partial.id,
    category: partial.category ?? BriefingItemCategory.GENERAL_ADMIN,
    urgency: partial.urgency ?? BriefingItemUrgency.NORMAL,
    sourceType: partial.sourceType ?? BriefingSourceType.EMAIL,
    subject: partial.subject ?? null,
    emailThreadId: partial.emailThreadId ?? null,
    dueDate: partial.dueDate ?? null,
    sortOrder: partial.sortOrder ?? 0,
    summary: partial.summary ?? {},
    showEmailMentionLabel:
      partial.showEmailMentionLabel ??
      shouldShowEmailMentionLabel({
        category: partial.category ?? BriefingItemCategory.GENERAL_ADMIN,
        dataProvenance: partial.summary?.dataProvenance,
      }),
    ...partial,
  };
}

describe("briefing display helpers", () => {
  it("shows email mention label for rent/deposit category", () => {
    assert.equal(
      shouldShowEmailMentionLabel({
        category: BriefingItemCategory.RENT_DEPOSIT,
      }),
      true,
    );
  });

  it("shows email mention label when provenance is EMAIL_MENTION", () => {
    assert.equal(
      shouldShowEmailMentionLabel({
        category: BriefingItemCategory.TENANT,
        dataProvenance: BRIEFING_DATA_PROVENANCE.EMAIL_MENTION,
      }),
      true,
    );
  });

  it("sorts urgent items before normal items", () => {
    const sorted = sortBriefingItemsForDisplay([
      item({ id: "b", urgency: BriefingItemUrgency.NORMAL }),
      item({ id: "a", urgency: BriefingItemUrgency.URGENT }),
    ]);
    assert.deepEqual(sorted.map((entry) => entry.id), ["a", "b"]);
  });

  it("groups items by category after urgency sort", () => {
    const groups = groupBriefingItemsByCategory([
      item({ id: "1", category: BriefingItemCategory.TENANT, urgency: BriefingItemUrgency.HIGH }),
      item({ id: "2", category: BriefingItemCategory.RENT_DEPOSIT, urgency: BriefingItemUrgency.URGENT }),
    ]);
    assert.equal(groups[0]?.category, BriefingItemCategory.RENT_DEPOSIT);
    assert.equal(groups[0]?.items[0]?.id, "2");
  });
});

describe("briefing org-scoped queries", () => {
  function withMockPrisma<T>(mocks: Record<string, unknown>, run: () => Promise<T>): Promise<T> {
    const original = { ...prisma };
    Object.assign(prisma, mocks);
    return run().finally(() => {
      Object.assign(prisma, original);
    });
  }

  it("scopes run detail lookup to the active organization", async () => {
    let capturedWhere: unknown;

    await withMockPrisma(
      {
        briefingRun: {
          findFirst: async (args: { where: unknown }) => {
            capturedWhere = args.where;
            return null;
          },
        },
      },
      () =>
        getBriefingRunDetail({
          organizationId: "org_active",
          runId: "run_1",
        }),
    );

    assert.deepEqual(capturedWhere, { id: "run_1", organizationId: "org_active" });
  });

  it("returns disabled overview when settings are missing", async () => {
    const overview = await withMockPrisma(
      {
        briefingSettings: { findUnique: async () => null },
        organizationAiPolicy: { findUnique: async () => null },
        briefingRun: { findMany: async () => [] },
      },
      () => getBriefingOverview("org_1"),
    );

    assert.equal(overview.settingsEnabled, false);
    assert.equal(overview.autoBriefingEnabled, false);
    assert.deepEqual(overview.latestBySlot, {});
  });
});
