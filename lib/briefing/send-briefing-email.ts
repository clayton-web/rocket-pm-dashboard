import prisma from "@/lib/db/prisma";
import { buildAppPublicUrl } from "@/lib/email/app-public-url";
import { isEmailEnabled, sendEmail } from "@/lib/email/email.service";
import { buildDailyBriefingEmail } from "@/lib/email/templates/daily-briefing-email";
import { EmailSendError } from "@/lib/email/email.types";
import {
  auditBriefingEmailFailed,
  auditBriefingEmailSent,
} from "@/lib/briefing/briefing-audit";
import { getBriefingRunDetail } from "@/lib/briefing/briefing-queries";
import { getJobProcessorActorUserId } from "@/lib/jobs/policy";

export type SendBriefingEmailResult =
  | { status: "sent"; recipientCount: number }
  | { status: "skipped"; reason: string }
  | { status: "failed"; errorMessage: string };

export type SendBriefingEmailArgs = {
  briefingRunId: string;
  organizationId: string;
  actorUserId?: string | null;
  sendEmailFn?: typeof sendEmail;
};

function normalizeRecipients(recipients: string[]): string[] {
  return [...new Set(recipients.map((entry) => entry.trim()).filter(Boolean))];
}

export async function sendBriefingEmail(
  args: SendBriefingEmailArgs,
): Promise<SendBriefingEmailResult> {
  const send = args.sendEmailFn ?? sendEmail;

  if (!isEmailEnabled()) {
    return { status: "skipped", reason: "email_disabled" };
  }

  const actorUserId = getJobProcessorActorUserId(args.actorUserId);

  const [run, settings, organization] = await Promise.all([
    getBriefingRunDetail({
      organizationId: args.organizationId,
      runId: args.briefingRunId,
    }),
    prisma.briefingSettings.findUnique({
      where: { organizationId: args.organizationId },
    }),
    prisma.organization.findUnique({
      where: { id: args.organizationId },
      select: { name: true },
    }),
  ]);

  if (!run) {
    return { status: "skipped", reason: "run_not_found" };
  }

  if (run.status !== "COMPLETED" && run.status !== "PARTIAL") {
    return { status: "skipped", reason: "run_not_deliverable" };
  }

  if (!settings?.enabled) {
    return { status: "skipped", reason: "briefing_settings_disabled" };
  }

  const recipients = normalizeRecipients(settings.emailRecipients);
  if (recipients.length === 0) {
    return { status: "skipped", reason: "no_recipients" };
  }

  if (run.itemsIncluded === 0) {
    return { status: "skipped", reason: "zero_items" };
  }

  const existing = await prisma.briefingRun.findFirst({
    where: { id: args.briefingRunId, organizationId: args.organizationId },
    select: { emailSentAt: true },
  });

  if (existing?.emailSentAt) {
    return { status: "skipped", reason: "already_sent" };
  }

  const runUrl = buildAppPublicUrl(`/briefing/${run.id}`);
  const content = buildDailyBriefingEmail({
    orgName: organization?.name ?? "Organization",
    slot: run.slot,
    windowStart: run.windowStart,
    windowEnd: run.windowEnd,
    executiveSummary: run.executiveSummary,
    runId: run.id,
    runUrl,
    inboxThreadUrl: (threadId) => buildAppPublicUrl(`/inbox/${threadId}`),
    items: run.items,
  });

  try {
    for (const recipient of recipients) {
      const result = await send({
        to: recipient,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });

      if (result === null) {
        return { status: "skipped", reason: "email_disabled" };
      }
    }

    await prisma.briefingRun.updateMany({
      where: {
        id: args.briefingRunId,
        organizationId: args.organizationId,
        emailSentAt: null,
      },
      data: { emailSentAt: new Date() },
    });

    await auditBriefingEmailSent({
      organizationId: args.organizationId,
      actorUserId,
      briefingRunId: args.briefingRunId,
      recipientCount: recipients.length,
    });

    return { status: "sent", recipientCount: recipients.length };
  } catch (error) {
    const message =
      error instanceof EmailSendError
        ? error.message
        : error instanceof Error
          ? error.message
          : "briefing_email_failed";

    await auditBriefingEmailFailed({
      organizationId: args.organizationId,
      actorUserId,
      briefingRunId: args.briefingRunId,
      errorMessage: message,
    });

    console.error("[sendBriefingEmail] delivery failed", {
      briefingRunId: args.briefingRunId,
      organizationId: args.organizationId,
      error: message.slice(0, 240),
    });

    return { status: "failed", errorMessage: message.slice(0, 500) };
  }
}

export async function deliverBriefingRunEmailSafely(args: SendBriefingEmailArgs): Promise<void> {
  try {
    await sendBriefingEmail(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : "briefing_email_failed";
    console.error("[deliverBriefingRunEmailSafely] unexpected error", {
      briefingRunId: args.briefingRunId,
      organizationId: args.organizationId,
      error: message.slice(0, 240),
    });
  }
}
