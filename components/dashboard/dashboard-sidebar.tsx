import Link from "next/link";
import { navigationItems } from "@/config/navigation";
import { canSeeNavItem, type EffectivePermissions } from "@/lib/permissions/nav";

function sectionLabel(section: (typeof navigationItems)[number]["section"]) {
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

export function DashboardSidebar({ permissions }: { permissions: EffectivePermissions }) {
  const items = navigationItems.filter((item) => item.enabled && canSeeNavItem(item, permissions));

  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    const list = grouped.get(item.section) ?? [];
    list.push(item);
    grouped.set(item.section, list);
  }

  const sectionOrder: Array<(typeof navigationItems)[number]["section"]> = [
    "command",
    "operations",
    "growth",
    "system",
  ];

  return (
    <aside className="flex h-full w-60 flex-col border-r border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-4 py-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Rocket PM</div>
        <div className="text-sm font-medium text-neutral-900">Dashboard</div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-2 py-4 text-sm">
        {sectionOrder.map((section) => {
          const group = grouped.get(section);
          if (!group?.length) return null;
          return (
            <div key={section}>
              <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                {sectionLabel(section)}
              </div>
              <ul className="space-y-1">
                {group.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      prefetch={false}
                      className="block rounded-md px-2 py-2 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
