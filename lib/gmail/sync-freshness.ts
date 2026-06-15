import { USER_RESTART_MS } from "@/lib/gmail/restart-gmail-sync";

export type SyncFreshnessLevel =
  | "never"
  | "fresh"
  | "stale"
  | "overdue"
  | "in_progress"
  | "sync_stuck";

export type SyncFreshness = {
  level: SyncFreshnessLevel;
  label: string;
};

export type ActiveSyncJobState = {
  status: "PENDING" | "RUNNING";
  startedAt: Date;
};

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;

function getOverdueThresholdMs(): number {
  const raw = Number(process.env.GMAIL_SYNC_OVERDUE_HOURS ?? "24");
  const hours = Number.isFinite(raw) && raw > 0 ? raw : 24;
  return hours * MS_PER_HOUR;
}

function formatRelativeMinutes(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1 hour ago";
  return `${hours} hours ago`;
}

function getActiveSyncFreshness(
  activeSyncJob: ActiveSyncJobState,
  now: Date,
): SyncFreshness {
  const ageMs = now.getTime() - activeSyncJob.startedAt.getTime();

  if (ageMs >= USER_RESTART_MS) {
    return {
      level: "sync_stuck",
      label: "Sync appears stuck. You can restart it.",
    };
  }

  if (activeSyncJob.status === "PENDING") {
    return { level: "in_progress", label: "Sync queued" };
  }

  return { level: "in_progress", label: "Sync in progress" };
}

/**
 * Lightweight inbox sync freshness label for staff visibility.
 */
export function getSyncFreshness(args: {
  lastSyncedAt: Date | null;
  syncInProgress?: boolean;
  activeSyncJob?: ActiveSyncJobState | null;
  now?: Date;
}): SyncFreshness {
  const now = args.now ?? new Date();

  if (args.activeSyncJob) {
    return getActiveSyncFreshness(args.activeSyncJob, now);
  }

  if (args.syncInProgress) {
    return { level: "in_progress", label: "Sync in progress" };
  }

  if (!args.lastSyncedAt) {
    return { level: "never", label: "Never synced" };
  }

  const elapsedMs = now.getTime() - args.lastSyncedAt.getTime();
  const minutes = Math.max(0, Math.floor(elapsedMs / MS_PER_MINUTE));

  if (elapsedMs >= getOverdueThresholdMs()) {
    return { level: "overdue", label: "Sync overdue" };
  }

  const label = `Last synced ${formatRelativeMinutes(minutes)}`;

  if (minutes < 30) {
    return { level: "fresh", label };
  }

  return { level: "stale", label };
}
