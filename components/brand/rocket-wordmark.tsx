import React from "react";

/**
 * Compact text wordmark — the approved corporate fallback treatment (rocket-logic-brand D-005).
 *
 * Deliberately text-only. No transparent Rocket master asset exists yet (corporate O-001), and the
 * one Generation B reference is an opaque bitmap on a black field, which cannot go on this light
 * shell. Read docs/branding.md § Logo treatment before replacing this with an image.
 */
export function RocketWordmark() {
  return (
    <span className="flex flex-col leading-tight">
      <span className="text-base font-semibold tracking-tight text-foreground">
        Rocket <span className="text-brand">PM</span>
      </span>
      <span className="text-[11px] font-medium uppercase tracking-wide text-foreground-subtle">
        Dashboard
      </span>
    </span>
  );
}
