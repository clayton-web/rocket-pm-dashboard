import { StatusBadge, type StatusEmphasis, type StatusTone } from "@/components/portal/status-badge";
import {
  PORTFOLIO_HEALTH_MISSING_LABELS,
  type PortfolioHealthMissingItemKey,
} from "@/lib/property/portfolio-health";
import {
  orderPortfolioHealthIssueKeys,
  PORTFOLIO_HEALTH_ATTENTION_STATUS_LABELS,
  portfolioHealthIssueTier,
  type PortfolioHealthAttentionStatus,
  type PortfolioHealthIssueTier,
} from "@/lib/property/portfolio-health-ranking";

/**
 * Property Health's `business status -> tone + label` mapping, the domain half of the boundary
 * described in docs/branding.md. `StatusBadge` supplies the treatment; nothing here knows what
 * a danger surface looks like.
 *
 * Only two of the three tiers are loud. `optional` is neutral because a property missing strata
 * notes is not a third kind of alarm, and giving it its own colour would spend the page's whole
 * attention budget on the least important row.
 */
const TIER_TONE: Record<PortfolioHealthIssueTier, StatusTone> = {
  blocking: "danger",
  operational: "warning",
  optional: "neutral",
};

/**
 * Severity is never carried by colour alone: this word is read out before the issue label and
 * the glyph is decorative reinforcement on top of both.
 */
const TIER_SR_LABEL: Record<PortfolioHealthIssueTier, string> = {
  blocking: "Blocking issue",
  operational: "Operational issue",
  optional: "Optional issue",
};

const TIER_GLYPH: Record<PortfolioHealthIssueTier, string> = {
  blocking: "!",
  operational: "•",
  optional: "◦",
};

export const PORTFOLIO_HEALTH_TIER_LABELS: Record<PortfolioHealthIssueTier, string> = {
  blocking: "blocking",
  operational: "operational",
  optional: "optional",
};

/**
 * A property's status tone is the tone of its worst issue tier, which is exactly how
 * `attentionStatus` is derived. Expressing it as a derivation rather than a second table keeps
 * the two from drifting apart.
 */
const ATTENTION_TONE: Record<PortfolioHealthAttentionStatus, StatusTone> = {
  needs_attention: TIER_TONE.blocking,
  minor: TIER_TONE.operational,
  clear: "success",
};

const ATTENTION_EMPHASIS: Record<PortfolioHealthAttentionStatus, StatusEmphasis> = {
  needs_attention: "strong",
  minor: "soft",
  clear: "soft",
};

export function AttentionStatusBadge({
  status,
}: {
  status: PortfolioHealthAttentionStatus;
}) {
  return (
    <StatusBadge tone={ATTENTION_TONE[status]} emphasis={ATTENTION_EMPHASIS[status]}>
      {PORTFOLIO_HEALTH_ATTENTION_STATUS_LABELS[status]}
    </StatusBadge>
  );
}

export function IssueChip({ issueKey }: { issueKey: PortfolioHealthMissingItemKey }) {
  const tier = portfolioHealthIssueTier(issueKey);

  return (
    <StatusBadge tone={TIER_TONE[tier]} icon={TIER_GLYPH[tier]}>
      <span className="sr-only">{TIER_SR_LABEL[tier]}: </span>
      {PORTFOLIO_HEALTH_MISSING_LABELS[issueKey]}
    </StatusBadge>
  );
}

/**
 * Collapsed rows show the worst few issues and a count for the rest; the full set lives in the
 * expanded row. `limit` of 0 renders the count only, which is what the narrow mobile row wants.
 */
export function IssueChipList({
  issueKeys,
  limit = 3,
  className = "",
}: {
  issueKeys: readonly PortfolioHealthMissingItemKey[];
  limit?: number;
  className?: string;
}) {
  const ordered = orderPortfolioHealthIssueKeys(issueKeys);
  if (ordered.length === 0) {
    return <span className="text-xs text-foreground-subtle">No issues</span>;
  }

  const shown = ordered.slice(0, limit);
  const overflow = ordered.length - shown.length;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`.trim()}>
      {shown.map((issueKey) => (
        <IssueChip key={issueKey} issueKey={issueKey} />
      ))}
      {overflow > 0 ? (
        <span className="text-xs font-medium tabular-nums text-foreground-muted">
          +{overflow}
          <span className="sr-only"> more issues</span>
        </span>
      ) : null}
    </div>
  );
}

/**
 * "2 blocking · 1 operational", omitting zeroes. Optional issues are left out deliberately:
 * they do not change the status and listing them would dilute the counts that do.
 */
export function IssueTierCountLine({
  counts,
  className = "",
}: {
  counts: { blocking: number; operational: number };
  className?: string;
}) {
  const parts: string[] = [];
  if (counts.blocking > 0) parts.push(`${counts.blocking} blocking`);
  if (counts.operational > 0) parts.push(`${counts.operational} operational`);
  if (parts.length === 0) return null;

  return (
    <span className={`text-xs tabular-nums text-foreground-muted ${className}`.trim()}>
      {parts.join(" · ")}
    </span>
  );
}
