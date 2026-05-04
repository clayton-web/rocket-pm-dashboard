import prisma from "@/lib/db/prisma";

export type ResponderRuleChunk = {
  id: string;
  title: string;
  instruction: string;
};

export type StyleExampleChunk = {
  id: string;
  title: string | null;
  content: string;
};

export type ApprovedDraftChunk = {
  id: string;
  excerpt: string;
};

const KNOWLEDGE_LIMIT = 20;
const RULES_LIMIT = 50;
const STYLE_ORG_LIMIT = 5;
const STYLE_USER_LIMIT = 3;
const APPROVED_DRAFTS_LIMIT = 3;

export async function loadResponderRetrieval(args: {
  organizationId: string;
  userId: string;
}): Promise<{
  knowledge: Awaited<ReturnType<typeof prisma.aiKnowledgeSource.findMany>>;
  rules: Awaited<ReturnType<typeof prisma.aiResponderRule.findMany>>;
  styleExamplesOrg: Awaited<ReturnType<typeof prisma.aiStyleExample.findMany>>;
  styleExamplesUser: Awaited<ReturnType<typeof prisma.aiStyleExample.findMany>>;
  approvedDrafts: { id: string; draftText: string | null }[];
}> {
  const [knowledge, rules, styleExamplesOrg, styleExamplesUser, approvedDrafts] = await Promise.all([
    prisma.aiKnowledgeSource.findMany({
      where: { organizationId: args.organizationId },
      orderBy: { updatedAt: "desc" },
      take: KNOWLEDGE_LIMIT,
    }),
    prisma.aiResponderRule.findMany({
      where: { organizationId: args.organizationId, active: true },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: RULES_LIMIT,
    }),
    prisma.aiStyleExample.findMany({
      where: { organizationId: args.organizationId, userId: null },
      orderBy: { updatedAt: "desc" },
      take: STYLE_ORG_LIMIT,
    }),
    prisma.aiStyleExample.findMany({
      where: { organizationId: args.organizationId, userId: args.userId },
      orderBy: { updatedAt: "desc" },
      take: STYLE_USER_LIMIT,
    }),
    prisma.aiDraftResponse.findMany({
      where: {
        organizationId: args.organizationId,
        status: "APPROVED",
        draftText: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      take: APPROVED_DRAFTS_LIMIT,
      select: {
        id: true,
        draftText: true,
      },
    }),
  ]);

  return { knowledge, rules, styleExamplesOrg, styleExamplesUser, approvedDrafts };
}

export function toKnowledgeChunks(
  rows: Awaited<ReturnType<typeof prisma.aiKnowledgeSource.findMany>>,
) {
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    content: r.content,
  }));
}

export function toRuleChunks(
  rows: Awaited<ReturnType<typeof prisma.aiResponderRule.findMany>>,
): ResponderRuleChunk[] {
  return rows.map((r) => ({ id: r.id, title: r.title, instruction: r.instruction }));
}

export function toStyleChunks(
  orgRows: Awaited<ReturnType<typeof prisma.aiStyleExample.findMany>>,
  userRows: Awaited<ReturnType<typeof prisma.aiStyleExample.findMany>>,
): StyleExampleChunk[] {
  const merged = [...userRows, ...orgRows];
  const seen = new Set<string>();
  const out: StyleExampleChunk[] = [];
  for (const r of merged) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push({ id: r.id, title: r.title, content: r.content });
  }
  return out.slice(0, STYLE_ORG_LIMIT + STYLE_USER_LIMIT);
}

export function toApprovedDraftChunks(
  rows: { id: string; draftText: string | null }[],
): ApprovedDraftChunk[] {
  return rows
    .map((r) => ({
      id: r.id,
      excerpt: (r.draftText ?? "").replace(/\s+/g, " ").trim().slice(0, 800),
    }))
    .filter((r) => r.excerpt.length > 0);
}
