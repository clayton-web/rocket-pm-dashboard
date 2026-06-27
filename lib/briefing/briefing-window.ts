import {
  BRIEFING_DEFAULT_LOOKBACK_HOURS,
  BRIEFING_MAX_LOOKBACK_HOURS,
  type BriefingWindow,
} from "@/lib/briefing/briefing-types";

const MS_PER_HOUR = 3_600_000;

export type CalculateBriefingWindowInput = {
  now: Date;
  lookbackHours?: number;
  lastCompletedRun?: { windowEnd: Date } | null;
};

function clampLookbackHours(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) {
    return BRIEFING_DEFAULT_LOOKBACK_HOURS;
  }
  return Math.min(Math.max(Math.floor(hours), 1), BRIEFING_MAX_LOOKBACK_HOURS);
}

/**
 * Computes the activity window for a briefing run.
 * When a prior completed run exists, the window starts at its windowEnd (no overlap).
 */
export function calculateBriefingWindow(input: CalculateBriefingWindowInput): BriefingWindow {
  const windowEnd = input.now;
  const lookbackHours = clampLookbackHours(
    input.lookbackHours ?? BRIEFING_DEFAULT_LOOKBACK_HOURS,
  );

  if (input.lastCompletedRun?.windowEnd) {
    const windowStart = input.lastCompletedRun.windowEnd;
    if (windowStart.getTime() >= windowEnd.getTime()) {
      return {
        windowStart: new Date(windowEnd.getTime() - lookbackHours * MS_PER_HOUR),
        windowEnd,
      };
    }
    return { windowStart, windowEnd };
  }

  return {
    windowStart: new Date(windowEnd.getTime() - lookbackHours * MS_PER_HOUR),
    windowEnd,
  };
}
