import type { AiKnowledgeSource } from "@prisma/client";
import type { IntegrationResult, RemoteEntityRef } from "@/lib/integrations/types";
import {
  partitionContextLinks,
  type EmailThreadContextLink,
} from "@/lib/ai/email-context-links";
import { loadPmContextSnippets, type PmContextSnippet } from "@/lib/ai/load-pm-context";
import { maintenanceClient } from "@/lib/integrations/maintenance/client";
import { rocketCoreClient } from "@/lib/integrations/rocket-core/client";
import { rocketInspectionsClient } from "@/lib/integrations/rocket-inspections/client";
import type {
  ApprovedDraftChunk,
  ResponderRuleChunk,
  StyleExampleChunk,
} from "@/lib/ai/load-retrieval";

export type ThreadMessageSnapshot = {
  id: string;
  fromAddr: string;
  sentAt: Date;
  bodyText: string | null;
  isOutbound: boolean;
};

export type ResponderThreadSnapshot = {
  organizationId: string;
  threadId: string;
  subject: string | null;
  messages: ThreadMessageSnapshot[];
  contextLinks: EmailThreadContextLink[] | null;
};

export type KnowledgeChunk = Pick<AiKnowledgeSource, "id" | "type" | "title" | "content">;

export type IntegrationSnippet =
  | { source: "rocket-core"; label: string; text: string }
  | { source: "rocket-inspections"; label: string; text: string }
  | { source: "maintenance"; label: string; text: string };

export type ResponderContext = {
  thread: ResponderThreadSnapshot;
  knowledge: KnowledgeChunk[];
  rules: ResponderRuleChunk[];
  styleExamples: StyleExampleChunk[];
  approvedDrafts: ApprovedDraftChunk[];
  integrationSnippets: IntegrationSnippet[];
  /** Linked Prisma PM records (explicit contextLinks only). */
  pmContextSnippets: PmContextSnippet[];
  promptVersion: string;
};

export type BuildResponderContextInput = {
  thread: ResponderThreadSnapshot;
  knowledge: KnowledgeChunk[];
  rules: ResponderRuleChunk[];
  styleExamples: StyleExampleChunk[];
  approvedDrafts: ApprovedDraftChunk[];
};

const PROMPT_VERSION = "responder-context-v2";

async function collectIntegrationSnippets(
  organizationId: string,
  links: RemoteEntityRef[] | null,
): Promise<IntegrationSnippet[]> {
  if (!links?.length) {
    return [];
  }

  const snippets: IntegrationSnippet[] = [];

  for (const link of links) {
    if (link.system === "rocket-core" && link.kind === "property") {
      const res: IntegrationResult<{ name: string }> = await rocketCoreClient.getPropertySummary(
        organizationId,
        link.id,
      );
      if (res.ok) {
        snippets.push({
          source: "rocket-core",
          label: `Property ${link.id}`,
          text: res.data.name,
        });
      }
    }
    if (link.system === "rocket-inspections" && link.kind === "inspection") {
      const res = await rocketInspectionsClient.getInspection(organizationId, link.id);
      if (res.ok) {
        snippets.push({
          source: "rocket-inspections",
          label: `Inspection ${link.id}`,
          text: `${res.data.status}${res.data.scheduledFor ? ` — ${res.data.scheduledFor}` : ""}`,
        });
      }
    }
    if (link.system === "maintenance" && link.kind === "work_order") {
      const res = await maintenanceClient.getWorkOrder(organizationId, link.id);
      if (res.ok) {
        snippets.push({
          source: "maintenance",
          label: `Work order ${link.id}`,
          text: `${res.data.title} — ${res.data.status}`,
        });
      }
    }
  }

  return snippets;
}

/**
 * Single entry point for assembling AI responder context (email + DB retrieval + integrations).
 */
export async function buildResponderContext(input: BuildResponderContextInput): Promise<ResponderContext> {
  const { pmLinks, remoteLinks } = partitionContextLinks(input.thread.contextLinks);
  const [integrationSnippets, pmContextSnippets] = await Promise.all([
    collectIntegrationSnippets(input.thread.organizationId, remoteLinks),
    loadPmContextSnippets(input.thread.organizationId, pmLinks),
  ]);

  return {
    thread: input.thread,
    knowledge: input.knowledge,
    rules: input.rules,
    styleExamples: input.styleExamples,
    approvedDrafts: input.approvedDrafts,
    integrationSnippets,
    pmContextSnippets,
    promptVersion: PROMPT_VERSION,
  };
}
