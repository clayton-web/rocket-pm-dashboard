# EmailThread.contextLinks

`EmailThread.contextLinks` is optional JSON on each synced Gmail thread. It tells the AI responder which **Rocket PM records** (and legacy integration stubs) apply to this conversation.

Nothing is auto-linked from email addresses in PR 10 — staff must attach links explicitly (inbox panel or future automation).

## Shape

Each entry is one object in a JSON array. Two families are supported:

### 1. Prisma PM links (preferred)

```json
{
  "source": "pm",
  "kind": "property",
  "id": "<cuid>"
}
```

| `kind` | Use when |
|--------|----------|
| `property` | Owner/strata/building-level thread |
| `unit` | Unit-specific thread |
| `tenancy` | Active/former tenancy lifecycle |
| `tenancy_contact` | Named tenant/occupant |
| `maintenance_request` | Work order / repair thread |
| `application` | Rental application thread |
| `notice` | Served notice (summary only in AI context) |
| `document` | Linked document metadata only (no file body) |

Helpers: `lib/ai/email-context-links.ts` (`parseEmailThreadContextLinks`, `serializeEmailThreadContextLinks`).

### 2. Legacy integration refs (unchanged)

```json
{
  "system": "rocket-core",
  "kind": "property",
  "id": "external-id"
}
```

Loaded via stub clients in `lib/ai/context-builder.ts` when HTTP integrations are wired.

## Examples

**Maintenance email** — link the open request:

```json
[{ "source": "pm", "kind": "maintenance_request", "id": "<MaintenanceRequest.id>" }]
```

**Tenant reply** — link tenancy (and optionally contact):

```json
[
  { "source": "pm", "kind": "tenancy", "id": "<Tenancy.id>" },
  { "source": "pm", "kind": "tenancy_contact", "id": "<TenancyContact.id>" }
]
```

**Owner / building** — link property:

```json
[{ "source": "pm", "kind": "property", "id": "<Property.id>" }]
```

## AI responder flow

1. `assembleResponderContextForThread` parses `contextLinks`.
2. `buildResponderContext` loads:
   - Rules, knowledge, style, approved drafts (unchanged)
   - Integration snippets (remote refs)
   - **PM snippets** via `loadPmContextSnippets` (`lib/ai/load-pm-context.ts`)
3. `generate-responder-draft` adds a prompt section:

   `Internal property management context (linked records only)`

4. Citations include `kind: "pm_context"` for each snippet.

Prompt version: `responder-context-v2`.

## Safety rules

- Every Prisma load filters by the thread’s `organizationId`.
- Unlinked org data is never included.
- Summaries are truncated; full lease PDFs and application financials are not dumped.
- Linking `property` or `tenancy` may include up to **3 open** maintenance requests for that scope (status in `new` … `scheduled`).
- Documents: title/type only. Notices: short body excerpt.

## UI

Inbox thread sidebar: **PM context links** panel (`components/inbox/thread-context-links-panel.tsx`).

Server actions: `addThreadPmContextLinkAction`, `removeThreadPmContextLinkAction` in `app/(dashboard)/inbox/[threadId]/actions.ts`.

Picker options are org-scoped seed-friendly lists (properties, tenancies, maintenance, applications).

## Programmatic attach

```typescript
import prisma from "@/lib/db/prisma";
import {
  parseEmailThreadContextLinks,
  serializeEmailThreadContextLinks,
  PM_CONTEXT_SOURCE,
} from "@/lib/ai/email-context-links";

const existing = parseEmailThreadContextLinks(thread.contextLinks);
const next = [
  ...existing,
  { source: PM_CONTEXT_SOURCE, kind: "maintenance_request", id: requestId },
];
await prisma.emailThread.update({
  where: { id: threadId },
  data: { contextLinks: serializeEmailThreadContextLinks(next) },
});
```

Validate with `loadPmContextSnippets(organizationId, [link])` before saving.
