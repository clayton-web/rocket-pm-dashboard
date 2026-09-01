import React, { type ReactNode } from "react";

/**
 * Shared visual treatment for status chips.
 *
 * The boundary matters: this module owns `tone -> visual treatment` only. Domains keep owning
 * `business status -> tone + label`, so a maintenance status, a leasing attention kind and a
 * briefing category can all render consistently without this file learning their vocabularies.
 *
 * Meaning never rests on colour: the badge always renders its label as text, and callers can pass
 * an additional glyph for the cases that must read at a glance.
 */
export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

/**
 * `soft` is routine status. `strong` is the attention-carrying treatment the portal already used
 * for overdue, emergency and blocking-review states — a darker border and ink on the same surface.
 */
export type StatusEmphasis = "soft" | "strong";

const TONE_CLASSES: Record<StatusTone, Record<StatusEmphasis, string>> = {
  neutral: {
    soft: "border-border bg-surface-muted text-foreground-muted",
    strong: "border-border-strong bg-surface text-foreground",
  },
  success: {
    soft: "border-success-border bg-success-surface text-success-foreground",
    strong: "border-success-border-strong bg-success-surface text-success-foreground-strong",
  },
  warning: {
    soft: "border-warning-border bg-warning-surface text-warning-foreground",
    strong: "border-warning-border-strong bg-warning-surface text-warning-foreground-strong",
  },
  danger: {
    soft: "border-danger-border bg-danger-surface text-danger-foreground",
    strong: "border-danger-border-strong bg-danger-surface text-danger-foreground-strong",
  },
  info: {
    soft: "border-info-border bg-info-surface text-info-foreground",
    strong: "border-info-border-strong bg-info-surface text-info-foreground-strong",
  },
};

const BADGE_BASE =
  "inline-flex max-w-full items-center gap-1 truncate rounded-md border px-2 py-0.5 text-xs font-medium";

export function statusBadgeClasses(
  tone: StatusTone = "neutral",
  emphasis: StatusEmphasis = "soft",
  className = "",
): string {
  return [BADGE_BASE, TONE_CLASSES[tone][emphasis], className].filter(Boolean).join(" ");
}

export function StatusBadge({
  tone = "neutral",
  emphasis = "soft",
  icon,
  className,
  children,
}: {
  tone?: StatusTone;
  emphasis?: StatusEmphasis;
  /** Decorative reinforcement for at-a-glance reading; the label still carries the meaning. */
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={statusBadgeClasses(tone, emphasis, className)}>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
