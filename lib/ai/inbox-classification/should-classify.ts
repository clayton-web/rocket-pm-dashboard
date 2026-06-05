import type { EmailThreadCategory } from "@prisma/client";
import { INBOX_CLASSIFICATION_MIN_CONFIDENCE } from "@/lib/ai/inbox-classification/constants";
import type { InboxClassificationResult } from "@/lib/ai/inbox-classification/parse-output";

export type ThreadClassificationSnapshot = {
  category: EmailThreadCategory;
  categorySource: string | null;
  lastClassificationAttemptAt?: Date | null;
};

export function isEligibleForClassificationQueue(thread: ThreadClassificationSnapshot): boolean {
  if (thread.categorySource === "manual") return false;
  if (thread.category !== "UNCATEGORIZED") return false;
  if (thread.lastClassificationAttemptAt != null) return false;
  return true;
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
