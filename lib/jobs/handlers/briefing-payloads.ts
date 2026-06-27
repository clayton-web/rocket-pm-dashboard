import type { BriefingSlot } from "@prisma/client";

export type BriefingSchedulePayload = {
  organizationId?: string;
  slot?: BriefingSlot;
  nowIso?: string;
  dryRun?: boolean;
};

export type BriefingGeneratePayload = {
  organizationId?: string;
  slot: BriefingSlot;
  windowStartIso?: string;
  windowEndIso?: string;
  force?: boolean;
  dryRun?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSlot(value: unknown): BriefingSlot | null {
  if (value === "MORNING" || value === "AFTERNOON") return value;
  return null;
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function parseBriefingSchedulePayload(payload: unknown): BriefingSchedulePayload {
  if (!isRecord(payload)) return {};

  const slot = parseSlot(payload.slot);

  return {
    organizationId:
      typeof payload.organizationId === "string" && payload.organizationId.length > 0
        ? payload.organizationId
        : undefined,
    slot: slot ?? undefined,
    nowIso: typeof payload.nowIso === "string" ? payload.nowIso : undefined,
    dryRun: payload.dryRun === true,
  };
}

export function parseBriefingGeneratePayload(payload: unknown): BriefingGeneratePayload {
  if (!isRecord(payload)) {
    throw new Error("briefing.generate payload must be an object.");
  }

  const slot = parseSlot(payload.slot);
  if (!slot) {
    throw new Error('briefing.generate payload must include slot "MORNING" or "AFTERNOON".');
  }

  return {
    organizationId:
      typeof payload.organizationId === "string" && payload.organizationId.length > 0
        ? payload.organizationId
        : undefined,
    slot,
    windowStartIso:
      typeof payload.windowStartIso === "string" ? payload.windowStartIso : undefined,
    windowEndIso: typeof payload.windowEndIso === "string" ? payload.windowEndIso : undefined,
    force: payload.force === true,
    dryRun: payload.dryRun === true,
  };
}

export function parseOptionalIsoDateFromPayload(value: string | undefined): Date | null {
  if (!value) return null;
  return parseIsoDate(value);
}
