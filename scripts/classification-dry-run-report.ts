#!/usr/bin/env npx tsx
import prisma from "@/lib/db/prisma";
import { evaluateDeterministicInboxFilters } from "@/lib/ai/inbox-classification/deterministic-filters";
import { getEffectiveCategories } from "@/lib/inbox/thread-category-assignments";
import { EMAIL_THREAD_CATEGORY_LABELS } from "@/lib/inbox/email-thread-category";

function parseArgs(argv: string[]) {
  const organizationId = argv[2];
  const mailboxId = argv[3];

  if (!organizationId) {
    throw new Error("Usage: npx tsx scripts/classification-dry-run-report.ts <organizationId> [connectedAccountId]");
  }

  return { organizationId, mailboxId };
}

function formatCategories(categories: string[]): string {
  if (categories.length === 0) return "UNCATEGORIZED";
  return categories.map((category) => EMAIL_THREAD_CATEGORY_LABELS[category as keyof typeof EMAIL_THREAD_CATEGORY_LABELS] ?? category).join(" + ");
}

async function main() {
  const { organizationId, mailboxId } = parseArgs(process.argv);

  const threads = await prisma.emailThread.findMany({
    where: {
      organizationId,
      ...(mailboxId ? { connectedAccountId: mailboxId } : {}),
      NOT: {
        categoryAssignments: {
          some: { source: "MANUAL" },
        },
      },
      categorySource: { not: "manual" },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 250,
    select: {
      id: true,
      subject: true,
      category: true,
      categorySource: true,
      categoryAssignments: {
        select: { category: true, source: true, reason: true, assignedAt: true },
      },
      messages: {
        orderBy: { sentAt: "asc" },
        select: {
          fromAddr: true,
          isOutbound: true,
          sentAt: true,
          bodyText: true,
        },
      },
      participantEmails: true,
      snippet: true,
    },
  });

  let aiFallbackCount = 0;
  let deterministicChangeCount = 0;

  console.log("threadId\tcurrent\tnew deterministic\tAI fallback?\trule reasons");
  for (const thread of threads) {
    const currentCategories = getEffectiveCategories(
      thread.categoryAssignments.map((assignment) => ({
        category: assignment.category,
        source: assignment.source,
        reason: assignment.reason,
        assignedAt: assignment.assignedAt,
      })),
      thread.category,
    );

    const matches = await evaluateDeterministicInboxFilters({
      organizationId,
      subject: thread.subject,
      snippet: thread.snippet,
      participantEmails: thread.participantEmails,
      messages: thread.messages,
    });

    const newCategories = matches.map((match) => match.category);
    const aiFallbackRequired = newCategories.length === 0;
    if (aiFallbackRequired) aiFallbackCount += 1;

    const currentKey = [...currentCategories].sort().join("|");
    const newKey = [...newCategories].sort().join("|");
    if (currentKey !== newKey) deterministicChangeCount += 1;

    console.log(
      [
        thread.id,
        formatCategories(currentCategories),
        formatCategories(newCategories),
        aiFallbackRequired ? "yes" : "no",
        matches.map((match) => match.reason).join(" | ") || "—",
      ].join("\t"),
    );
  }

  console.log("");
  console.log(`Threads scanned: ${threads.length}`);
  console.log(`Would change deterministic labels: ${deterministicChangeCount}`);
  console.log(`Would still require AI fallback: ${aiFallbackCount}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
