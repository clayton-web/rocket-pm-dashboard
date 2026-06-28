import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  BriefingItemCategory,
  BriefingItemUrgency,
  BriefingRunStatus,
  BriefingSlot,
  BriefingSourceType,
} from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { sendBriefingEmail } from "@/lib/briefing/send-briefing-email";
import { BRIEFING_DATA_PROVENANCE } from "@/lib/briefing/briefing-sources";
import type { SendEmailResult } from "@/lib/email/email.types";

const ORG_ID = "org_briefing_email";
const RUN_ID = "run_email_1";

function withMockPrisma<T>(mocks: Record<string, unknown>, run: () => Promise<T>): Promise<T> {
  const original = { ...prisma };
  Object.assign(prisma, mocks);
  return run().finally(() => {
    Object.assign(prisma, original);
  });
}

function baseRun() {
  return {
    id: RUN_ID,
    slot: BriefingSlot.MORNING,
    status: BriefingRunStatus.COMPLETED,
    windowStart: new Date("2026-06-26T07:00:00.000Z"),
    windowEnd: new Date("2026-06-26T14:00:00.000Z"),
    threadsScanned: 3,
    itemsIncluded: 1,
    itemsSkipped: 2,
    executiveSummary: "One tenant maintenance item.",
    estimatedReadingMinutes: 2,
    errorMessage: null,
    reviewedAt: null,
    createdAt: new Date("2026-06-26T14:05:00.000Z"),
    items: [
      {
        id: "item_1",
        summaryTitle: "Leaking sink",
        category: BriefingItemCategory.TENANT,
        urgency: BriefingItemUrgency.HIGH,
        sourceType: BriefingSourceType.EMAIL,
        subject: "Leaking sink",
        emailThreadId: "thread_1",
        dueDate: null,
        sortOrder: 0,
        attentionSection: "NEW_IN_WINDOW",
        summaryJson: {
          keyFacts: ["Active leak reported"],
          dataProvenance: BRIEFING_DATA_PROVENANCE.EMAIL_MENTION,
          waitingOn: "PROPERTY_MANAGER",
          nextAction: "REPLY",
          firstSurfacedAt: "2026-06-26T12:00:00.000Z",
          ageLabel: "Today",
        },
      },
    ],
  };
}

describe("sendBriefingEmail", () => {
  const prevEmailEnabled = process.env.EMAIL_ENABLED;
  const prevAppUrl = process.env.APP_PUBLIC_URL;

  afterEach(() => {
    if (prevEmailEnabled === undefined) delete process.env.EMAIL_ENABLED;
    else process.env.EMAIL_ENABLED = prevEmailEnabled;
    if (prevAppUrl === undefined) delete process.env.APP_PUBLIC_URL;
    else process.env.APP_PUBLIC_URL = prevAppUrl;
  });

  it("skips when EMAIL_ENABLED is false", async () => {
    process.env.EMAIL_ENABLED = "false";

    const result = await sendBriefingEmail({
      briefingRunId: RUN_ID,
      organizationId: ORG_ID,
    });

    assert.deepEqual(result, { status: "skipped", reason: "email_disabled" });
  });

  it("skips when no recipients are configured", async () => {
    process.env.EMAIL_ENABLED = "true";
    process.env.APP_PUBLIC_URL = "https://app.example.com";
    process.env.JOB_PROCESSOR_ACTOR_USER_ID = "user_system";

    const result = await withMockPrisma(
      {
        briefingRun: {
          findFirst: async (args: { where: { id: string; organizationId: string } }) => {
            if (args.where.id === RUN_ID && args.where.organizationId === ORG_ID) {
              return baseRun();
            }
            return null;
          },
        },
        briefingSettings: {
          findUnique: async () => ({
            enabled: true,
            emailRecipients: [],
          }),
        },
        organization: {
          findUnique: async () => ({ name: "Axford PM" }),
        },
      },
      () =>
        sendBriefingEmail({
          briefingRunId: RUN_ID,
          organizationId: ORG_ID,
          actorUserId: "user_1",
        }),
    );

    assert.deepEqual(result, { status: "skipped", reason: "no_recipients" });
  });

  it("sends when recipients exist and sets emailSentAt", async () => {
    process.env.EMAIL_ENABLED = "true";
    process.env.APP_PUBLIC_URL = "https://app.example.com";

    const sentTo: string[] = [];
    let emailSentAt: Date | null = null;
    const auditCreates: Array<{ action: string }> = [];

    const result = await withMockPrisma(
      {
        briefingRun: {
          findFirst: async (args: { where: { id: string; organizationId: string }; select?: { emailSentAt?: true } }) => {
            if (args.select?.emailSentAt) {
              return { emailSentAt };
            }
            if (args.where.id === RUN_ID && args.where.organizationId === ORG_ID) {
              return baseRun();
            }
            return null;
          },
          updateMany: async (args: { data: { emailSentAt: Date } }) => {
            emailSentAt = args.data.emailSentAt;
            return { count: 1 };
          },
        },
        briefingSettings: {
          findUnique: async () => ({
            enabled: true,
            emailRecipients: ["ops@example.com"],
          }),
        },
        organization: {
          findUnique: async () => ({ name: "Axford PM" }),
        },
        auditLog: {
          create: async (args: { data: { action: string } }) => {
            auditCreates.push(args.data);
            return {};
          },
        },
      },
      () =>
        sendBriefingEmail({
          briefingRunId: RUN_ID,
          organizationId: ORG_ID,
          actorUserId: "user_1",
          sendEmailFn: async (input) => {
            sentTo.push(input.to);
            assert.match(input.subject, /Morning Daily Briefing — Axford PM/);
            assert.ok(!input.text.includes("bodyText"));
            return { provider: "console" } satisfies SendEmailResult;
          },
        }),
    );

    assert.deepEqual(result, { status: "sent", recipientCount: 1 });
    assert.deepEqual(sentTo, ["ops@example.com"]);
    assert.ok(emailSentAt instanceof Date);
    assert.ok(auditCreates.some((entry) => entry.action === "briefing.email.sent"));
  });

  it("skips zero-item runs", async () => {
    process.env.EMAIL_ENABLED = "true";
    process.env.APP_PUBLIC_URL = "https://app.example.com";

    const zeroItemRun = {
      ...baseRun(),
      itemsIncluded: 0,
      items: [],
    };

    const result = await withMockPrisma(
      {
        briefingRun: {
          findFirst: async () => zeroItemRun,
        },
        briefingSettings: {
          findUnique: async () => ({
            enabled: true,
            emailRecipients: ["ops@example.com"],
          }),
        },
        organization: {
          findUnique: async () => ({ name: "Axford PM" }),
        },
      },
      () =>
        sendBriefingEmail({
          briefingRunId: RUN_ID,
          organizationId: ORG_ID,
          actorUserId: "user_1",
        }),
    );

    assert.deepEqual(result, { status: "skipped", reason: "zero_items" });
  });
});
