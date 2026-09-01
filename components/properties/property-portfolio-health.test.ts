import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";

/**
 * Source-scan coverage, which is this repository's established convention for presentation that
 * has no DOM test harness. Behaviour that can be asserted for real — ranking, filtering, search,
 * issue ordering, cell formatting — is tested against the pure modules in `lib/property`
 * instead; these checks exist to pin the *structure* the redesign introduced.
 */
function read(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), "utf8");
}

const container = () => read("./property-portfolio-health.tsx");
const row = () => read("./health/health-property-row.tsx");
const toolbar = () => read("./health/health-toolbar.tsx");
const strip = () => read("./health/health-summary-strip.tsx");
const status = () => read("./health/health-status.tsx");
const editActions = () => read("./health/health-edit-actions.tsx");

async function allSources(): Promise<string> {
  const parts = await Promise.all([
    container(),
    row(),
    toolbar(),
    strip(),
    status(),
    editActions(),
  ]);
  return parts.join("\n");
}

describe("Property Health triage list structure", () => {
  it("no longer renders the per-property card/bubble layout", async () => {
    const text = await allSources();
    assert.doesNotMatch(text, /<article/, "the per-property article card must be gone");
    assert.doesNotMatch(text, /SURFACE_CARD/, "rows must not be elevated marketing cards");
  });

  it("renders one list row per property under a shared column header", async () => {
    const text = await container();
    assert.match(text, /<HealthTableHeader \/>/);
    assert.match(text, /<ul aria-label="Properties by health priority">/);
    assert.match(text, /<HealthPropertyRow/);
  });

  it("drives the header and the rows from one grid template", async () => {
    const text = await row();
    // Two grid definitions would let a column exist in the header but not the rows.
    assert.equal(text.match(/const ROW_GRID =/g)?.length, 1);
    assert.match(text, /className=\{`\$\{ROW_GRID\}[^`]*`\}/);
    assert.match(text, /\$\{ROW_GRID\} hidden/);
  });

  it("carries every approved column", async () => {
    const text = await row();
    for (const column of ["Property", "Health", "Issues", "Units", "Owner", "Docs", "Updated"]) {
      assert.ok(text.includes(`<span>${column}</span>`), `missing ${column} column header`);
    }
    assert.match(text, /row\.propertyLabel/);
    assert.match(text, /row\.cityLine/);
    assert.match(text, /row\.attentionStatus/);
    assert.match(text, /formatPortfolioHealthOccupancy/);
    assert.match(text, /formatPortfolioHealthOwnerState/);
    assert.match(text, /formatPortfolioHealthDocumentsState/);
    assert.match(text, /formatPortfolioHealthUpdatedAt/);
  });

  it("shows a truncated issue set rather than issue prose in the collapsed row", async () => {
    const text = await row();
    assert.match(text, /<IssueChipList issueKeys=\{row\.missingItemKeys\} limit=\{2\} \/>/);
    // The remainder is a count, not more chips, so the row height stays predictable.
    assert.match(await status(), /\+\{overflow\}/);
  });

  it("keeps an exact date reachable behind the relative Updated column", async () => {
    assert.match(await row(), /title=\{cell\.description\}/);
    assert.match(await read("../../lib/property/portfolio-health-format.ts"), /Last updated \$\{exact\}/);
  });
});

describe("Property Health issue severity", () => {
  it("maps the three tiers to distinct shared tones", async () => {
    const text = await status();
    assert.match(text, /blocking: "danger"/);
    assert.match(text, /operational: "warning"/);
    assert.match(text, /optional: "neutral"/);
  });

  it("never conveys severity by colour alone", async () => {
    const text = await status();
    assert.match(text, /blocking: "Blocking issue"/);
    assert.match(text, /operational: "Operational issue"/);
    assert.match(text, /optional: "Optional issue"/);
    assert.match(text, /<span className="sr-only">\{TIER_SR_LABEL\[tier\]\}/);
  });

  it("takes issue wording from the existing label map", async () => {
    const text = await status();
    assert.match(text, /PORTFOLIO_HEALTH_MISSING_LABELS\[issueKey\]/);
    assert.match(text, /PORTFOLIO_HEALTH_ATTENTION_STATUS_LABELS\[status\]/);
  });

  it("orders chips through the shared severity ordering", async () => {
    assert.match(await status(), /orderPortfolioHealthIssueKeys\(issueKeys\)/);
  });

  it("builds on the shared status primitive instead of a local badge system", async () => {
    const text = await status();
    assert.match(text, /from "@\/components\/portal\/status-badge"/);
    assert.doesNotMatch(text, /bg-(emerald|amber|sky|red|neutral)-\d{2,3}/);
  });
});

describe("Property Health expansion", () => {
  it("expands from a disclosure control that reports its state", async () => {
    const text = await row();
    assert.match(text, /aria-expanded=\{expanded\}/);
    assert.match(text, /aria-controls=\{expanded \? panelId : undefined\}/);
    assert.match(text, /onClick=\{\(\) => onToggle\(row\.propertyId\)\}/);
  });

  it("shows the full issue set and unit detail once expanded", async () => {
    const text = await row();
    assert.match(text, /issueKeys=\{row\.visiblePropertyMissingItemKeys\}/);
    assert.match(text, /limit=\{Number\.POSITIVE_INFINITY\}/);
    assert.match(text, /row\.visibleUnitSlots\.map/);
    assert.match(text, /slot\.visibleTenantDataFlags/);
  });

  it("keeps the existing tenancy cleanup affordances", async () => {
    const text = await row();
    assert.match(text, /buildHealthEditTenancyHref\(slot\.tenancyId, viewState\)/);
    assert.match(text, /\/leasing\/tenancies\/\$\{slot\.tenancyId\}/);
    assert.match(text, /Open property/);
  });

  it("tracks expansion in local state keyed by property id", async () => {
    const text = await container();
    assert.match(text, /useState<ReadonlySet<string>>/);
    assert.match(text, /expanded=\{expandedIds\.has\(row\.propertyId\)\}/);
    // Rows removed by a filter simply stop rendering, so no pruning effect is needed.
    assert.doesNotMatch(text, /setExpandedIds\(new Set\(\)\)/);
  });
});

describe("Property Health toolbar and summary", () => {
  it("replaces the nine summary tiles with a compact strip", async () => {
    const text = await container();
    assert.doesNotMatch(text, /SummaryCard/);
    assert.doesNotMatch(text, /CleanupQueueSnapshot/);
    assert.match(text, /<HealthSummaryStrip/);
  });

  it("makes the status totals the status filter", async () => {
    const text = await strip();
    assert.match(text, /PORTFOLIO_HEALTH_STATUS_FILTERS\.map/);
    assert.match(text, /onStatusChange\(option\)/);
    assert.match(text, /aria-pressed=\{active\}/);
    // Each status option renders its own portfolio total, so the strip is the summary too.
    assert.match(text, /needs_attention: \(s\) => s\.needsAttention/);
    assert.match(text, /minor: \(s\) => s\.minor/);
    assert.match(text, /clear: \(s\) => s\.clear/);
    assert.match(text, /STATUS_COUNTS\[option\]\(summary\)/);
  });

  it("routes issue shortcuts through the existing cleanup filters", async () => {
    const text = await strip();
    assert.match(text, /buildPortfolioHealthFilterShortcuts\(summary\.issueSnapshot\)/);
    assert.match(text, /onToggleFilter\(shortcut\.filter\)/);
  });

  it("moves the eleven cleanup filters behind a disclosure", async () => {
    const text = await toolbar();
    assert.match(text, /aria-expanded=\{filtersOpen\}/);
    assert.match(text, /aria-controls=\{panelId\}/);
    assert.match(text, /PORTFOLIO_HEALTH_TENANT_CLEANUP_FILTERS/);
    assert.match(text, /PORTFOLIO_HEALTH_PROPERTY_CLEANUP_FILTERS/);
    // The underlying values and labels are unchanged.
    assert.match(text, /PORTFOLIO_HEALTH_CLEANUP_FILTER_LABELS\[filter\]/);
  });

  it("gives search an explicit accessible label and shows the result count", async () => {
    const text = await toolbar();
    assert.match(text, /<label htmlFor=\{searchId\} className="sr-only">/);
    assert.match(text, /type="search"/);
    assert.match(text, /Showing \{visibleCount\} of \{totalCount\}/);
  });

  it("offers only the three approved orders", async () => {
    const text = await toolbar();
    assert.match(text, /PORTFOLIO_HEALTH_SORTS\.map/);
    assert.match(text, /<label htmlFor=\{sortId\}/);
    assert.equal((await read("../../lib/property/portfolio-health-ranking.ts")).match(
      /PORTFOLIO_HEALTH_SORTS: PortfolioHealthSort\[\] = \["health", "address", "updated"\]/,
    )?.length, 1);
  });

  it("consumes the shared control primitives rather than a parallel system", async () => {
    const text = (await toolbar()) + (await strip());
    assert.match(text, /formControlClasses/);
    assert.match(text, /buttonClasses/);
    assert.match(text, /toggleTileClasses/);
  });
});

describe("Property Health responsive behaviour", () => {
  it("reflows the same rows instead of scrolling a desktop table sideways", async () => {
    const text = await row();
    assert.match(text, /xl:grid-cols-\[/);
    assert.doesNotMatch(text, /overflow-x-auto/);
  });

  it("defers the detail columns to the expanded panel on narrow viewports", async () => {
    const text = await row();
    assert.match(text, /const DETAIL_CELL = "hidden xl:block/);
    assert.match(text, /className="flex flex-wrap gap-x-6 gap-y-1 text-xs xl:hidden"/);
  });

  /**
   * The shell sidebar is a fixed 240px, so `lg` (1024px viewport) leaves too little content
   * width for eight columns. Pinning this stops the table being widened back onto a breakpoint
   * where it truncates addresses.
   */
  it("engages the multi-column layout at xl, not lg", async () => {
    const text = await row();
    assert.doesNotMatch(text, /\blg:/);
  });
});

describe("Property Health pipeline and scope", () => {
  it("keeps filtering, search and ordering in the shared pipeline", async () => {
    const text = await container();
    assert.match(
      text,
      /buildPortfolioHealthView\(\{ rows, filters: selectedFilters, query: searchQuery, status, sort \}\)/,
    );
    assert.doesNotMatch(text, /filterPortfolioHealthCleanupQueue/);
    assert.doesNotMatch(text, /\.sort\(/);
    assert.doesNotMatch(text, /rankPortfolioHealthRows/);
  });

  it("persists search, filters, status and sort in one URL writer", async () => {
    const text = await container();
    assert.match(text, /parseSearchQueryParam\(searchParams\.get\("q"\)\)/);
    assert.match(text, /parseCleanupFiltersParam\(searchParams\.get\("filters"\)\)/);
    assert.match(text, /parsePortfolioHealthStatusFilter\(searchParams\.get\(PORTFOLIO_HEALTH_STATUS_PARAM\)\)/);
    assert.match(text, /parsePortfolioHealthSort\(searchParams\.get\(PORTFOLIO_HEALTH_SORT_PARAM\)\)/);
    assert.equal(text.match(/composePortfolioHealthUrlParams/g)?.length, 2);
  });

  it("presents the tiered attention status, not the legacy binary status", async () => {
    const text = await allSources();
    assert.match(text, /AttentionStatusBadge/);
    assert.doesNotMatch(text, /row\.overallStatus/);
    assert.doesNotMatch(text, /summary\.needsReview/);
  });

  it("carries the whole worklist state on every outbound edit link", async () => {
    const container_ = await container();
    // One object, threaded through, rather than four query-string fragments assembled per link.
    assert.match(container_, /const viewState = useMemo<HealthViewState>/);
    assert.match(container_, /filters: selectedFilters, query: searchQuery, status, sort/);
    assert.match(container_, /viewState=\{viewState\}/);

    // The toolbar and summary strip still take `selectedFilters` for the filter chips; it is the
    // row, which builds the outbound links, that must receive the whole state.
    const rowText = await row();
    assert.ok(
      !rowText.includes("selectedFilters"),
      "the row must not build links from filters alone",
    );
  });

  it("routes property editing to the shared editor rather than a local copy", async () => {
    const text = await allSources();
    assert.match(text, /buildHealthEditPropertyHref/);

    // Property Health links into the canonical editor. It must never render property fields or
    // call a property write action itself, or the two surfaces would drift.
    const editSurfaces = [await row(), await editActions()].join("\n");
    for (const forbidden of [
      "updatePropertyAddressAction",
      "updatePropertyOwnerStrataAction",
      "PropertyAddressSection",
      "parsePropertyAddressFormInput",
      "<form",
      "<input",
      "<textarea",
    ]) {
      assert.ok(
        !editSurfaces.includes(forbidden),
        `${forbidden} would make Property Health a second property editor`,
      );
    }
  });

  it("gates every edit affordance on per-row canEdit", async () => {
    const actions = await editActions();
    assert.match(actions, /if \(!row\.canEdit\)/);
    assert.match(actions, /view-only access/);

    // The collapsed row's action cell degrades to plain navigation instead of hiding the row.
    const rowText = await row();
    assert.match(rowText, /row\.canEdit \?/);
    assert.match(rowText, /Open\n/);

    // Tenancy edits authorize on the same predicate, so the tenant affordance is gated too while
    // "Open tenancy" stays available to viewers.
    assert.match(rowText, /canEdit \? \(\s*<Link\s+href=\{buildHealthEditTenancyHref/);
    assert.match(rowText, /Open tenancy/);
    assert.match(rowText, /canEdit=\{row\.canEdit\}/);
  });

  it("reuses the issue labels for Fix affordances instead of restating them", async () => {
    const actions = await editActions();
    assert.match(actions, /PORTFOLIO_HEALTH_MISSING_LABELS\[issueKey\]/);
    assert.doesNotMatch(actions, /Missing postal code|Missing owner|Missing city/);
  });

  it("keeps documents and tenant issues on their existing workflows", async () => {
    const actions = await editActions();
    assert.match(actions, /anchor: "documents"/);
    // Tenant issues fall through to the per-unit tenancy links in the expanded panel.
    assert.match(actions, /return null;/);
    assert.doesNotMatch(actions, /uploadPropertyDocumentAction/);
  });
});
