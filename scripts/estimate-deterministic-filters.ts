#!/usr/bin/env npx tsx
import prisma from "@/lib/db/prisma";
import { evaluateDeterministicInboxFilters } from "@/lib/ai/inbox-classification/deterministic-filters";

function parseArgs(argv: string[]) {
  const organizationId = argv[2];
  const mailboxId = argv[3];

  if (!organizationId) {
    throw new Error("Usage: npx tsx scripts/estimate-deterministic-filters.ts <organizationId> [connectedAccountId]");
  }

  return { organizationId, mailboxId };
}

async function main() {
  const { organizationId, mailboxId } = parseArgs(process.argv);

  const threads = await prisma.emailThread.findMany({
    where: {
      organizationId,
      ...(mailboxId ? { connectedAccountId: mailboxId } : {}),
    },
    orderBy: { lastMessageAt: "desc" },
    take: 500,
    select: {
      id: true,
      subject: true,
      snippet: true,
      participantEmails: true,
      messages: {
        orderBy: { sentAt: "asc" },
        select: {
          fromAddr: true,
          isOutbound: true,
          sentAt: true,
          bodyText: true,
        },
      },
    },
  });

  const counts = {
    scanned: threads.length,
    landlord: 0,
    tenant: 0,
    strata: 0,
    multiLabel: 0,
    noMatch: 0,
  };

  for (const thread of threads) {
    const matches = await evaluateDeterministicInboxFilters({
      organizationId,
      subject: thread.subject,
      snippet: thread.snippet,
      participantEmails: thread.participantEmails,
      messages: thread.messages,
    });

    if (matches.length === 0) {
      counts.noMatch += 1;
      continue;
    }

    if (matches.length > 1) counts.multiLabel += 1;
    for (const match of matches) {
      if (match.category === "LANDLORD_COMMUNICATION") counts.landlord += 1;
      if (match.category === "TENANT_COMMUNICATION") counts.tenant += 1;
      if (match.category === "STRATA") counts.strata += 1;
    }
  }

  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
