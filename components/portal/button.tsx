import React from "react";

/**
 * Shared action treatment for the portal.
 *
 * `buttonClasses` is the contract; `Button` is a thin element wrapper over it. Links that act as
 * buttons apply `buttonClasses` directly to `next/link` rather than being wrapped, so routing
 * props stay the caller's business.
 *
 * D-011 (docs/branding.md): the primary action is high-contrast dark ink, not Rocket red. Red is
 * reserved for identity and for genuinely destructive actions, which is why `danger` is a filled
 * red distinct from `primary` rather than a shade of it.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/** Sizes reflect the three densities already in the portal, not a speculative scale. */
export type ButtonSize = "xs" | "sm" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "border-primary bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary: "border-border-strong bg-surface text-foreground hover:bg-surface-muted",
  ghost: "border-transparent bg-transparent text-foreground-muted hover:bg-surface-muted hover:text-foreground",
  danger: "border-danger bg-danger text-primary-foreground hover:bg-danger-hover",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: "rounded-md px-3 py-1.5 text-xs font-medium",
  sm: "rounded-md px-4 py-2 text-sm font-medium",
  lg: "rounded-xl px-4 py-3.5 text-sm font-semibold",
};

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 border no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

export function buttonClasses({
  variant = "secondary",
  size = "sm",
  block = false,
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full-width action, as used by the stacked tenant forms. */
  block?: boolean;
  className?: string;
} = {}): string {
  return [
    BASE_CLASSES,
    SIZE_CLASSES[size],
    VARIANT_CLASSES[variant],
    block ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant,
  size,
  block,
  className,
  type = "button",
  ...props
}: React.ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}) {
  return <button type={type} className={buttonClasses({ variant, size, block, className })} {...props} />;
}
