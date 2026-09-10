import { navigationItems } from "@/config/navigation";

/**
 * Route-aware titles and selected-navigation resolution for the staff shell.
 *
 * `config/navigation.ts` stays the source of truth: a new sidebar entry gets a header title for
 * free. Only routes with no sidebar entry of their own need an entry in the supplement below.
 */
const SUPPLEMENTARY_PAGE_TITLES: Record<string, string> = {
  "/briefing/settings": "Briefing settings",
  "/leasing/notices": "Notices",
  "/leasing/showings": "Showings",
};

const FALLBACK_PAGE_TITLE = "Rocket PM";

/**
 * Longest-prefix match: `/properties/health` beats `/properties`, and a detail route such as
 * `/inbox/thread_1` resolves to its parent section.
 */
function matchesRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The rendered nav href that the current route belongs to, or null when none does. */
export function resolveActiveNavHref(pathname: string, hrefs: readonly string[]): string | null {
  let match: string | null = null;
  for (const href of hrefs) {
    if (!matchesRoute(pathname, href)) continue;
    if (match === null || href.length > match.length) {
      match = href;
    }
  }
  return match;
}

/** Header title for a staff route. */
export function resolveDashboardPageTitle(pathname: string): string {
  const candidates: Array<{ href: string; title: string; enabled: boolean }> = [
    ...navigationItems.map((item) => ({ href: item.href, title: item.label, enabled: item.enabled })),
    ...Object.entries(SUPPLEMENTARY_PAGE_TITLES).map(([href, title]) => ({ href, title, enabled: true })),
  ];

  let best: { href: string; title: string; enabled: boolean } | null = null;
  for (const candidate of candidates) {
    if (!matchesRoute(pathname, candidate.href)) continue;
    if (best === null) {
      best = candidate;
      continue;
    }
    if (candidate.href.length > best.href.length) {
      best = candidate;
      continue;
    }
    // Two nav entries can share an href (one of them disabled). Prefer the one that ships.
    if (candidate.href.length === best.href.length && candidate.enabled && !best.enabled) {
      best = candidate;
    }
  }

  return best?.title ?? FALLBACK_PAGE_TITLE;
}
