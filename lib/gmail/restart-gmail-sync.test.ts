import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BackgroundJobStatus, Prisma } from "@prisma/client";
import {
  USER_RESTART_MS,
  USER_RESTART_REASON,
  isGmailSyncJobRestartEligible,
  restartGmailSyncJob,
} from "@/lib/gmail/restart-gmail-sync";
import { getSyncFreshness } from "@/lib/gmail/sync-freshness";
import { JOB_TYPES } from "@/lib/jobs/types";

const ORG_ID = "org_test";
const ACCOUNT_A = "acct_a";

type JobRow = {
  id: string;
  organizationId: string;
  jobType: string;
  status: BackgroundJobStatus;
  payload: Prisma.JsonValue;
  lockedAt: Date | null;
  lockedBy: string | null;
  createdAt: Date;
  scheduledAt: Date;
  attempts: number;
  maxAttempts: number;
  completedAt: Date | null;
  lastError: string | null;
  idempotencyKey: string;
  triggerSource: string;
  triggeredByUserId: string | null;
  priority: number;
};

function matchesPayloadFilter(
  payload: Prisma.JsonValue,
  filter: { path: string[]; equals: unknown } | undefined,
): boolean {
  if (!filter) return true;
  if (!payload || typeof payload !== "object") return false;
  const [key] = filter.path;
  if (!key) return false;
  return (payload as Record<string, unknown>)[key] === filter.equals;
}

function createJobStore() {
  const jobs = new Map<string, JobRow>();
  let nextId = 1;

  function addJob(
    partial: Partial<JobRow> & {
      payload: Prisma.JsonValue;
      status: BackgroundJobStatus;
      createdAt: Date;
    },
  ): JobRow {
    const job: JobRow = {
      id: `job_${nextId++}`,
      organizationId: ORG_ID,
      jobType: JOB_TYPES.GMAIL_SYNC,
      lockedAt: null,
      lockedBy: null,
      scheduledAt: partial.createdAt,
      attempts: 0,
      maxAttempts: 3,
      completedAt: null,
      lastError: null,
      idempotencyKey: `key_${nextId}`,
      triggerSource: "USER",
      triggeredByUserId: "user_test",
      priority: 10,
      ...partial,
    };
    jobs.set(job.id, job);
    return job;
  }

  function createDb() {
    const db = {
      backgroundJob: {
        findMany: async ({
          where,
        }: {
          where: {
            organizationId?: string;
            jobType?: string;
            status?: { in: BackgroundJobStatus[] };
            payload?: { path: string[]; equals: unknown };
          };
        }) =>
          [...jobs.values()].filter((job) => {
            if (where.organizationId && job.organizationId !== where.organizationId) return false;
            if (where.jobType && job.jobType !== where.jobType) return false;
            if (where.status?.in && !where.status.in.includes(job.status)) return false;
            if (!matchesPayloadFilter(job.payload, where.payload)) return false;
            return true;
          }),
        findFirst: async ({
          where,
          orderBy,
        }: {
          where: {
            organizationId?: string;
            jobType?: string;
            status?: { in: BackgroundJobStatus[] };
            payload?: { path: string[]; equals: unknown };
          };
          orderBy?: { createdAt: "desc" | "asc" };
        }) => {
          const matches = [...jobs.values()].filter((job) => {
            if (where.organizationId && job.organizationId !== where.organizationId) return false;
            if (where.jobType && job.jobType !== where.jobType) return false;
            if (where.status?.in && !where.status.in.includes(job.status)) return false;
            if (!matchesPayloadFilter(job.payload, where.payload)) return false;
            return true;
          });
          if (orderBy?.createdAt === "desc") {
            matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          }
          return matches[0] ?? null;
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: { id?: string; status?: { in: BackgroundJobStatus[] } };
          data: Partial<JobRow>;
        }) => {
          let count = 0;
          for (const job of jobs.values()) {
            if (where.id && job.id !== where.id) continue;
            if (where.status?.in && !where.status.in.includes(job.status)) continue;
            Object.assign(job, data);
            count += 1;
          }
          return { count };
        },
      },
      $transaction: async <T>(fn: (tx: typeof db) => Promise<T>) => fn(db),
    };

    return db;
  }

  return { jobs, addJob, createDb };
}

describe("restartGmailSyncJob", () => {
  it("does not cancel a fresh job", async () => {
    const store = createJobStore();
    const db = store.createDb();
    const realNow = Date.now();
    const fresh = store.addJob({
      status: "RUNNING",
      payload: { connectedAccountId: ACCOUNT_A },
      createdAt: new Date(realNow - 2 * 60 * 1000),
      lockedAt: new Date(realNow - 60_000),
      lockedBy: "worker-1",
    });

    const result = await restartGmailSyncJob(
      {
        organizationId: ORG_ID,
        connectedAccountId: ACCOUNT_A,
        triggeredByUserId: "user_test",
      },
      { db },
    );

    assert.equal(result.restarted, false);
    if (!result.restarted) {
      assert.equal(result.reason, "still_running");
      assert.equal(result.jobId, fresh.id);
    }
    assert.equal(store.jobs.get(fresh.id)?.status, "RUNNING");
  });

  it("cancels a 5+ minute old job and enqueues a new job", async () => {
    const store = createJobStore();
    const db = store.createDb();
    const realNow = Date.now();
    const stale = store.addJob({
      status: "PENDING",
      payload: { connectedAccountId: ACCOUNT_A },
      createdAt: new Date(realNow - USER_RESTART_MS - 1_000),
    });

    const result = await restartGmailSyncJob(
      {
        organizationId: ORG_ID,
        connectedAccountId: ACCOUNT_A,
        triggeredByUserId: "user_test",
      },
      {
        db,
        enqueue: async () => ({
          jobId: "job_new",
          created: true,
          alreadyQueued: false,
        }),
      },
    );

    assert.equal(result.restarted, true);
    if (result.restarted) {
      assert.equal(result.jobId, "job_new");
      assert.deepEqual(result.cancelledJobIds, [stale.id]);
    }

    const cancelled = store.jobs.get(stale.id);
    assert.equal(cancelled?.status, "CANCELLED");
    assert.equal(cancelled?.lastError, USER_RESTART_REASON);
    assert.equal(cancelled?.lockedAt, null);
    assert.equal(cancelled?.lockedBy, null);
    assert.ok(cancelled?.completedAt);
  });
});

describe("getSyncFreshness restart UI state", () => {
  const now = new Date("2026-06-03T12:00:00.000Z");

  it("shows sync_stuck when active sync is 5+ minutes old", () => {
    const result = getSyncFreshness({
      lastSyncedAt: new Date("2026-06-03T11:00:00.000Z"),
      activeSyncJob: {
        status: "RUNNING",
        startedAt: new Date(now.getTime() - USER_RESTART_MS),
      },
      now,
    });

    assert.equal(result.level, "sync_stuck");
    assert.equal(result.label, "Sync appears stuck. You can restart it.");
  });

  it("shows in_progress when active sync is younger than 5 minutes", () => {
    const result = getSyncFreshness({
      lastSyncedAt: new Date("2026-06-03T11:00:00.000Z"),
      activeSyncJob: {
        status: "RUNNING",
        startedAt: new Date(now.getTime() - 2 * 60 * 1000),
      },
      now,
    });

    assert.equal(result.level, "in_progress");
    assert.equal(result.label, "Sync in progress");
  });

  it("shows queued label for fresh pending sync", () => {
    const result = getSyncFreshness({
      lastSyncedAt: null,
      activeSyncJob: {
        status: "PENDING",
        startedAt: new Date(now.getTime() - 60_000),
      },
      now,
    });

    assert.equal(result.level, "in_progress");
    assert.equal(result.label, "Sync queued");
  });
});

describe("isGmailSyncJobRestartEligible", () => {
  it("uses lockedAt for RUNNING jobs", () => {
    const now = new Date("2026-06-03T12:00:00.000Z");
    assert.equal(
      isGmailSyncJobRestartEligible(
        {
          status: "RUNNING",
          lockedAt: new Date("2026-06-03T11:54:00.000Z"),
          createdAt: new Date("2026-06-03T11:00:00.000Z"),
        },
        now,
      ),
      true,
    );
  });
});
