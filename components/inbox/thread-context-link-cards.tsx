import Link from "next/link";
import { removeThreadPmContextLinkAction } from "@/app/(dashboard)/inbox/[threadId]/actions";
import type { PmLinkDisplay } from "@/lib/inbox/pm-link-display";

function kindTitle(kind: PmLinkDisplay["kind"]) {
  if (kind === "property") return "Property";
  if (kind === "tenancy") return "Tenancy";
  if (kind === "maintenance_request") return "Maintenance";
  if (kind === "application") return "Application";
  if (kind === "tenancy_contact") return "Tenant contact";
  if (kind === "unit") return "Unit";
  if (kind === "notice") return "Notice";
  if (kind === "document") return "Document";
  return "Record";
}

function cardClassName(kind: PmLinkDisplay["kind"]) {
  if (kind === "property") return "border-violet-200 bg-violet-50/40";
  if (kind === "tenancy") return "border-emerald-200 bg-emerald-50/40";
  if (kind === "maintenance_request") return "border-orange-200 bg-orange-50/40";
  return "border-neutral-200 bg-neutral-50/40";
}

export function ThreadContextLinkCards(props: { threadId: string; links: PmLinkDisplay[] }) {
  if (props.links.length === 0) return null;

  return (
    <ul className="mt-3 space-y-2">
      {props.links.map((link) => {
        const body = (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              {kindTitle(link.kind)}
            </div>
            <div className="mt-1 text-sm font-medium text-neutral-900">{link.label}</div>
          </>
        );

        return (
          <li
            key={`${link.kind}-${link.id}`}
            className={`rounded-md border px-3 py-2.5 ${cardClassName(link.kind)}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {link.href ? (
                  <Link href={link.href} className="block transition-colors hover:text-neutral-700">
                    {body}
                    <span className="mt-2 inline-block text-xs font-medium text-neutral-700 underline">
                      Open record →
                    </span>
                  </Link>
                ) : (
                  body
                )}
              </div>
              <form action={removeThreadPmContextLinkAction}>
                <input type="hidden" name="threadId" value={props.threadId} />
                <input type="hidden" name="kind" value={link.kind} />
                <input type="hidden" name="entityId" value={link.id} />
                <button
                  type="submit"
                  className="text-xs text-neutral-600 underline hover:text-neutral-900"
                >
                  Remove
                </button>
              </form>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
