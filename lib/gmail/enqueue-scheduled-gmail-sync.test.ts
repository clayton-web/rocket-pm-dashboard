import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";
import { JOB_TYPES } from "@/lib/jobs/types";
import {
  enqueueScheduledGmailSyncForConnectedAccounts,
  type ConnectedGmailAccountRef,
} from "@/lib/gmail/enqueue-scheduled-gmail-sync";
import { enqueueScheduledGmailSyncForBriefing } from "@/lib/briefing/enqueue-scheduled-gmail-sync";

const ORG_A = "org_a";
const ORG_B = "org_b";
const ACCOUNT_A1 = "acct_a1";
const ACCOUNT_A2 = "acct_a2";
const ACCOUNT_B1 = "acct_b1";

type RecordedEnqueue = {
  organizationId: string;
  connectedAccountId: string;
  triggeredByUserId: string;
  triggerSource?: "USER" | "CRON" | "SYSTEM";
};

function connectedAccounts(): ConnectedGmailAccountRef[] {
  return [
    { id: ACCOUNT_A1, organizationId: ORG_A },
    { id: ACCOUNT_A2, organizationId: ORG_A },
    { id: ACCOUNT_B1, organizationId: ORG_B },
  ];
}

describe("enqueueScheduledGmailSyncForConnectedAccounts", () => {
  const prevBriefingEnv = process.env.BRIEFING_AUTOMATION_ENABLED;

  afterEach(() => {
    if (prevBriefingEnv === undefined) delete process.env.BRIEFING_AUTOMATION_ENABLED;
    else process.env.BRIEFING_AUTOMATION_ENABLED = prevBriefingEnv;
  });

  it("enqueues gmail.sync for connected accounts without briefing env, settings, or policy", async () => {
    process.env.BRIEFING_AUTOMATION_ENABLED = "false";
    const recorded: RecordedEnqueue[] = [];

    const result = await enqueueScheduledGmailSyncForConnectedAccounts(
      { actorUserId: "cron_actor" },
      {
        listConnectedAccounts: async () => connectedAccounts(),
        enqueueSyncJob: async (args) => {
          recorded.push(args);
          return {
            jobId: `job_${args.connectedAccountId}`,
            created: true,
            alreadyQueued: false,
          };
        },
      },
    );

    assert.equal(result.accountsConsidered, 3);
    assert.equal(result.enqueued, 3);
    assert.equal(result.alreadyQueued, 0);
    assert.deepEqual(
      recorded.map((row) => ({
        organizationId: row.organizationId,
        connectedAccountId: row.connectedAccountId,
        triggerSource: row.triggerSource,
      })),
      [
        { organizationId: ORG_A, connectedAccountId: ACCOUNT_A1, triggerSource: "CRON" },
        { organizationId: ORG_A, connectedAccountId: ACCOUNT_A2, triggerSource: "CRON" },
        { organizationId: ORG_B, connectedAccountId: ACCOUNT_B1, triggerSource: "CRON" },
      ],
    );
    assert.equal(
      recorded.every((row) => row.triggeredByUserId === "cron_actor"),
      true,
    );
  });

  it("scopes connected accounts to the requested organization", async () => {
    const listedOrgs: Array<string | undefined> = [];
    const recorded: RecordedEnqueue[] = [];

    const result = await enqueueScheduledGmailSyncForConnectedAccounts(
      { actorUserId: "cron_actor", organizationId: ORG_A },
      {
        listConnectedAccounts: async (args) => {
          listedOrgs.push(args?.organizationId);
          return connectedAccounts().filter((account) => account.organizationId === ORG_A);
        },
        enqueueSyncJob: async (args) => {
          recorded.push(args);
          return {
            jobId: `job_${args.connectedAccountId}`,
            created: true,
            alreadyQueued: false,
          };
        },
      },
    );

    assert.deepEqual(listedOrgs, [ORG_A]);
    assert.equal(result.enqueued, 2);
    assert.deepEqual(
      recorded.map((row) => row.organizationId),
      [ORG_A, ORG_A],
    );
    assert.equal(
      recorded.some((row) => row.connectedAccountId === ACCOUNT_B1),
      false,
    );
  });

  it("does not enqueue a foreign-org account even if the lister returns one", async () => {
    const recorded: RecordedEnqueue[] = [];

    const result = await enqueueScheduledGmailSyncForConnectedAccounts(
      { actorUserId: "cron_actor", organizationId: ORG_A },
      {
        listConnectedAccounts: async () => connectedAccounts(),
        enqueueSyncJob: async (args) => {
          recorded.push(args);
          return {
            jobId: `job_${args.connectedAccountId}`,
            created: true,
            alreadyQueued: false,
          };
        },
      },
    );

    assert.equal(result.enqueued, 2);
    assert.equal(result.skipped, 1);
    assert.equal(result.results.find((row) => row.connectedAccountId === ACCOUNT_B1)?.reason, "organization_mismatch");
    assert.equal(
      recorded.some((row) => row.organizationId === ORG_B),
      false,
    );
  });

  it("preserves existing already-queued dedup and does not fan out extra jobs", async () => {
    let enqueueCalls = 0;

    const result = await enqueueScheduledGmailSyncForConnectedAccounts(
      { actorUserId: "cron_actor", organizationId: ORG_A },
      {
        listConnectedAccounts: async () => [{ id: ACCOUNT_A1, organizationId: ORG_A }],
        enqueueSyncJob: async () => {
          enqueueCalls += 1;
          return { jobId: "existing_job", created: false, alreadyQueued: true };
        },
      },
    );

    assert.equal(enqueueCalls, 1);
    assert.equal(result.enqueued, 0);
    assert.equal(result.alreadyQueued, 1);
    assert.deepEqual(result.jobIds, ["existing_job"]);
  });

  it("dry-run does not enqueue gmail.sync or any briefing job", async () => {
    const recorded: RecordedEnqueue[] = [];

    const result = await enqueueScheduledGmailSyncForConnectedAccounts(
      { actorUserId: "cron_actor", dryRun: true },
      {
        listConnectedAccounts: async () => connectedAccounts(),
        enqueueSyncJob: async (args) => {
          recorded.push(args);
          return { jobId: "should_not_enqueue", created: true, alreadyQueued: false };
        },
      },
    );

    assert.equal(recorded.length, 0);
    assert.equal(result.enqueued, 0);
    assert.equal(result.skipped, 3);
    assert.equal(
      result.results.every((row) => row.reason === "dry_run"),
      true,
    );
  });
});

describe("scheduled Gmail sync independence", () => {
  it("does not import Daily Briefing modules or job types", () => {
    const source = readFileSync(new URL("./enqueue-scheduled-gmail-sync.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /from ["']@\/lib\/briefing\//);
    assert.doesNotMatch(source, /BRIEFING_AUTOMATION_ENABLED/);
    assert.doesNotMatch(source, /BriefingSettings/);
    assert.doesNotMatch(source, /autoBriefingEnabled/);
    assert.doesNotMatch(source, /briefing\.schedule/);
    assert.doesNotMatch(source, /briefing\.generate/);
    assert.doesNotMatch(source, /EmailThreadBriefingAttention/);
    assert.match(source, /enqueueGmailSyncJob/);
    assert.match(source, /status: "CONNECTED"/);

    const routeSource = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../app/api/internal/gmail/schedule/route.ts"),
      "utf8",
    );
    assert.doesNotMatch(routeSource, /from ["']@\/lib\/briefing\//);
    assert.doesNotMatch(routeSource, /BRIEFING_AUTOMATION_ENABLED/);
    assert.doesNotMatch(routeSource, /isBriefingAutomationEnabled/);
    assert.match(routeSource, /enqueueScheduledGmailSyncForConnectedAccounts/);
    assert.match(routeSource, /verifyJobProcessorRequest/);
  });

  it("enqueues only gmail.sync work — never briefing.schedule or briefing.generate", async () => {
    const jobTypes: string[] = [];

    await enqueueScheduledGmailSyncForConnectedAccounts(
      { actorUserId: "cron_actor" },
      {
        listConnectedAccounts: async () => [{ id: ACCOUNT_A1, organizationId: ORG_A }],
        enqueueSyncJob: async () => {
          jobTypes.push(JOB_TYPES.GMAIL_SYNC);
          return { jobId: "job_gmail_1", created: true, alreadyQueued: false };
        },
      },
    );

    assert.equal(jobTypes.includes(JOB_TYPES.BRIEFING_SCHEDULE), false);
    assert.equal(jobTypes.includes(JOB_TYPES.BRIEFING_GENERATE), false);
    assert.deepEqual(jobTypes, [JOB_TYPES.GMAIL_SYNC]);
  });
});

describe("enqueueScheduledGmailSyncForBriefing", () => {
  it("still fans out gmail.sync for the briefing org via the shared helper", async () => {
    const recorded: RecordedEnqueue[] = [];

    const result = await enqueueScheduledGmailSyncForBriefing(
      {
        organizationId: ORG_A,
        actorUserId: "briefing_actor",
      },
      {
        listConnectedAccounts: async (args) => {
          assert.equal(args?.organizationId, ORG_A);
          return [{ id: ACCOUNT_A1, organizationId: ORG_A }];
        },
        enqueueSyncJob: async (args) => {
          recorded.push(args);
          return { jobId: "job_briefing_sync", created: true, alreadyQueued: false };
        },
      },
    );

    assert.equal(result.enqueued, 1);
    assert.deepEqual(result.jobIds, ["job_briefing_sync"]);
    assert.deepEqual(recorded, [
      {
        organizationId: ORG_A,
        connectedAccountId: ACCOUNT_A1,
        triggeredByUserId: "briefing_actor",
        triggerSource: "CRON",
      },
    ]);
  });
});
