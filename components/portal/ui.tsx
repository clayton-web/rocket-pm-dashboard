import React, { type ReactNode } from "react";
import { buttonClasses } from "@/components/portal/button";

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

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

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

export function InlineAlert({ children }: { children: ReactNode }) {
  return (
    <p
      className="rounded-lg border border-danger-border bg-danger-surface px-3.5 py-3 text-sm text-danger-foreground"
      role="alert"
    >
      {children}
    </p>
  );
}

export function InlineNotice({ children, className = "", role }: { children: ReactNode; className?: string; role?: string }) {
  return (
    <p
      className={`rounded-lg border border-border bg-surface-muted px-3.5 py-3 text-sm text-foreground-muted ${className}`}
      role={role}
    >
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
