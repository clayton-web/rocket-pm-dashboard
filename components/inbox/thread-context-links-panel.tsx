import {
  addThreadPmContextLinkAction,
} from "@/app/(dashboard)/inbox/[threadId]/actions";
import { ThreadContextLinkCards } from "@/components/inbox/thread-context-link-cards";
import { ThreadContextWarning } from "@/components/inbox/thread-context-warning";
import { isPmContextLink, parseEmailThreadContextLinks, type PmContextKind } from "@/lib/ai/email-context-links";
import type { ContextLinkOption } from "@/lib/ai/thread-context-link-options";
import type { PmLinkDisplay } from "@/lib/inbox/pm-link-display";

export function ThreadContextLinksPanel(props: {
  threadId: string;
  contextLinksJson: unknown;
  linkedDisplays: PmLinkDisplay[];
  options: {
    properties: ContextLinkOption[];
    tenancies: ContextLinkOption[];
    maintenanceRequests: ContextLinkOption[];
    applications: ContextLinkOption[];
  };
}) {
  const links = parseEmailThreadContextLinks(props.contextLinksJson);
  const pmLinks = links.filter(isPmContextLink);

  const optionGroups: { kind: PmContextKind; label: string; items: ContextLinkOption[] }[] = [
    { kind: "property", label: "Property", items: props.options.properties },
    { kind: "tenancy", label: "Tenancy", items: props.options.tenancies },
    { kind: "maintenance_request", label: "Maintenance", items: props.options.maintenanceRequests },
    { kind: "application", label: "Application", items: props.options.applications },
  ];

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">PM context links</h2>
      <p className="mt-1 text-xs text-neutral-600">
        Link this thread to property management records. Only linked data is included in AI drafts.
      </p>

      {pmLinks.length === 0 ? <ThreadContextWarning /> : null}

      <ThreadContextLinkCards threadId={props.threadId} links={props.linkedDisplays} />

      {optionGroups.map((group) =>
        group.items.length > 0 ? (
          <form key={group.kind} action={addThreadPmContextLinkAction} className="mt-4 space-y-1">
            <input type="hidden" name="threadId" value={props.threadId} />
            <input type="hidden" name="kind" value={group.kind} />
            <label className="block text-xs font-medium text-neutral-700">
              Link {group.label}
            </label>
            <div className="flex gap-2">
              <select
                name="entityId"
                required
                className="min-w-0 flex-1 rounded-md border border-neutral-200 px-2 py-1.5 text-xs"
                defaultValue=""
              >
                <option value="" disabled>
                  Select…
                </option>
                {group.items.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="shrink-0 rounded-md border border-neutral-300 px-2 py-1.5 text-xs font-medium hover:bg-neutral-50"
              >
                Add
              </button>
            </div>
          </form>
        ) : null,
      )}

      <p className="mt-4 text-[11px] text-neutral-500">
        Examples: maintenance email → Maintenance request; tenant reply → Tenancy; owner notice →
        Property. See docs/email-thread-context-links.md.
      </p>
    </section>
  );
}
