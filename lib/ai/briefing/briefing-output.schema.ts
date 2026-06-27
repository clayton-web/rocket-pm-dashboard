import {
  BriefingItemCategory,
  BriefingItemUrgency,
  BriefingSourceType,
} from "@prisma/client";
import { z } from "zod";
import {
  BRIEFING_DATA_PROVENANCE,
  BRIEFING_MVP_ACTIVE_SOURCE_TYPES,
  type BriefingDataProvenance,
} from "@/lib/briefing/briefing-sources";

const briefingCategoryValues = Object.values(BriefingItemCategory) as [
  BriefingItemCategory,
  ...BriefingItemCategory[],
];

const briefingUrgencyValues = Object.values(BriefingItemUrgency) as [
  BriefingItemUrgency,
  ...BriefingItemUrgency[],
];

const briefingSourceTypeValues = Object.values(BriefingSourceType) as [
  BriefingSourceType,
  ...BriefingSourceType[],
];

const briefingDataProvenanceValues = [
  BRIEFING_DATA_PROVENANCE.EMAIL_MENTION,
  BRIEFING_DATA_PROVENANCE.ACCOUNTING_SYSTEM,
  BRIEFING_DATA_PROVENANCE.OPERATIONAL_SYSTEM,
] as const;

const isoDateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T|$)/, "Expected ISO date string");

export const briefingOutputItemSchema = z.object({
  sourceType: z.enum(briefingSourceTypeValues),
  sourceThreadId: z.string().min(1).optional(),
  sourceRecordId: z.string().min(1).optional(),
  summaryTitle: z.string().min(1).max(300),
  category: z.enum(briefingCategoryValues),
  urgency: z.enum(briefingUrgencyValues),
  keyFacts: z.array(z.string().min(1).max(500)).max(5).default([]),
  requiredAction: z.string().max(1000).optional(),
  suggestedReplyNotes: z.string().max(2000).optional(),
  dueDate: isoDateStringSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  isPropertyManagementRelated: z.boolean(),
  /**
   * EMAIL_MENTION: derived from email text only (MVP default).
   * ACCOUNTING_SYSTEM / OPERATIONAL_SYSTEM: reserved for Buildium and domain records.
   */
  dataProvenance: z.enum(briefingDataProvenanceValues).default(BRIEFING_DATA_PROVENANCE.EMAIL_MENTION),
});

export const briefingOutputSectionSchema = z.object({
  category: z.enum(briefingCategoryValues),
  items: z.array(briefingOutputItemSchema),
});

export const briefingFollowUpActionSchema = z.object({
  action: z.string().min(1).max(1000),
  relatedThreadId: z.string().min(1).optional(),
  priority: z.enum(briefingUrgencyValues),
  dueDate: isoDateStringSchema.optional(),
});

export const briefingOutputSchema = z.object({
  summaryTitle: z.string().min(1).max(300),
  executiveSummary: z.string().min(1).max(5000),
  estimatedReadingMinutes: z.number().int().min(1).max(120),
  scannedCount: z.number().int().min(0),
  includedCount: z.number().int().min(0),
  skippedCount: z.number().int().min(0),
  sections: z.array(briefingOutputSectionSchema),
  suggestedFollowUpActions: z.array(briefingFollowUpActionSchema).default([]),
  warnings: z.array(z.string().max(500)).default([]),
});

export type BriefingOutputItem = z.infer<typeof briefingOutputItemSchema>;
export type BriefingOutputSection = z.infer<typeof briefingOutputSectionSchema>;
export type BriefingFollowUpAction = z.infer<typeof briefingFollowUpActionSchema>;
export type BriefingGeminiOutput = z.infer<typeof briefingOutputSchema>;

export type NormalizedBriefingOutput = BriefingGeminiOutput & {
  sections: Array<{
    category: BriefingItemCategory;
    items: Array<BriefingOutputItem & {
      category: BriefingItemCategory;
      urgency: BriefingItemUrgency;
      sourceType: BriefingSourceType;
      dataProvenance: BriefingDataProvenance;
    }>;
  }>;
  suggestedFollowUpActions: Array<BriefingFollowUpAction & { priority: BriefingItemUrgency }>;
};

export class BriefingOutputValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Briefing output validation failed: ${issues.join("; ")}`);
    this.name = "BriefingOutputValidationError";
    this.issues = issues;
  }
}

/**
 * MVP guard: reject non-email sources and accounting-system provenance until
 * Buildium / operational integrations ship.
 */
export function assertMvpBriefingOutput(output: NormalizedBriefingOutput): void {
  const issues: string[] = [];

  for (const section of output.sections) {
    for (const item of section.items) {
      if (!BRIEFING_MVP_ACTIVE_SOURCE_TYPES.includes(item.sourceType)) {
        issues.push(
          `Item "${item.summaryTitle}" uses inactive sourceType ${item.sourceType} (MVP allows EMAIL only).`,
        );
      }

      if (item.dataProvenance === BRIEFING_DATA_PROVENANCE.ACCOUNTING_SYSTEM) {
        issues.push(
          `Item "${item.summaryTitle}" uses ACCOUNTING_SYSTEM provenance — not available until Buildium integration.`,
        );
      }

      if (item.dataProvenance === BRIEFING_DATA_PROVENANCE.OPERATIONAL_SYSTEM) {
        issues.push(
          `Item "${item.summaryTitle}" uses OPERATIONAL_SYSTEM provenance — not available in EMAIL-only MVP.`,
        );
      }

      if (
        item.category === BriefingItemCategory.RENT_DEPOSIT &&
        item.dataProvenance !== BRIEFING_DATA_PROVENANCE.EMAIL_MENTION
      ) {
        issues.push(
          `RENT_DEPOSIT item "${item.summaryTitle}" must use EMAIL_MENTION provenance in MVP.`,
        );
      }

      if (
        item.category === BriefingItemCategory.RENT_DEPOSIT &&
        item.sourceType === BriefingSourceType.EMAIL &&
        !item.keyFacts.some((fact) => /email mention/i.test(fact)) &&
        !item.summaryTitle.toLowerCase().includes("email")
      ) {
        // Soft requirement — warn via validation only when explicitly wrong amounts stated
        // No hard fail; prompt instructs labeling instead.
      }
    }
  }

  if (issues.length > 0) {
    throw new BriefingOutputValidationError(issues);
  }
}

export function parseBriefingGeminiOutput(raw: unknown): NormalizedBriefingOutput {
  const parsed = briefingOutputSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
    );
    throw new BriefingOutputValidationError(issues);
  }

  const output = parsed.data as NormalizedBriefingOutput;
  assertMvpBriefingOutput(output);
  return output;
}

/** Flatten section-grouped items for persistence helpers in PR 3. */
export function flattenBriefingOutputItems(
  output: NormalizedBriefingOutput,
): BriefingOutputItem[] {
  const items: BriefingOutputItem[] = [];
  for (const section of output.sections) {
    for (const item of section.items) {
      items.push(item);
    }
  }
  return items;
}
