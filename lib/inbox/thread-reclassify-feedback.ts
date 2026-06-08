import { EMAIL_THREAD_CATEGORY_LABELS } from "@/lib/inbox/email-thread-category";
import type { EmailThreadCategory } from "@prisma/client";

export function buildThreadReclassifySuccessMessage(args: {
  category: EmailThreadCategory;
  senderEmail: string | null;
}): string {
  const crateLabel = EMAIL_THREAD_CATEGORY_LABELS[args.category];
  if (args.senderEmail) {
    return `Moved to ${crateLabel}. Future emails from ${args.senderEmail} will be sorted here.`;
  }
  return `Moved to ${crateLabel}.`;
}
