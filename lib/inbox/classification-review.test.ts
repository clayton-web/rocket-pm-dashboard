import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isClassificationReviewThread,
  classificationReviewThreadWhere,
} from "./classification-review";

describe("classification-review", () => {
  it("matches uncategorized threads with a classification attempt that are not manual", () => {
    assert.equal(
      isClassificationReviewThread({
        category: "UNCATEGORIZED",
        categorySource: null,
        lastClassificationAttemptAt: "2026-06-10T12:00:00.000Z",
      }),
      true,
    );
    assert.equal(
      isClassificationReviewThread({
        category: "UNCATEGORIZED",
        categorySource: "ai",
        lastClassificationAttemptAt: "2026-06-10T12:00:00.000Z",
      }),
      true,
    );
  });

  it("excludes manual, categorized, and never-attempted threads", () => {
    assert.equal(
      isClassificationReviewThread({
        category: "UNCATEGORIZED",
        categorySource: "manual",
        lastClassificationAttemptAt: "2026-06-10T12:00:00.000Z",
      }),
      false,
    );
    assert.equal(
      isClassificationReviewThread({
        category: "STRATA",
        categorySource: "ai",
        lastClassificationAttemptAt: "2026-06-10T12:00:00.000Z",
      }),
      false,
    );
    assert.equal(
      isClassificationReviewThread({
        category: "UNCATEGORIZED",
        categorySource: null,
        lastClassificationAttemptAt: null,
      }),
      false,
    );
  });

  it("builds prisma where for mailbox classification review", () => {
    assert.deepEqual(classificationReviewThreadWhere("org_1", "mailbox_1"), {
      organizationId: "org_1",
      connectedAccountId: "mailbox_1",
      category: "UNCATEGORIZED",
      lastClassificationAttemptAt: { not: null },
      OR: [{ categorySource: null }, { categorySource: { not: "manual" } }],
      NOT: {
        categoryAssignments: {
          some: { source: "MANUAL" },
        },
      },
      AND: [
        {
          NOT: {
            categoryAssignments: {
              some: {
                category: { not: "UNCATEGORIZED" },
              },
            },
          },
        },
      ],
    });
  });
});
