import type {
  EmailThreadCategory,
  EmailThreadCategoryAssignmentSource,
  Prisma,
} from "@prisma/client";
import type { EmailThreadCategorySource } from "@/lib/inbox/email-thread-category";

/**
 * Priority for deriving deprecated `EmailThread.category` when multiple assignments exist.
 * Manual assignments are handled separately via source priority.
 */
export const LEGACY_CATEGORY_PRIORITY: readonly EmailThreadCategory[] = [
  "LANDLORD_COMMUNICATION",
  "TENANT_COMMUNICATION",
  "STRATA",
  "TENANT_INQUIRY",
  "UNCATEGORIZED",
] as const;

const ASSIGNMENT_SOURCE_PRIORITY: readonly EmailThreadCategoryAssignmentSource[] = [
  "MANUAL",
  "APPROVED_RULE",
  "RULE",
  "AI",
] as const;

const AUTOMATIC_SOURCES = new Set<EmailThreadCategoryAssignmentSource>([
  "RULE",
  "AI",
  "APPROVED_RULE",
]);

export type ThreadCategoryAssignment = {
  category: EmailThreadCategory;
  source: EmailThreadCategoryAssignmentSource;
  reason?: string | null;
  assignedAt?: Date;
};

export function assignmentSourceToLegacyString(
  source: EmailThreadCategoryAssignmentSource,
): EmailThreadCategorySource {
  switch (source) {
    case "MANUAL":
      return "manual";
    case "AI":
      return "ai";
    case "APPROVED_RULE":
      return "approved_rule";
    case "RULE":
    default:
      return "rule";
  }
}

export function legacyStringToAssignmentSourceLabel(source: string | null): string {
  if (!source) return "Not set";
  switch (source) {
    case "manual":
      return "Manual";
    case "ai":
      return "AI";
    case "approved_rule":
      return "Approved rule";
    case "rule":
      return "Deterministic rule";
    default:
      return source;
  }
}

export function categoryPriorityIndex(category: EmailThreadCategory): number {
  const index = LEGACY_CATEGORY_PRIORITY.indexOf(category);
  return index === -1 ? LEGACY_CATEGORY_PRIORITY.length : index;
}

/** Short stakeholder labels for inbox list rows and sorting. */
export const STAKEHOLDER_SHORT_LABELS: Record<EmailThreadCategory, string> = {
  LANDLORD_COMMUNICATION: "Landlord",
  TENANT_COMMUNICATION: "Tenant",
  STRATA: "Strata",
  TENANT_INQUIRY: "Inquiry",
  UNCATEGORIZED: "Unsorted",
};

/**
 * Highest-priority stakeholder category for sorting and display.
 * Multi-category threads use the first entry in priority order.
 */
export function getPrimaryStakeholderCategory(
  categories: readonly EmailThreadCategory[],
): EmailThreadCategory {
  if (categories.length === 0) return "UNCATEGORIZED";

  const meaningful = categories.filter((category) => category !== "UNCATEGORIZED");
  if (meaningful.length === 0) return "UNCATEGORIZED";

  return [...meaningful].sort(
    (left, right) => categoryPriorityIndex(left) - categoryPriorityIndex(right),
  )[0]!;
}

function sourcePriorityIndex(source: EmailThreadCategoryAssignmentSource): number {
  const index = ASSIGNMENT_SOURCE_PRIORITY.indexOf(source);
  return index === -1 ? ASSIGNMENT_SOURCE_PRIORITY.length : index;
}

export function deriveLegacyCategoryFromAssignments(
  assignments: ThreadCategoryAssignment[],
): EmailThreadCategory {
  const meaningful = assignments.filter((assignment) => assignment.category !== "UNCATEGORIZED");
  if (meaningful.length === 0) return "UNCATEGORIZED";

  return [...meaningful].sort(
    (left, right) => categoryPriorityIndex(left.category) - categoryPriorityIndex(right.category),
  )[0]!.category;
}

export function deriveLegacyCategorySourceFromAssignments(
  assignments: ThreadCategoryAssignment[],
): string | null {
  if (assignments.length === 0) return null;

  const legacyCategory = deriveLegacyCategoryFromAssignments(assignments);
  const forCategory = assignments.filter((assignment) => assignment.category === legacyCategory);
  const best = [...forCategory].sort(
    (left, right) => sourcePriorityIndex(left.source) - sourcePriorityIndex(right.source),
  )[0];

  return best ? assignmentSourceToLegacyString(best.source) : null;
}

export function getEffectiveCategories(
  assignments: ThreadCategoryAssignment[],
  fallbackCategory: EmailThreadCategory,
): EmailThreadCategory[] {
  const fromAssignments = assignments
    .map((assignment) => assignment.category)
    .filter((category) => category !== "UNCATEGORIZED");

  if (fromAssignments.length > 0) {
    return [...new Set(fromAssignments)].sort(
      (left, right) => categoryPriorityIndex(left) - categoryPriorityIndex(right),
    );
  }

  if (fallbackCategory !== "UNCATEGORIZED") {
    return [fallbackCategory];
  }

  return [];
}

export function isManualClassificationLocked(
  assignments: Array<Pick<ThreadCategoryAssignment, "source">>,
): boolean {
  return assignments.some((assignment) => assignment.source === "MANUAL");
}

export function isUncategorizedForClassification(args: {
  assignments: ThreadCategoryAssignment[];
  legacyCategory: EmailThreadCategory;
  legacySource: string | null;
}): boolean {
  if (isManualClassificationLocked(args.assignments)) return false;
  if (args.legacySource === "manual") return false;

  const effective = getEffectiveCategories(args.assignments, args.legacyCategory);
  return effective.length === 0;
}

function syncLegacyThreadCategoryFields(
  tx: Prisma.TransactionClient,
  threadId: string,
  assignments: ThreadCategoryAssignment[],
  extra?: Prisma.EmailThreadUpdateInput,
): Promise<unknown> {
  const category = deriveLegacyCategoryFromAssignments(assignments);
  const categorySource = deriveLegacyCategorySourceFromAssignments(assignments);

  return tx.emailThread.update({
    where: { id: threadId },
    data: {
      category,
      categorySource,
      categoryUpdatedAt: new Date(),
      ...extra,
    },
  });
}

export async function replaceAutomaticCategoryAssignments(
  tx: Prisma.TransactionClient,
  args: {
    threadId: string;
    assignments: Array<{
      category: EmailThreadCategory;
      source: Extract<EmailThreadCategoryAssignmentSource, "RULE" | "AI" | "APPROVED_RULE">;
      reason?: string | null;
    }>;
    categoryConfidence?: number | null;
    categoryAiReason?: string | null;
    lastClassificationAttemptAt?: Date | null;
  },
): Promise<ThreadCategoryAssignment[]> {
  const existing = await tx.emailThreadCategoryAssignment.findMany({
    where: { threadId: args.threadId },
    select: { category: true, source: true, reason: true, assignedAt: true },
  });

  if (isManualClassificationLocked(existing)) {
    return existing;
  }

  await tx.emailThreadCategoryAssignment.deleteMany({
    where: {
      threadId: args.threadId,
      source: { in: ["RULE", "AI", "APPROVED_RULE"] },
    },
  });

  const now = new Date();
  for (const assignment of args.assignments) {
    await tx.emailThreadCategoryAssignment.create({
      data: {
        threadId: args.threadId,
        category: assignment.category,
        source: assignment.source,
        reason: assignment.reason ?? null,
        assignedAt: now,
      },
    });
  }

  const remaining = await tx.emailThreadCategoryAssignment.findMany({
    where: { threadId: args.threadId },
    select: { category: true, source: true, reason: true, assignedAt: true },
  });

  await syncLegacyThreadCategoryFields(tx, args.threadId, remaining, {
    ...(args.categoryConfidence !== undefined ? { categoryConfidence: args.categoryConfidence } : {}),
    ...(args.categoryAiReason !== undefined ? { categoryAiReason: args.categoryAiReason } : {}),
    ...(args.lastClassificationAttemptAt !== undefined
      ? { lastClassificationAttemptAt: args.lastClassificationAttemptAt }
      : {}),
  });

  return remaining;
}

export async function replaceManualCategoryAssignment(
  tx: Prisma.TransactionClient,
  args: {
    threadId: string;
    category: EmailThreadCategory;
    reason?: string | null;
  },
): Promise<ThreadCategoryAssignment[]> {
  await tx.emailThreadCategoryAssignment.deleteMany({
    where: { threadId: args.threadId },
  });

  const now = new Date();
  await tx.emailThreadCategoryAssignment.create({
    data: {
      threadId: args.threadId,
      category: args.category,
      source: "MANUAL",
      reason: args.reason ?? null,
      assignedAt: now,
    },
  });

  const assignments = await tx.emailThreadCategoryAssignment.findMany({
    where: { threadId: args.threadId },
    select: { category: true, source: true, reason: true, assignedAt: true },
  });

  await syncLegacyThreadCategoryFields(tx, args.threadId, assignments, {
    categoryConfidence: null,
    categoryAiReason: null,
    lastClassificationAttemptAt: null,
  });

  return assignments;
}

export function isAutomaticAssignmentSource(
  source: EmailThreadCategoryAssignmentSource,
): boolean {
  return AUTOMATIC_SOURCES.has(source);
}
