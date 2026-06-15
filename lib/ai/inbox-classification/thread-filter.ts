import type { EmailThreadCategory, Prisma } from "@prisma/client";
import { isManualClassificationLocked, type ThreadCategoryAssignment } from "@/lib/inbox/thread-category-assignments";

/** Threads that can receive AI classification attempts or automatic category writes. */
export function uncategorizedNonManualThreadWhere(args: {
  threadId: string;
  organizationId: string;
}): Prisma.EmailThreadWhereInput {
  return {
    id: args.threadId,
    organizationId: args.organizationId,
    category: "UNCATEGORIZED",
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

export function isEligibleForAttemptRecording(args: {
  category: EmailThreadCategory;
  categorySource: string | null;
  assignments?: ThreadCategoryAssignment[];
}): boolean {
  if (args.assignments && isManualClassificationLocked(args.assignments)) return false;
  if (args.category !== "UNCATEGORIZED") return false;
  if (args.categorySource === "manual") return false;
  return true;
}

export function listEligibleUncategorizedThreadsWhere(args: {
  organizationId: string;
  connectedAccountId: string;
}): Prisma.EmailThreadWhereInput {
  return {
    organizationId: args.organizationId,
    connectedAccountId: args.connectedAccountId,
    category: "UNCATEGORIZED",
    lastClassificationAttemptAt: null,
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
