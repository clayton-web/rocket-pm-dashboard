import { EMAIL_THREAD_CATEGORY_LABELS } from "@/lib/inbox/email-thread-category";
import type { EmailThreadCategory } from "@prisma/client";

export function buildThreadReclassifySuccessMessage(args: {
  category: EmailThreadCategory;
}): string {
  const crateLabel = EMAIL_THREAD_CATEGORY_LABELS[args.category];
  return `Moved to ${crateLabel}.`;
}
