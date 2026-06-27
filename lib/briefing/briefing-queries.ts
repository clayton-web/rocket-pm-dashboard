import {
  BriefingItemCategory,
  BriefingItemUrgency,
  BriefingRunStatus,
  BriefingSlot,
  BriefingSourceType,
  type Prisma,
} from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { BRIEFING_DATA_PROVENANCE } from "@/lib/briefing/briefing-sources";

export type BriefingItemSummaryJson = {
  keyFacts?: string[];
  requiredAction?: string | null;
  suggestedReplyNotes?: string | null;
  confidence?: number | null;
  dataProvenance?: string;
  isPropertyManagementRelated?: boolean;
  sender?: string | null;
  senderEmail?: string | null;
};

export type BriefingItemView = {
  id: string;
  summaryTitle: string;
  category: BriefingItemCategory;
  urgency: BriefingItemUrgency;
  sourceType: BriefingSourceType;
  subject: string | null;
  emailThreadId: string | null;
  dueDate: Date | null;
  sortOrder: number;
  summary: BriefingItemSummaryJson;
  showEmailMentionLabel: boolean;
};

export type BriefingRunSummary = {
  id: string;
  slot: BriefingSlot;
  status: BriefingRunStatus;
  windowStart: Date;
  windowEnd: Date;
  threadsScanned: number;
  itemsIncluded: number;
  itemsSkipped: number;
  executiveSummary: string | null;
  estimatedReadingMinutes: number | null;
  errorMessage: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  items: BriefingItemView[];
};

export type BriefingOverview = {
  settingsEnabled: boolean;
  autoBriefingEnabled: boolean;
  latestBySlot: Partial<Record<BriefingSlot, BriefingRunSummary>>;
};

export type BriefingSettingsView = {
  organizationId: string;
  organizationName: string;
  enabled: boolean;
  morningEnabled: boolean;
  afternoonEnabled: boolean;
  timezone: string;
  morningLocalTime: string;
  afternoonLocalTime: string;
  emailRecipients: string[];
  autoSyncBeforeBriefing: boolean;
  lookbackHours: number;
  activeSourceTypes: BriefingSourceType[];
  autoBriefingEnabled: boolean;
  canEdit: boolean;
};

export function parseBriefingItemSummaryJson(value: Prisma.JsonValue | null): BriefingItemSummaryJson {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const raw = value as Record<string, unknown>;
  return {
    keyFacts: Array.isArray(raw.keyFacts)
      ? raw.keyFacts.filter((fact): fact is string => typeof fact === "string")
      : undefined,
    requiredAction: typeof raw.requiredAction === "string" ? raw.requiredAction : null,
    suggestedReplyNotes:
      typeof raw.suggestedReplyNotes === "string" ? raw.suggestedReplyNotes : null,
    confidence: typeof raw.confidence === "number" ? raw.confidence : null,
    dataProvenance:
      typeof raw.dataProvenance === "string" ? raw.dataProvenance : undefined,
    isPropertyManagementRelated:
      typeof raw.isPropertyManagementRelated === "boolean"
        ? raw.isPropertyManagementRelated
        : undefined,
    sender: typeof raw.sender === "string" ? raw.sender : null,
    senderEmail: typeof raw.senderEmail === "string" ? raw.senderEmail : null,
  };
}

export function shouldShowEmailMentionLabel(args: {
  category: BriefingItemCategory;
  dataProvenance?: string | null;
}): boolean {
  if (args.category === BriefingItemCategory.RENT_DEPOSIT) return true;
  return args.dataProvenance === BRIEFING_DATA_PROVENANCE.EMAIL_MENTION;
}

const URGENCY_RANK: Record<BriefingItemUrgency, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

const CATEGORY_RANK: Record<BriefingItemCategory, number> = {
  URGENT: 0,
  LANDLORD: 1,
  TENANT: 2,
  MAINTENANCE: 3,
  RENT_DEPOSIT: 4,
  STRATA: 5,
  GENERAL_ADMIN: 6,
};

export function sortBriefingItemsForDisplay(items: BriefingItemView[]): BriefingItemView[] {
  return [...items].sort((a, b) => {
    const urgencyDiff = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;
    const categoryDiff = CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
    if (categoryDiff !== 0) return categoryDiff;
    return a.sortOrder - b.sortOrder;
  });
}

export function groupBriefingItemsByCategory(
  items: BriefingItemView[],
): Array<{ category: BriefingItemCategory; items: BriefingItemView[] }> {
  const sorted = sortBriefingItemsForDisplay(items);
  const groups = new Map<BriefingItemCategory, BriefingItemView[]>();

  for (const item of sorted) {
    const existing = groups.get(item.category) ?? [];
    existing.push(item);
    groups.set(item.category, existing);
  }

  return [...groups.entries()]
    .sort(([categoryA, itemsA], [categoryB, itemsB]) => {
      const bestUrgencyA = Math.min(...itemsA.map((item) => URGENCY_RANK[item.urgency]));
      const bestUrgencyB = Math.min(...itemsB.map((item) => URGENCY_RANK[item.urgency]));
      if (bestUrgencyA !== bestUrgencyB) return bestUrgencyA - bestUrgencyB;
      return CATEGORY_RANK[categoryA] - CATEGORY_RANK[categoryB];
    })
    .map(([category, groupItems]) => ({ category, items: groupItems }));
}

function mapItem(row: {
  id: string;
  summaryTitle: string;
  category: BriefingItemCategory;
  urgency: BriefingItemUrgency;
  sourceType: BriefingSourceType;
  subject: string | null;
  emailThreadId: string | null;
  dueDate: Date | null;
  sortOrder: number;
  summaryJson: Prisma.JsonValue | null;
}): BriefingItemView {
  const summary = parseBriefingItemSummaryJson(row.summaryJson);
  return {
    id: row.id,
    summaryTitle: row.summaryTitle,
    category: row.category,
    urgency: row.urgency,
    sourceType: row.sourceType,
    subject: row.subject,
    emailThreadId: row.emailThreadId,
    dueDate: row.dueDate,
    sortOrder: row.sortOrder,
    summary,
    showEmailMentionLabel: shouldShowEmailMentionLabel({
      category: row.category,
      dataProvenance: summary.dataProvenance,
    }),
  };
}

function mapRun(row: {
  id: string;
  slot: BriefingSlot;
  status: BriefingRunStatus;
  windowStart: Date;
  windowEnd: Date;
  threadsScanned: number;
  itemsIncluded: number;
  itemsSkipped: number;
  executiveSummary: string | null;
  estimatedReadingMinutes: number | null;
  errorMessage: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  items: Array<{
    id: string;
    summaryTitle: string;
    category: BriefingItemCategory;
    urgency: BriefingItemUrgency;
    sourceType: BriefingSourceType;
    subject: string | null;
    emailThreadId: string | null;
    dueDate: Date | null;
    sortOrder: number;
    summaryJson: Prisma.JsonValue | null;
  }>;
}): BriefingRunSummary {
  return {
    id: row.id,
    slot: row.slot,
    status: row.status,
    windowStart: row.windowStart,
    windowEnd: row.windowEnd,
    threadsScanned: row.threadsScanned,
    itemsIncluded: row.itemsIncluded,
    itemsSkipped: row.itemsSkipped,
    executiveSummary: row.executiveSummary,
    estimatedReadingMinutes: row.estimatedReadingMinutes,
    errorMessage: row.errorMessage,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    items: row.items.map(mapItem),
  };
}

export async function getBriefingOverview(organizationId: string): Promise<BriefingOverview> {
  const [settings, policy, runs] = await Promise.all([
    prisma.briefingSettings.findUnique({ where: { organizationId } }),
    prisma.organizationAiPolicy.findUnique({ where: { organizationId } }),
    prisma.briefingRun.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        items: {
          orderBy: [{ urgency: "asc" }, { sortOrder: "asc" }],
        },
      },
    }),
  ]);

  const latestBySlot: Partial<Record<BriefingSlot, BriefingRunSummary>> = {};

  for (const slot of [BriefingSlot.MORNING, BriefingSlot.AFTERNOON] as const) {
    const latest = runs.find((run) => run.slot === slot);
    if (latest) {
      latestBySlot[slot] = mapRun(latest);
    }
  }

  return {
    settingsEnabled: settings?.enabled ?? false,
    autoBriefingEnabled: policy?.autoBriefingEnabled ?? false,
    latestBySlot,
  };
}

export async function getBriefingRunDetail(args: {
  organizationId: string;
  runId: string;
}): Promise<BriefingRunSummary | null> {
  const run = await prisma.briefingRun.findFirst({
    where: { id: args.runId, organizationId: args.organizationId },
    include: {
      items: {
        orderBy: [{ urgency: "asc" }, { sortOrder: "asc" }],
      },
    },
  });

  if (!run) return null;
  return mapRun(run);
}

export async function getBriefingSettingsView(args: {
  organizationId: string;
  canEdit: boolean;
}): Promise<BriefingSettingsView> {
  const [settings, policy, organization] = await Promise.all([
    prisma.briefingSettings.findUnique({ where: { organizationId: args.organizationId } }),
    prisma.organizationAiPolicy.findUnique({ where: { organizationId: args.organizationId } }),
    prisma.organization.findUnique({
      where: { id: args.organizationId },
      select: { name: true },
    }),
  ]);

  return {
    organizationId: args.organizationId,
    organizationName: organization?.name ?? "Organization",
    enabled: settings?.enabled ?? false,
    morningEnabled: settings?.morningEnabled ?? true,
    afternoonEnabled: settings?.afternoonEnabled ?? true,
    timezone: settings?.timezone ?? "America/Vancouver",
    morningLocalTime: settings?.morningLocalTime ?? "07:00",
    afternoonLocalTime: settings?.afternoonLocalTime ?? "14:00",
    emailRecipients: settings?.emailRecipients ?? [],
    autoSyncBeforeBriefing: settings?.autoSyncBeforeBriefing ?? true,
    lookbackHours: settings?.lookbackHours ?? 12,
    activeSourceTypes: settings?.activeSourceTypes ?? [BriefingSourceType.EMAIL],
    autoBriefingEnabled: policy?.autoBriefingEnabled ?? false,
    canEdit: args.canEdit,
  };
}

export const BRIEFING_CATEGORY_LABELS: Record<BriefingItemCategory, string> = {
  URGENT: "Urgent",
  LANDLORD: "Landlord",
  TENANT: "Tenant",
  MAINTENANCE: "Maintenance",
  RENT_DEPOSIT: "Rent / deposit (email mention)",
  STRATA: "Strata",
  GENERAL_ADMIN: "General admin",
};

export const BRIEFING_STATUS_LABELS: Record<BriefingRunStatus, string> = {
  PENDING: "Pending",
  RUNNING: "Running",
  COMPLETED: "Completed",
  FAILED: "Failed",
  PARTIAL: "Partial",
};

export const BRIEFING_SLOT_LABELS: Record<BriefingSlot, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
};
