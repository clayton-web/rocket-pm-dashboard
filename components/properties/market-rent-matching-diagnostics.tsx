import type { MarketRentMatchingDiagnostics } from "@/lib/market-rent-research/types";

export function MarketRentMatchingDiagnosticsSection({
  diagnostics,
}: {
  diagnostics: MarketRentMatchingDiagnostics;
}) {
  return (
    <section>
      <h4 className="font-semibold text-neutral-800">Comp matching (Preview)</h4>
      <p className="mt-1">
        Raw Craigslist listings found: {diagnostics.rawListingCount}
      </p>
      <p className="mt-1">Matched: {diagnostics.matchedCount}</p>
      <p className="mt-1">Rejected: {diagnostics.rejectedCount}</p>
      {diagnostics.keptCount > 0 ? (
        <p className="mt-1">Used after outlier filter: {diagnostics.keptCount}</p>
      ) : null}
      {diagnostics.craigslistHostname ? (
        <p className="mt-1 font-mono text-[11px] text-neutral-500">
          Craigslist hostname: {diagnostics.craigslistHostname}
          {diagnostics.craigslistAreaId != null
            ? ` · area_id ${diagnostics.craigslistAreaId}`
            : ""}
        </p>
      ) : null}
      {diagnostics.craigslistSearchQuery ? (
        <p className="mt-2 break-all font-mono text-[11px] text-neutral-500">
          Craigslist query: {diagnostics.craigslistSearchQuery}
        </p>
      ) : null}
      {diagnostics.rejectionReasons.length > 0 ? (
        <>
          <p className="mt-2 font-medium text-neutral-700">Rejection reasons</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {diagnostics.rejectionReasons.map((item) => (
              <li key={item.reason}>
                {item.count} {item.reason}
              </li>
            ))}
          </ul>
        </>
      ) : diagnostics.rawListingCount === 0 ? (
        <p className="mt-2 text-neutral-500">
          Craigslist returned no listings for this search query — matching was not applied.
        </p>
      ) : (
        <p className="mt-2 text-neutral-500">No listings rejected by matching rules.</p>
      )}
    </section>
  );
}
