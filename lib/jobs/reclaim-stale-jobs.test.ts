import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BackgroundJobStatus, Prisma } from "@prisma/client";
import {
  RECLAIM_REASON,
  STALE_PENDING_MS,
  STALE_RUNNING_MS,
  reclaimStaleGmailSyncJobs,
} from "@/lib/jobs/reclaim-stale-jobs";
import { JOB_TYPES } from "@/lib/jobs/types";

const ORG_ID = "org_test";
const ACCOUNT_A = "acct_a";
const ACCOUNT_B = "acct_b";

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
          };
        }) =>
          [...jobs.values()].filter((job) => {
            if (where.organizationId && job.organizationId !== where.organizationId) return false;
            if (where.jobType && job.jobType !== where.jobType) return false;
            if (where.status?.in && !where.status.in.includes(job.status)) return false;
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
        findUnique: async () => null,
        create: async ({
          data,
        }: {
          data: {
            organizationId: string;
            jobType: string;
            status?: BackgroundJobStatus;
            payload?: Prisma.JsonValue;
            lockedAt?: Date | null;
            lockedBy?: string | null;
            createdAt?: Date;
            scheduledAt?: Date;
            attempts?: number;
            maxAttempts?: number;
            completedAt?: Date | null;
            lastError?: string | null;
            idempotencyKey: string;
            triggerSource: string;
            triggeredByUserId?: string | null;
            priority?: number;
          };
        }) => {
          const job: JobRow = {
            id: `job_${nextId++}`,
            organizationId: data.organizationId,
            jobType: data.jobType,
            status: data.status ?? "PENDING",
            payload: data.payload ?? null,
            lockedAt: data.lockedAt ?? null,
            lockedBy: data.lockedBy ?? null,
            createdAt: data.createdAt ?? new Date(),
            scheduledAt: data.scheduledAt ?? new Date(),
            attempts: data.attempts ?? 0,
            maxAttempts: data.maxAttempts ?? 3,
            completedAt: data.completedAt ?? null,
            lastError: data.lastError ?? null,
            idempotencyKey: data.idempotencyKey,
            triggerSource: data.triggerSource,
            triggeredByUserId: data.triggeredByUserId ?? null,
            priority: data.priority ?? 0,
          };
          jobs.set(job.id, job);
          return job;
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
      organization: {
        findUnique: async () => ({ id: ORG_ID }),
      },
      organizationAiPolicy: {
        upsert: async () => ({}),
      },
      auditLog: {
        create: async () => ({}),
      },
      $transaction: async <T>(fn: (tx: typeof db) => Promise<T>) => fn(db),
    };

    return db;
  }

  return { jobs, addJob, createDb };
}

describe("reclaimStaleGmailSyncJobs", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("reclaims stale RUNNING job", async () => {
    const store = createJobStore();
    const db = store.createDb();
    const job = store.addJob({
      status: "RUNNING",
      payload: { connectedAccountId: ACCOUNT_A },
      createdAt: new Date(now.getTime() - 60 * 60 * 1000),
      lockedAt: new Date(now.getTime() - STALE_RUNNING_MS - 1_000),
      lockedBy: "worker-1",
      attempts: 2,
    });

    const result = await reclaimStaleGmailSyncJobs({ organizationId: ORG_ID, now }, db);

    assert.equal(result.reclaimed.length, 1);
    assert.equal(result.reclaimed[0]?.jobId, job.id);
    assert.equal(result.reclaimed[0]?.previousStatus, "RUNNING");
    assert.equal(result.reclaimed[0]?.reason, RECLAIM_REASON.STALE_RUNNING);

    const updated = store.jobs.get(job.id);
    assert.equal(updated?.status, "CANCELLED");
    assert.equal(updated?.lockedAt, null);
    assert.equal(updated?.lockedBy, null);
    assert.equal(updated?.lastError, RECLAIM_REASON.STALE_RUNNING);
    assert.equal(updated?.completedAt?.toISOString(), now.toISOString());
    assert.equal(updated?.attempts, 2);
  });

  it("does not reclaim fresh RUNNING job", async () => {
    const store = createJobStore();
    const db = store.createDb();
    const job = store.addJob({
      status: "RUNNING",
      payload: { connectedAccountId: ACCOUNT_A },
      createdAt: new Date(now.getTime() - 60 * 60 * 1000),
      lockedAt: new Date(now.getTime() - 60_000),
      lockedBy: "worker-1",
    });

    const result = await reclaimStaleGmailSyncJobs({ organizationId: ORG_ID, now }, db);

    assert.equal(result.reclaimed.length, 0);
    assert.equal(store.jobs.get(job.id)?.status, "RUNNING");
  });

  it("reclaims stale PENDING job", async () => {
    const store = createJobStore();
    const db = store.createDb();
    const job = store.addJob({
      status: "PENDING",
      payload: { connectedAccountId: ACCOUNT_A },
      createdAt: new Date(now.getTime() - STALE_PENDING_MS - 1_000),
    });

    const result = await reclaimStaleGmailSyncJobs({ organizationId: ORG_ID, now }, db);

    assert.equal(result.reclaimed.length, 1);
    assert.equal(result.reclaimed[0]?.reason, RECLAIM_REASON.STALE_PENDING);
    assert.equal(store.jobs.get(job.id)?.status, "CANCELLED");
    assert.equal(store.jobs.get(job.id)?.lastError, RECLAIM_REASON.STALE_PENDING);
  });

  it("does not reclaim fresh PENDING job", async () => {
    const store = createJobStore();
    const db = store.createDb();
    const job = store.addJob({
      status: "PENDING",
      payload: { connectedAccountId: ACCOUNT_A },
      createdAt: new Date(now.getTime() - 5 * 60 * 1000),
    });

    const result = await reclaimStaleGmailSyncJobs({ organizationId: ORG_ID, now }, db);

    assert.equal(result.reclaimed.length, 0);
    assert.equal(store.jobs.get(job.id)?.status, "PENDING");
  });

  it("scopes reclaim to one connectedAccountId", async () => {
    const store = createJobStore();
    const db = store.createDb();
    const staleA = store.addJob({
      status: "RUNNING",
      payload: { connectedAccountId: ACCOUNT_A },
      createdAt: new Date(now.getTime() - 60 * 60 * 1000),
      lockedAt: new Date(now.getTime() - STALE_RUNNING_MS - 1_000),
      lockedBy: "worker-1",
    });
    const staleB = store.addJob({
      status: "PENDING",
      payload: { connectedAccountId: ACCOUNT_B },
      createdAt: new Date(now.getTime() - STALE_PENDING_MS - 1_000),
    });

    const result = await reclaimStaleGmailSyncJobs(
      {
        organizationId: ORG_ID,
        connectedAccountId: ACCOUNT_A,
        now,
      },
      db,
    );

    assert.equal(result.reclaimed.length, 1);
    assert.equal(result.reclaimed[0]?.jobId, staleA.id);
    assert.equal(store.jobs.get(staleA.id)?.status, "CANCELLED");
    assert.equal(store.jobs.get(staleB.id)?.status, "PENDING");
  });
});

describe("gmail sync enqueue integration with stale reclaim", () => {
  async function simulateEnqueueGmailSyncJob(
    db: ReturnType<ReturnType<typeof createJobStore>["createDb"]>,
    args: {
      organizationId: string;
      connectedAccountId: string;
    },
  ) {
    await reclaimStaleGmailSyncJobs(
      {
        organizationId: args.organizationId,
        connectedAccountId: args.connectedAccountId,
      },
      db,
    );

    const activeJob = await db.backgroundJob.findFirst({
      where: {
        organizationId: args.organizationId,
        jobType: JOB_TYPES.GMAIL_SYNC,
        status: { in: ["PENDING", "RUNNING"] },
        payload: {
          path: ["connectedAccountId"],
          equals: args.connectedAccountId,
        },
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    if (activeJob) {
      return { jobId: activeJob.id, created: false, alreadyQueued: true };
    }

    const job = await db.backgroundJob.create({
      data: {
        organizationId: args.organizationId,
        jobType: JOB_TYPES.GMAIL_SYNC,
        idempotencyKey: `gmail-sync:${args.connectedAccountId}:test`,
        payload: { connectedAccountId: args.connectedAccountId },
        triggerSource: "USER",
        triggeredByUserId: "user_test",
        priority: 10,
      },
    });

    return { jobId: job.id, created: true, alreadyQueued: false };
  }

  async function simulateGetActiveGmailSyncAccountIds(
    db: ReturnType<ReturnType<typeof createJobStore>["createDb"]>,
    args: {
      organizationId: string;
      connectedAccountIds: string[];
    },
  ) {
    if (args.connectedAccountIds.length === 0) return new Set<string>();

    await reclaimStaleGmailSyncJobs(
      {
        organizationId: args.organizationId,
      },
      db,
    );

    const jobs = await db.backgroundJob.findMany({
      where: {
        organizationId: args.organizationId,
        jobType: JOB_TYPES.GMAIL_SYNC,
        status: { in: ["PENDING", "RUNNING"] },
      },
      select: { payload: true },
    });

    const active = new Set<string>();
    const allowed = new Set(args.connectedAccountIds);

    for (const job of jobs) {
      const payload = job.payload;
      if (!payload || typeof payload !== "object") continue;
      const accountId = (payload as { connectedAccountId?: unknown }).connectedAccountId;
      if (typeof accountId === "string" && allowed.has(accountId)) {
        active.add(accountId);
      }
    }

    return active;
  }

  it("enqueue creates a new job after stale job is reclaimed", async () => {
    const store = createJobStore();
    const db = store.createDb();
    const realNow = Date.now();

    store.addJob({
      status: "RUNNING",
      payload: { connectedAccountId: ACCOUNT_A },
      createdAt: new Date(realNow - 60 * 60 * 1000),
      lockedAt: new Date(realNow - STALE_RUNNING_MS - 1_000),
      lockedBy: "worker-1",
    });

    const result = await simulateEnqueueGmailSyncJob(db, {
      organizationId: ORG_ID,
      connectedAccountId: ACCOUNT_A,
    });

    assert.equal(result.created, true);
    assert.equal(result.alreadyQueued, false);

    const activeJobs = [...store.jobs.values()].filter((job) =>
      ["PENDING", "RUNNING"].includes(job.status),
    );
    assert.equal(activeJobs.length, 1);
    assert.equal(activeJobs[0]?.id, result.jobId);
    assert.equal(activeJobs[0]?.status, "PENDING");

    const cancelled = [...store.jobs.values()].filter((job) => job.status === "CANCELLED");
    assert.equal(cancelled.length, 1);
  });

  it("enqueue still dedupes if a fresh active job exists", async () => {
    const store = createJobStore();
    const db = store.createDb();
    const realNow = Date.now();

    const fresh = store.addJob({
      status: "RUNNING",
      payload: { connectedAccountId: ACCOUNT_A },
      createdAt: new Date(realNow - 5 * 60 * 1000),
      lockedAt: new Date(realNow - 60_000),
      lockedBy: "worker-1",
    });

    const result = await simulateEnqueueGmailSyncJob(db, {
      organizationId: ORG_ID,
      connectedAccountId: ACCOUNT_A,
    });

    assert.equal(result.created, false);
    assert.equal(result.alreadyQueued, true);
    assert.equal(result.jobId, fresh.id);

    const pendingOrRunning = [...store.jobs.values()].filter((job) =>
      ["PENDING", "RUNNING"].includes(job.status),
    );
    assert.equal(pendingOrRunning.length, 1);
  });

  it("active sync account IDs exclude reclaimed jobs", async () => {
    const store = createJobStore();
    const db = store.createDb();
    const realNow = Date.now();

    const staleA = store.addJob({
      status: "RUNNING",
      payload: { connectedAccountId: ACCOUNT_A },
      createdAt: new Date(realNow - 60 * 60 * 1000),
      lockedAt: new Date(realNow - STALE_RUNNING_MS - 1_000),
      lockedBy: "worker-1",
    });
    store.addJob({
      status: "RUNNING",
      payload: { connectedAccountId: ACCOUNT_B },
      createdAt: new Date(realNow - 5 * 60 * 1000),
      lockedAt: new Date(realNow - 60_000),
      lockedBy: "worker-1",
    });

    const active = await simulateGetActiveGmailSyncAccountIds(db, {
      organizationId: ORG_ID,
      connectedAccountIds: [ACCOUNT_A, ACCOUNT_B],
    });

    assert.deepEqual([...active].sort(), [ACCOUNT_B]);
    assert.equal(store.jobs.get(staleA.id)?.status, "CANCELLED");
  });
});
