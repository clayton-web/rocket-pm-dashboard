/**
 * Shared treatment for native form controls.
 *
 * This is a class contract rather than a set of wrapper components on purpose: inputs, selects and
 * textareas in this portal are driven by server actions, refs, controlled state and per-field
 * handlers, and wrapping them would mean re-exposing all of that. Callers keep their own element
 * and props and take the styling from here.
 *
 * Inputs, selects and textareas share one treatment because that is what the portal already does.
 */

import { FOCUS_RING } from "@/components/portal/focus";

/**
 * Densities matching the dense thread side panels, the compact staff forms and the roomier tenant
 * forms. These mirror `ButtonSize`, so an `xs` select and an `xs` button share a row cleanly.
 */
export type FormControlSize = "xs" | "sm" | "lg";

const CONTROL_BASE =
  `w-full border text-foreground placeholder:text-foreground-subtle ${FOCUS_RING} disabled:cursor-not-allowed disabled:opacity-60`;

const CONTROL_SIZE: Record<FormControlSize, string> = {
  xs: "rounded-md px-3 py-1.5 text-xs",
  sm: "rounded-md px-3 py-2 text-sm",
  lg: "rounded-xl bg-surface px-3.5 py-3 text-sm",
};

export function formControlClasses({
  size = "sm",
  invalid = false,
  className = "",
}: {
  size?: FormControlSize;
  /**
   * Pair this with `aria-invalid` on the element and an `error` on the surrounding `FormField`.
   * The border alone must never be the only signal that a field failed.
   */
  invalid?: boolean;
  className?: string;
} = {}): string {
  return [
    CONTROL_BASE,
    CONTROL_SIZE[size],
    invalid ? "border-danger-border-strong" : "border-border-strong",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}
