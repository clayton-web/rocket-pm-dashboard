import type { EmailThreadCategory } from "@prisma/client";
import { isEmailThreadCategory } from "@/lib/inbox/email-thread-category";

export type InboxClassificationResult = {
  category: EmailThreadCategory;
  confidence: number;
  reason: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseConfidence(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > 1) return null;
  return value;
}

export function parseInboxClassificationOutput(raw: unknown): InboxClassificationResult | null {
  if (!isRecord(raw)) return null;

  const category = raw.category;
  if (typeof category !== "string" || !isEmailThreadCategory(category)) return null;

  const confidence = parseConfidence(raw.confidence);
  if (confidence == null) return null;

  const reason = typeof raw.reason === "string" ? raw.reason.trim() : "";
  if (!reason) return null;

  return { category, confidence, reason };
}
