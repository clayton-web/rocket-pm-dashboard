import type { EmailThreadCategory, Prisma } from "@prisma/client";

/** Threads that can receive AI classification attempts or category writes. */
export function uncategorizedNonManualThreadWhere(args: {
  threadId: string;
  organizationId: string;
}): Prisma.EmailThreadWhereInput {
  return {
    id: args.threadId,
    organizationId: args.organizationId,
    category: "UNCATEGORIZED",
    OR: [{ categorySource: null }, { categorySource: { not: "manual" } }],
  };
}

export function isEligibleForAttemptRecording(args: {
  category: EmailThreadCategory;
  categorySource: string | null;
}): boolean {
  if (args.category !== "UNCATEGORIZED") return false;
  if (args.categorySource === "manual") return false;
  return true;
}
