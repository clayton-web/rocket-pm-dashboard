import type { EmailThreadCategory, Prisma } from "@prisma/client";
import { isUncategorizedForClassification, type ThreadCategoryAssignment } from "@/lib/inbox/thread-category-assignments";

/** Threads the classifier attempted but left uncategorized (not manually categorized). */
export function classificationReviewThreadWhere(
  organizationId: string,
  mailboxId: string,
): Prisma.EmailThreadWhereInput {
  return {
    organizationId,
    connectedAccountId: mailboxId,
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
  };
}

export function isClassificationReviewThread(args: {
  category: EmailThreadCategory;
  categorySource: string | null;
  lastClassificationAttemptAt: Date | string | null;
  assignments?: ThreadCategoryAssignment[];
}): boolean {
  if (args.lastClassificationAttemptAt == null) return false;

  return isUncategorizedForClassification({
    assignments: args.assignments ?? [],
    legacyCategory: args.category,
    legacySource: args.categorySource,
  });
}
