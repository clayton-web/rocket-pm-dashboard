"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { RocketWordmark } from "@/components/brand/rocket-wordmark";
import { navigationItems, type NavItem } from "@/config/navigation";
import { stripBasePath } from "@/lib/app-path";
import { resolveActiveNavHref } from "@/lib/navigation/dashboard-nav";
import { canSeeNavItem, type EffectivePermissions } from "@/lib/permissions/nav";

const SECTION_ORDER: Array<NavItem["section"]> = ["command", "operations", "growth", "system"];

function sectionLabel(section: NavItem["section"]) {
  switch (section) {
    case "command":
      return "Command";
    case "operations":
      return "Operations";
    case "growth":
      return "Growth";
    case "system":
      return "System";
    default:
      return "Navigation";
  }
}

const NAV_LINK_BASE =
  "relative block rounded-md py-2 pl-3 pr-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/**
 * Selected state is carried by three signals, never colour alone: the Rocket-red leading
 * indicator, a heavier weight, and `aria-current="page"` in the markup. Hover stays one step
 * lighter than selected so the two remain distinguishable.
 */
export function navLinkClasses(active: boolean): string {
  return active
    ? `${NAV_LINK_BASE} bg-selected font-semibold text-selected-foreground`
    : `${NAV_LINK_BASE} font-medium text-foreground-muted hover:bg-surface-muted hover:text-foreground`;
}

export function DashboardSidebar({ permissions }: { permissions: EffectivePermissions }) {
  const pathname = stripBasePath(usePathname() ?? "/");
  const items = navigationItems.filter((item) => item.enabled && canSeeNavItem(item, permissions));

  return <DashboardSidebarView items={items} pathname={pathname} />;
}

export function DashboardSidebarView({
  items,
  pathname,
}: {
  items: NavItem[];
  pathname: string;
}) {
  const activeHref = resolveActiveNavHref(
    pathname,
    items.map((item) => item.href),
  );

  const grouped = new Map<string, NavItem[]>();
  for (const item of items) {
    const list = grouped.get(item.section) ?? [];
    list.push(item);
    grouped.set(item.section, list);
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-surface">
      <div className="border-b border-border px-4 py-4">
        <RocketWordmark />
      </div>
      <nav aria-label="Primary" className="flex-1 space-y-6 overflow-y-auto px-2 py-4 text-sm">
        {SECTION_ORDER.map((section) => {
          const group = grouped.get(section);
          if (!group?.length) return null;
          return (
            <div key={section}>
              <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">
                {sectionLabel(section)}
              </div>
              <ul className="space-y-1">
                {group.map((item) => {
                  const active = item.href === activeHref;
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        prefetch={false}
                        aria-current={active ? "page" : undefined}
                        className={navLinkClasses(active)}
                      >
                        {active ? (
                          <span
                            aria-hidden="true"
                            className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-brand"
                          />
                        ) : null}
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
