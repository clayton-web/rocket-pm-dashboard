"use client";

import { usePathname } from "next/navigation";
import { stripBasePath } from "@/lib/app-path";
import { resolveDashboardPageTitle } from "@/lib/navigation/dashboard-nav";

/**
 * Route-aware shell title. Rendered as plain text rather than a heading so it does not compete
 * with the page's own `h1`.
 */
export function DashboardHeaderTitle() {
  const pathname = stripBasePath(usePathname() ?? "/");

  return (
    <div className="text-sm font-semibold text-foreground">{resolveDashboardPageTitle(pathname)}</div>
  );
}
