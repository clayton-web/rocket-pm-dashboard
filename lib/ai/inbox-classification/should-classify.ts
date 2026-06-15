import type { EmailThreadCategory } from "@prisma/client";
import { INBOX_CLASSIFICATION_MIN_CONFIDENCE } from "@/lib/ai/inbox-classification/constants";
import type { InboxClassificationResult } from "@/lib/ai/inbox-classification/parse-output";
import {
  getEffectiveCategories,
  isManualClassificationLocked,
  isUncategorizedForClassification,
  type ThreadCategoryAssignment,
} from "@/lib/inbox/thread-category-assignments";

export type ThreadClassificationSnapshot = {
  category: EmailThreadCategory;
  categorySource: string | null;
  lastClassificationAttemptAt?: Date | null;
  assignments?: ThreadCategoryAssignment[];
};

export function isEligibleForClassificationQueue(thread: ThreadClassificationSnapshot): boolean {
  const assignments = thread.assignments ?? [];

  if (isManualClassificationLocked(assignments)) return false;
  if (thread.categorySource === "manual") return false;
  if (thread.lastClassificationAttemptAt != null) return false;

  return isUncategorizedForClassification({
    assignments,
    legacyCategory: thread.category,
    legacySource: thread.categorySource,
  });
}

export function shouldAttemptInboxClassification(thread: ThreadClassificationSnapshot): boolean {
  return isEligibleForClassificationQueue(thread);
}

export function shouldPersistInboxClassification(
  result: InboxClassificationResult,
): boolean {
  if (result.category === "UNCATEGORIZED") return false;
  if (result.confidence < INBOX_CLASSIFICATION_MIN_CONFIDENCE) return false;
  return true;
}

export function hasClassifiedCategories(
  thread: ThreadClassificationSnapshot,
): boolean {
  const assignments = thread.assignments ?? [];
  return getEffectiveCategories(assignments, thread.category).length > 0;
}
