import React, { type ReactNode } from "react";
import { buttonClasses } from "@/components/portal/button";
import { FOCUS_RING } from "@/components/portal/focus";
import type { StatusTone } from "@/components/portal/status-badge";

/**
 * Shared portal primitives.
 *
 * These consume the portal semantic theme (app/globals.css) rather than raw Tailwind palette
 * classes, so they express roles — surface, border, foreground, primary, danger — instead of
 * acting as an implicit palette of their own. Layout, spacing and behaviour are unchanged from
 * the pre-token versions; see docs/branding.md.
 */

export const SURFACE_PANEL = "rounded-xl border border-border bg-surface";
export const SURFACE_CARD = "rounded-xl border border-border bg-surface shadow-sm";
export const SURFACE_DASHED =
  "rounded-xl border border-dashed border-border-strong bg-surface-muted/80";

export function PortalPageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
}) {
  return (
    <header className="mb-6">
      <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">{eyebrow}</p>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{description}</p>
    </header>
  );
}

export function FormSection({
  legend,
  helper,
  children,
  groupAriaLabel,
}: {
  legend: string;
  helper?: string;
  children: ReactNode;
  groupAriaLabel?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-3" aria-label={groupAriaLabel ?? legend}>
      <legend className="text-sm font-semibold text-foreground">{legend}</legend>
      {helper ? <p className="text-sm text-foreground-muted">{helper}</p> : null}
      {children}
    </fieldset>
  );
}

export function FormField({
  htmlFor,
  label,
  helper,
  error,
  children,
}: {
  htmlFor?: string;
  label: ReactNode;
  helper?: string;
  /**
   * Validation message. Rendered with a glyph, a weight change and `role="alert"` so the failure
   * is never signalled by colour alone. Pair with `aria-invalid` and `aria-describedby` on the
   * control, which stays the caller's since this component does not own the element.
   */
  error?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      {helper ? <p className="text-sm text-foreground-muted">{helper}</p> : null}
      {children}
      {error ? (
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          role="alert"
          className="flex items-start gap-1.5 text-sm font-medium text-danger-foreground"
        >
          <span aria-hidden="true">!</span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export function SelectionCard({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-colors ${FOCUS_RING} ${
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border-strong bg-surface text-foreground hover:border-foreground-subtle"
      }`}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  type = "button",
  disabled,
  onClick,
  children,
  className = "",
}: {
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={buttonClasses({ variant: "primary", size: "lg", block: true, className })}
    >
      {children}
    </button>
  );
}

/**
 * Toned system-state strips.
 *
 * Tones reuse the `StatusBadge` vocabulary so the portal has one answer to "what does warning look
 * like". `compact` is the denser strip the operational panels already used; it is a size rather
 * than a `className` override because border, radius and background cannot be reliably overridden
 * by appending utilities.
 */
const NOTICE_TONE: Record<StatusTone, string> = {
  neutral: "border-border bg-surface-muted text-foreground-muted",
  success: "border-success-border bg-success-surface text-success-foreground",
  warning: "border-warning-border bg-warning-surface text-warning-foreground",
  danger: "border-danger-border bg-danger-surface text-danger-foreground",
  info: "border-info-border bg-info-surface text-info-foreground",
};

const NOTICE_SIZE = {
  default: "rounded-lg px-3.5 py-3 text-sm",
  compact: "rounded-md px-3 py-2 text-xs",
} as const;

export type NoticeSize = keyof typeof NOTICE_SIZE;

export function noticeClasses(
  tone: StatusTone = "neutral",
  size: NoticeSize = "default",
  className = "",
): string {
  return ["border", NOTICE_SIZE[size], NOTICE_TONE[tone], className].filter(Boolean).join(" ");
}

/** Danger-toned notice that also announces itself. */
export function InlineAlert({ children, size }: { children: ReactNode; size?: NoticeSize }) {
  return (
    <p className={noticeClasses("danger", size)} role="alert">
      {children}
    </p>
  );
}

export function InlineNotice({
  children,
  className = "",
  role,
  tone = "neutral",
  size = "default",
}: {
  children: ReactNode;
  className?: string;
  role?: string;
  tone?: StatusTone;
  size?: NoticeSize;
}) {
  return (
    <p className={noticeClasses(tone, size, className)} role={role}>
      {children}
    </p>
  );
}

export function StickyFormFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-1 border-t border-border bg-surface-muted/95 px-1 pb-4 pt-4 backdrop-blur-sm">
      {children}
    </div>
  );
}

export function toggleTileClasses(active: boolean): string {
  const base = `rounded-lg border px-3 py-1.5 text-sm font-medium ${FOCUS_RING}`;
  return active
    ? `${base} border-primary bg-primary text-primary-foreground`
    : `${base} border-border-strong bg-surface text-foreground-muted hover:bg-surface-muted`;
}
