import type { EmailThreadCategory, Prisma } from "@prisma/client";

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
    NOT: { categorySource: "manual" },
  };
}

export function isClassificationReviewThread(args: {
  category: EmailThreadCategory;
  categorySource: string | null;
  lastClassificationAttemptAt: Date | string | null;
}): boolean {
  return (
    args.category === "UNCATEGORIZED" &&
    args.lastClassificationAttemptAt != null &&
    args.categorySource !== "manual"
  );
}
