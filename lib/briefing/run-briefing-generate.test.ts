import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import { BriefingItemCategory, BriefingSlot, BriefingSourceType } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { BRIEFING_DATA_PROVENANCE } from "@/lib/briefing/briefing-sources";
import { runBriefingGenerate } from "@/lib/briefing/run-briefing-generate";
import { BRIEFING_SOURCE_MODULES } from "@/lib/briefing/sources/registry";
import type { BriefingSourceModule } from "@/lib/briefing/sources/types";

const ORG_ID = "org_briefing_test";
const RUN_ID = "run_test_1";

function baseSettings(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    morningEnabled: true,
    afternoonEnabled: true,
    activeSourceTypes: [BriefingSourceType.EMAIL],
    autoSyncBeforeBriefing: false,
    lookbackHours: 12,
    timezone: "America/Vancouver",
    morningLocalTime: "07:00",
    afternoonLocalTime: "14:00",
    emailRecipients: [],
    ...overrides,
  };
}

function basePolicy(overrides: Record<string, unknown> = {}) {
  return {
    autoBriefingEnabled: true,
    maxBriefingRunsPerDay: 2,
    maxBriefingGeminiCallsPerRun: 5,
    ...overrides,
  };
}

function withMockPrisma<T>(mocks: Record<string, unknown>, run: () => Promise<T>): Promise<T> {
  const original = { ...prisma };

  Object.assign(prisma, mocks);

  return run().finally(() => {
    Object.assign(prisma, original);
  });
}

describe("runBriefingGenerate", () => {
  const prevBriefingEnv = process.env.BRIEFING_AUTOMATION_ENABLED;
  const prevActor = process.env.JOB_PROCESSOR_ACTOR_USER_ID;

  afterEach(() => {
    if (prevBriefingEnv === undefined) delete process.env.BRIEFING_AUTOMATION_ENABLED;
    else process.env.BRIEFING_AUTOMATION_ENABLED = prevBriefingEnv;
    if (prevActor === undefined) delete process.env.JOB_PROCESSOR_ACTOR_USER_ID;
    else process.env.JOB_PROCESSOR_ACTOR_USER_ID = prevActor;
  });

  it("skips when env and org gates are disabled", async () => {
    process.env.BRIEFING_AUTOMATION_ENABLED = "false";

    const result = await withMockPrisma(
      {
        briefingSettings: { findUnique: async () => null },
        organizationAiPolicy: { findUnique: async () => null },
      },
      () =>
        runBriefingGenerate({
          organizationId: ORG_ID,
          slot: BriefingSlot.MORNING,
        }),
    );

    assert.equal(result.status, "skipped");
    if (result.status === "skipped") {
      assert.equal(result.reason, "briefing_automation_disabled");
    }
  });

  it("completes zero-item run without calling Gemini", async () => {
    process.env.BRIEFING_AUTOMATION_ENABLED = "true";
    process.env.JOB_PROCESSOR_ACTOR_USER_ID = "user_test";

    const auditCreates: unknown[] = [];
    const itemCreates: unknown[] = [];
    let runUpdateData: Record<string, unknown> | null = null;

    const result = await withMockPrisma(
      {
        briefingSettings: {
          findUnique: async () => baseSettings(),
        },
        organizationAiPolicy: {
          findUnique: async () => basePolicy(),
        },
        organization: {
          findUnique: async () => ({ id: ORG_ID, name: "Axford PM" }),
        },
        briefingRun: {
          findFirst: async () => null,
          findUnique: async () => null,
          create: async () => ({
            id: RUN_ID,
            status: "RUNNING",
            windowStart: new Date("2026-06-26T07:00:00.000Z"),
            windowEnd: new Date("2026-06-26T14:00:00.000Z"),
          }),
          update: async (args: { data: Record<string, unknown> }) => {
            runUpdateData = args.data;
            return { id: RUN_ID };
          },
        },
        emailThread: {
          findMany: async () => [],
        },
        briefingItem: {
          deleteMany: async () => ({ count: 0 }),
          createMany: async (args: { data: unknown[] }) => {
            itemCreates.push(...args.data);
            return { count: args.data.length };
          },
        },
        auditLog: {
          create: async (args: { data: unknown }) => {
            auditCreates.push(args.data);
            return {};
          },
        },
      },
      () =>
        runBriefingGenerate({
          organizationId: ORG_ID,
          slot: BriefingSlot.MORNING,
          windowStart: new Date("2026-06-26T07:00:00.000Z"),
          windowEnd: new Date("2026-06-26T14:00:00.000Z"),
        }),
    );

    assert.equal(result.status, "completed");
    if (result.status === "completed") {
      assert.equal(result.includedCount, 0);
      assert.equal(result.geminiCallCount, 0);
    }
    assert.equal(itemCreates.length, 0);
    assert.equal(runUpdateData?.status, "COMPLETED");
    assert.equal(runUpdateData?.geminiCallCount, 0);
    assert.ok(auditCreates.some((entry) => (entry as { action: string }).action === "briefing.completed"));
  });

  it("persists EMAIL / EMAIL_MENTION items from mocked Gemini output", async () => {
    process.env.BRIEFING_AUTOMATION_ENABLED = "true";
    process.env.JOB_PROCESSOR_ACTOR_USER_ID = "user_test";

    const itemCreates: unknown[] = [];

    const result = await withMockPrisma(
      {
        briefingSettings: {
          findUnique: async () => baseSettings(),
        },
        organizationAiPolicy: {
          findUnique: async () => basePolicy(),
        },
        organization: {
          findUnique: async () => ({ id: ORG_ID, name: "Axford PM" }),
        },
        briefingRun: {
          findFirst: async () => null,
          findUnique: async () => null,
          create: async () => ({
            id: RUN_ID,
            status: "RUNNING",
            windowStart: new Date("2026-06-26T07:00:00.000Z"),
            windowEnd: new Date("2026-06-26T14:00:00.000Z"),
          }),
          update: async () => ({ id: RUN_ID }),
        },
        emailThread: {
          findMany: async () => [
            {
              id: "thread_1",
              organizationId: ORG_ID,
              providerThreadId: "gmail_thread_1",
              subject: "Leaking sink",
              snippet: "Water under the kitchen sink.",
              category: "TENANT_COMMUNICATION",
              categoryConfidence: 0.95,
              participantEmails: ["tenant@example.com"],
              lastMessageAt: new Date("2026-06-26T12:00:00.000Z"),
              isUnread: true,
              messages: [
                {
                  id: "msg_1",
                  providerMessageId: "gmail_msg_1",
                  fromAddr: "tenant@example.com",
                  isOutbound: false,
                  sentAt: new Date("2026-06-26T12:00:00.000Z"),
                },
              ],
            },
          ],
        },
        property: {
          findFirst: async () => null,
        },
        tenancyContact: {
          findFirst: async () => ({
            id: "contact_1",
            firstName: "Alex",
            lastName: "Tenant",
            tenancy: {
              id: "ten_1",
              unit: {
                unitNumber: "204",
                property: { id: "prop_1", name: "Oak Street" },
              },
            },
          }),
        },
        prospect: { findFirst: async () => null },
        application: { findFirst: async () => null },
        briefingItem: {
          deleteMany: async () => ({ count: 0 }),
          createMany: async (args: { data: unknown[] }) => {
            itemCreates.push(...args.data);
            return { count: args.data.length };
          },
        },
        auditLog: {
          create: async () => ({}),
        },
      },
      () =>
        runBriefingGenerate({
          organizationId: ORG_ID,
          slot: BriefingSlot.MORNING,
          windowStart: new Date("2026-06-26T07:00:00.000Z"),
          windowEnd: new Date("2026-06-26T14:00:00.000Z"),
          generateBriefing: async () => ({
            geminiCallCount: 1,
            output: {
              summaryTitle: "Morning briefing",
              executiveSummary: "One tenant maintenance item.",
              estimatedReadingMinutes: 2,
              scannedCount: 1,
              includedCount: 1,
              skippedCount: 0,
              sections: [
                {
                  category: BriefingItemCategory.TENANT,
                  items: [
                    {
                      sourceType: BriefingSourceType.EMAIL,
                      sourceThreadId: "thread_1",
                      summaryTitle: "Leaking sink",
                      category: BriefingItemCategory.TENANT,
                      urgency: "HIGH",
                      keyFacts: ["Email mention: active leak reported"],
                      isPropertyManagementRelated: true,
                      dataProvenance: BRIEFING_DATA_PROVENANCE.EMAIL_MENTION,
                    },
                  ],
                },
              ],
              suggestedFollowUpActions: [],
              warnings: [],
            },
          }),
        }),
    );

    assert.equal(result.status, "completed");
    assert.equal(itemCreates.length, 1);

    const item = itemCreates[0] as {
      sourceType: string;
      emailThreadId: string;
      summaryJson: { dataProvenance: string };
      subject: string;
    };

    assert.equal(item.sourceType, BriefingSourceType.EMAIL);
    assert.equal(item.emailThreadId, "thread_1");
    assert.equal(item.summaryJson.dataProvenance, BRIEFING_DATA_PROVENANCE.EMAIL_MENTION);
    assert.equal(item.subject, "Leaking sink");
    assert.ok(!JSON.stringify(item).includes("bodyText"));
  });

  it("calls briefing email delivery after a successful non-zero run", async () => {
    process.env.BRIEFING_AUTOMATION_ENABLED = "true";
    process.env.JOB_PROCESSOR_ACTOR_USER_ID = "user_test";

    let deliveryCalled = false;

    await withMockPrisma(
      {
        briefingSettings: {
          findUnique: async () => baseSettings(),
        },
        organizationAiPolicy: {
          findUnique: async () => basePolicy(),
        },
        organization: {
          findUnique: async () => ({ id: ORG_ID, name: "Axford PM" }),
        },
        briefingRun: {
          findFirst: async () => null,
          findUnique: async () => null,
          create: async () => ({
            id: RUN_ID,
            status: "RUNNING",
            windowStart: new Date("2026-06-26T07:00:00.000Z"),
            windowEnd: new Date("2026-06-26T14:00:00.000Z"),
          }),
          update: async () => ({ id: RUN_ID }),
        },
        emailThread: {
          findMany: async () => [
            {
              id: "thread_1",
              organizationId: ORG_ID,
              providerThreadId: "gmail_thread_1",
              subject: "Leaking sink",
              snippet: "Water under the kitchen sink.",
              category: "TENANT_COMMUNICATION",
              categoryConfidence: 0.95,
              participantEmails: ["tenant@example.com"],
              lastMessageAt: new Date("2026-06-26T12:00:00.000Z"),
              isUnread: true,
              messages: [
                {
                  id: "msg_1",
                  providerMessageId: "gmail_msg_1",
                  fromAddr: "tenant@example.com",
                  isOutbound: false,
                  sentAt: new Date("2026-06-26T12:00:00.000Z"),
                },
              ],
            },
          ],
        },
        property: { findFirst: async () => null },
        tenancyContact: { findFirst: async () => null },
        prospect: { findFirst: async () => null },
        application: { findFirst: async () => null },
        briefingItem: {
          deleteMany: async () => ({ count: 0 }),
          createMany: async () => ({ count: 1 }),
        },
        auditLog: {
          create: async () => ({}),
        },
      },
      () =>
        runBriefingGenerate({
          organizationId: ORG_ID,
          slot: BriefingSlot.MORNING,
          windowStart: new Date("2026-06-26T07:00:00.000Z"),
          windowEnd: new Date("2026-06-26T14:00:00.000Z"),
          deliverBriefingEmail: async (args) => {
            deliveryCalled = true;
            assert.equal(args.briefingRunId, RUN_ID);
            assert.equal(args.organizationId, ORG_ID);
          },
          generateBriefing: async () => ({
            geminiCallCount: 1,
            output: {
              summaryTitle: "Morning briefing",
              executiveSummary: "One tenant maintenance item.",
              estimatedReadingMinutes: 2,
              scannedCount: 1,
              includedCount: 1,
              skippedCount: 0,
              sections: [
                {
                  category: BriefingItemCategory.TENANT,
                  items: [
                    {
                      sourceType: BriefingSourceType.EMAIL,
                      sourceThreadId: "thread_1",
                      summaryTitle: "Leaking sink",
                      category: BriefingItemCategory.TENANT,
                      urgency: "HIGH",
                      keyFacts: ["Email mention: active leak reported"],
                      isPropertyManagementRelated: true,
                      dataProvenance: BRIEFING_DATA_PROVENANCE.EMAIL_MENTION,
                    },
                  ],
                },
              ],
              suggestedFollowUpActions: [],
              warnings: [],
            },
          }),
        }),
    );

    assert.equal(deliveryCalled, true);
  });

  it("uses modular orchestrator with EMAIL-only enabled modules", async () => {
    process.env.BRIEFING_AUTOMATION_ENABLED = "true";

    const result = await withMockPrisma(
      {
        briefingSettings: {
          findUnique: async () => baseSettings(),
        },
        organizationAiPolicy: {
          findUnique: async () => basePolicy(),
        },
        organization: {
          findUnique: async () => ({ id: ORG_ID, name: "Axford PM" }),
        },
        briefingRun: {
          findFirst: async () => null,
          findUnique: async () => null,
        },
        emailThread: {
          findMany: async () => [],
        },
      },
      () =>
        runBriefingGenerate({
          organizationId: ORG_ID,
          slot: BriefingSlot.MORNING,
          windowStart: new Date("2026-06-26T07:00:00.000Z"),
          windowEnd: new Date("2026-06-26T14:00:00.000Z"),
          dryRun: true,
          sourceModules: BRIEFING_SOURCE_MODULES,
        }),
    );

    assert.equal(result.status, "dry_run");
    if (result.status === "dry_run") {
      assert.equal(result.scannedCount, 0);
      assert.equal(result.includedCount, 0);
      assert.equal(result.skippedCount, 0);
    }
  });

  it("does not send email for zero-item modular runs", async () => {
    process.env.BRIEFING_AUTOMATION_ENABLED = "true";
    process.env.JOB_PROCESSOR_ACTOR_USER_ID = "user_test";

    let deliveryCalled = false;

    const result = await withMockPrisma(
      {
        briefingSettings: {
          findUnique: async () => baseSettings(),
        },
        organizationAiPolicy: {
          findUnique: async () => basePolicy(),
        },
        organization: {
          findUnique: async () => ({ id: ORG_ID, name: "Axford PM" }),
        },
        briefingRun: {
          findFirst: async () => null,
          findUnique: async () => null,
          create: async () => ({
            id: RUN_ID,
            status: "RUNNING",
            windowStart: new Date("2026-06-26T07:00:00.000Z"),
            windowEnd: new Date("2026-06-26T14:00:00.000Z"),
          }),
          update: async () => ({ id: RUN_ID }),
        },
        emailThread: {
          findMany: async () => [],
        },
        briefingItem: {
          deleteMany: async () => ({ count: 0 }),
          createMany: async () => ({ count: 0 }),
        },
        auditLog: {
          create: async () => ({}),
        },
      },
      () =>
        runBriefingGenerate({
          organizationId: ORG_ID,
          slot: BriefingSlot.MORNING,
          windowStart: new Date("2026-06-26T07:00:00.000Z"),
          windowEnd: new Date("2026-06-26T14:00:00.000Z"),
          sourceModules: BRIEFING_SOURCE_MODULES,
          deliverBriefingEmail: async () => {
            deliveryCalled = true;
          },
        }),
    );

    assert.equal(result.status, "completed");
    if (result.status === "completed") {
      assert.equal(result.includedCount, 0);
    }
    assert.equal(deliveryCalled, false);
  });

  it("ignores enabled stub modules that are not in activeSourceTypes", async () => {
    process.env.BRIEFING_AUTOMATION_ENABLED = "true";

    let stubCollectCalls = 0;
    const rogueStub: BriefingSourceModule = {
      sourceType: BriefingSourceType.MAINTENANCE,
      moduleId: "rogue-maintenance",
      async isAvailable() {
        return true;
      },
      async collect() {
        stubCollectCalls += 1;
        return {
          sourceType: BriefingSourceType.MAINTENANCE,
          scannedCount: 50,
          skippedCount: 0,
          includedCount: 50,
          geminiCallCount: 0,
          warnings: [],
          moduleExecutiveLine: null,
          output: null,
          context: null,
        };
      },
    };

    const result = await withMockPrisma(
      {
        briefingSettings: {
          findUnique: async () => baseSettings(),
        },
        organizationAiPolicy: {
          findUnique: async () => basePolicy(),
        },
        organization: {
          findUnique: async () => ({ id: ORG_ID, name: "Axford PM" }),
        },
        briefingRun: {
          findFirst: async () => null,
          findUnique: async () => null,
        },
        emailThread: {
          findMany: async () => [],
        },
      },
      () =>
        runBriefingGenerate({
          organizationId: ORG_ID,
          slot: BriefingSlot.MORNING,
          windowStart: new Date("2026-06-26T07:00:00.000Z"),
          windowEnd: new Date("2026-06-26T14:00:00.000Z"),
          dryRun: true,
          sourceModules: [BRIEFING_SOURCE_MODULES[0]!, rogueStub],
        }),
    );

    assert.equal(stubCollectCalls, 0);
    assert.equal(result.status, "dry_run");
    if (result.status === "dry_run") {
      assert.equal(result.scannedCount, 0);
      assert.equal(result.includedCount, 0);
    }
  });
});
