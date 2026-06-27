import type { BriefingSlot } from "@prisma/client";

function formatUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Idempotency key for briefing.schedule cron fan-out (one per org/slot/day). */
export function buildBriefingScheduleIdempotencyKey(args: {
  organizationId: string;
  slot: BriefingSlot;
  scheduleDate: Date;
}): string {
  return `briefing-schedule:${args.organizationId}:${args.slot}:${formatUtcDateKey(args.scheduleDate)}`;
}

/** Idempotency key for briefing.generate (one per org/slot/window end). */
export function buildBriefingGenerateIdempotencyKey(args: {
  organizationId: string;
  slot: BriefingSlot;
  windowEnd: Date;
}): string {
  return `briefing-generate:${args.organizationId}:${args.slot}:${args.windowEnd.toISOString()}`;
}
