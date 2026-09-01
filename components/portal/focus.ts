/**
 * The portal's single keyboard-focus treatment.
 *
 * High-contrast ink rather than red, so a focus ring is never mistaken for an error state. Lives on
 * its own so the primitives can share it without `ui.tsx` and `button.tsx` importing each other.
 */
export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
