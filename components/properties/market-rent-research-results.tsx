"use client";

import { MARKET_RENT_FIXTURE_SAMPLE_NOTE } from "@/lib/market-rent-research/constants";
import {
  buildWhyThisRentBullets,
  formatComparableArea,
  formatComparableSpecs,
  formatConfidenceLabel,
  formatMonthlyRent,
  partitionDataQualityNotes,
} from "@/lib/market-rent-research/results-summary";
import { providerStatusUiMessage } from "@/lib/market-rent-research/provider-status-ui";
import type { MarketRentResearchResult } from "@/lib/market-rent-research/types";
import type { MarketRentResearchInputs } from "@/lib/validation/market-rent-research";

type MarketRentResearchResultsProps = {
  result: MarketRentResearchResult;
  inputs: MarketRentResearchInputs;
};

function ConfidenceBadge({ confidence }: { confidence: MarketRentResearchResult["confidence"] }) {
  const tone =
    confidence === "high"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : confidence === "medium"
        ? "bg-amber-50 text-amber-900 ring-amber-200"
        : "bg-neutral-100 text-neutral-700 ring-neutral-200";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${tone}`}
    >
      {formatConfidenceLabel(confidence)} confidence
    </span>
  );
}

export function MarketRentResearchResults({ result, inputs }: MarketRentResearchResultsProps) {
  const stats = result.statistics;
  const whyBullets = buildWhyThisRentBullets(result, inputs);
  const { openAiNotes, otherNotes } = partitionDataQualityNotes(result.dataQualityNotes);

  return (
    <div className="flex flex-col gap-5 border-t border-neutral-200 pt-5">
      <section className="rounded-2xl border border-neutral-200 bg-white px-4 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-600">Recommended Market Rent</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
              {formatMonthlyRent(result.suggestedRent.recommended)}
            </p>
          </div>
          <ConfidenceBadge confidence={result.confidence} />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-neutral-900">Rent range</h3>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
            <dt className="text-xs font-medium text-neutral-500">Conservative</dt>
            <dd className="mt-0.5 text-sm font-semibold text-neutral-900">
              {formatMonthlyRent(result.suggestedRent.conservative)}
            </dd>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
            <dt className="text-xs font-medium text-neutral-500">Aggressive</dt>
            <dd className="mt-0.5 text-sm font-semibold text-neutral-900">
              {formatMonthlyRent(result.suggestedRent.aggressive)}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-neutral-900">Why this rent?</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
          {whyBullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </section>

      {result.comparableListingsUsed.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold text-neutral-900">Comparable listings</h3>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {result.comparableListingsUsed.map((listing) => (
              <li
                key={`${listing.source}-${listing.sourceUrl}`}
                className="rounded-xl border border-neutral-200 bg-white px-3.5 py-3"
              >
                <a
                  href={listing.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base font-semibold text-neutral-900 underline-offset-2 hover:underline"
                >
                  {formatMonthlyRent(listing.monthlyRent)}
                </a>
                <p className="mt-1 text-sm text-neutral-700">{formatComparableSpecs(listing)}</p>
                <p className="mt-1 text-sm text-neutral-500">
                  {formatComparableArea(listing.addressDisplay)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="rounded-xl border border-neutral-200 bg-neutral-50/80">
        <summary className="cursor-pointer list-none px-3.5 py-3 text-sm font-semibold text-neutral-900 [&::-webkit-details-marker]:hidden">
          Research Details
        </summary>
        <div className="flex flex-col gap-4 border-t border-neutral-200 px-3.5 pb-4 pt-3 text-xs text-neutral-600">
          {result.usedFixtureComps ? (
            <section>
              <h4 className="font-semibold text-neutral-800">Fixture data</h4>
              <p className="mt-1">{MARKET_RENT_FIXTURE_SAMPLE_NOTE}</p>
            </section>
          ) : null}

          {result.providerStatuses.length > 0 ? (
            <section>
              <h4 className="font-semibold text-neutral-800">Listing sources</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {result.providerStatuses.map((status) => (
                  <li key={status.source}>{providerStatusUiMessage(status)}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h4 className="font-semibold text-neutral-800">OpenAI synthesis</h4>
            <p className="mt-1">
              Source: {result.explanationSource === "openai" ? "OpenAI narrative" : "Deterministic summary"}
            </p>
            {result.explanationSource === "openai" ? (
              <p className="mt-2 whitespace-pre-wrap text-neutral-700">{result.explanation}</p>
            ) : null}
            {openAiNotes.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {openAiNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section>
            <h4 className="font-semibold text-neutral-800">Statistics</h4>
            <p className="mt-1">
              Count {stats.count}
              {stats.median != null ? ` · Median $${Math.round(stats.median).toLocaleString("en-CA")}/month` : ""}
              {stats.mean != null
                ? ` · Mean $${Math.round(stats.mean).toLocaleString("en-CA")}/month`
                : ""}
              {stats.p25 != null && stats.p75 != null
                ? ` · Range $${Math.round(stats.p25).toLocaleString("en-CA")}–$${Math.round(stats.p75).toLocaleString("en-CA")}/month`
                : ""}
            </p>
            <p className="mt-1">
              Raw listings {result.rawListingCount}
              {result.excludedCount > 0 ? ` · ${result.excludedCount} excluded` : ""}
            </p>
            <p className="mt-1">
              Sources · Craigslist {result.sourceBreakdown.craigslist}
              {result.sourceBreakdown.rew > 0 ? ` · REW ${result.sourceBreakdown.rew}` : ""}
            </p>
            <p className="mt-1 text-neutral-500">{result.confidenceReason}</p>
          </section>

          {otherNotes.length > 0 ? (
            <section>
              <h4 className="font-semibold text-neutral-800">Data quality notes</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {otherNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {result.providerDiagnostics && result.providerDiagnostics.length > 0 ? (
            <section>
              <h4 className="font-semibold text-neutral-800">Provider diagnostics</h4>
              <ul className="mt-2 space-y-3">
                {result.providerDiagnostics.map((diag) => (
                  <li
                    key={`${diag.requestUrl}-${diag.elapsedMs}`}
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2 font-mono text-[11px] leading-relaxed text-neutral-700"
                  >
                    <p>
                      {diag.success ? "Success" : "Failure"} · {diag.elapsedMs}ms
                      {diag.httpStatus != null ? ` · HTTP ${diag.httpStatus}` : ""}
                    </p>
                    <p className="mt-1 break-all">{diag.requestUrl}</p>
                    {diag.responseBodySnippet ? (
                      <p className="mt-1 whitespace-pre-wrap break-all text-neutral-500">
                        {diag.responseBodySnippet}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </details>
    </div>
  );
}
