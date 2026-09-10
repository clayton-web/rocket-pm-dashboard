import {
  addThreadPmContextLinkAction,
} from "@/app/(dashboard)/inbox/[threadId]/actions";
import { ThreadContextLinkCards } from "@/components/inbox/thread-context-link-cards";
import { ThreadContextWarning } from "@/components/inbox/thread-context-warning";
import { buttonClasses } from "@/components/portal/button";
import { formControlClasses } from "@/components/portal/form-control";
import { SURFACE_PANEL } from "@/components/portal/ui";
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
    <section className={`${SURFACE_PANEL} p-4`}>
      <h2 className="text-sm font-semibold text-foreground">PM context links</h2>
      <p className="mt-1 text-xs text-foreground-muted">
        Link this thread to property management records. Only linked data is included in AI drafts.
      </p>

      {pmLinks.length === 0 ? <ThreadContextWarning /> : null}

      <ThreadContextLinkCards threadId={props.threadId} links={props.linkedDisplays} />

      {optionGroups.map((group) =>
        group.items.length > 0 ? (
          <form key={group.kind} action={addThreadPmContextLinkAction} className="mt-4 space-y-1">
            <input type="hidden" name="threadId" value={props.threadId} />
            <input type="hidden" name="kind" value={group.kind} />
            <label htmlFor={`link-${group.kind}`} className="block text-xs font-medium text-foreground-muted">
              Link {group.label}
            </label>
            <div className="flex gap-2">
              <select
                id={`link-${group.kind}`}
                name="entityId"
                required
                className={formControlClasses({ size: "xs", className: "min-w-0 flex-1" })}
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
                className={buttonClasses({ size: "xs", className: "shrink-0" })}
              >
                Add
              </button>
            </div>
          </form>
        ) : null,
      )}

      <p className="mt-4 text-[11px] text-foreground-subtle">
        Examples: maintenance email → Maintenance request; tenant reply → Tenancy; owner notice →
        Property. See docs/email-thread-context-links.md.
      </p>
    </section>
  );
}
