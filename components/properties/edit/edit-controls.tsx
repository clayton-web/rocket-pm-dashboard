"use client";

import { useEffect, useState } from "react";
import {
  parsePropertyEditSectionFromHash,
  propertyEditSectionAnchor,
  type PropertyEditSection,
} from "@/lib/property/portfolio-health-edit-targets";
import { parseHealthFocusField } from "@/lib/property/portfolio-health-return";

/**
 * Shared pieces of the extracted Property Detail edit sections.
 *
 * Only the parts that were byte-identical across the original inline sections live here. The
 * per-section markup stayed with each section so the extraction could not change spacing or
 * wording, which is also why the container classes are passed in rather than standardized.
 */

/** The input styling the property forms already used inline, in one place. */
export const PROPERTY_EDIT_INPUT_CLASS =
  "w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm";

const DISCLOSURE_CLASS = "text-sm font-medium text-neutral-800 underline";

const CANCEL_CLASS =
  "rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700";

export function EditDisclosureButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={DISCLOSURE_CLASS}>
      {children}
    </button>
  );
}

export function EditCancelButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={CANCEL_CLASS}>
      Cancel
    </button>
  );
}

/**
 * Open/closed state for one edit section, plus deep-link handling.
 *
 * A targeted Fix action from Property Health arrives as `#edit-<section>?focus=<field>`. The
 * matching section opens itself and moves focus to that field once. Focus is deliberately
 * one-shot and only ever follows an explicit navigation: nothing re-steals it on later renders,
 * and no focus is trapped, so a keyboard user can tab straight out of the section.
 */
export function usePropertyEditSection(section: PropertyEditSection): {
  showEdit: boolean;
  setShowEdit: (open: boolean) => void;
  anchorId: string;
} {
  const [showEdit, setShowEdit] = useState(false);
  const [focusField, setFocusField] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (parsePropertyEditSectionFromHash(window.location.hash) !== section) return;
    setShowEdit(true);
    setFocusField(parseHealthFocusField(new URLSearchParams(window.location.search)));
  }, [section]);

  useEffect(() => {
    if (!showEdit || !focusField) return;
    setFocusField(null);
    const target = document.getElementById(focusField);
    if (target) {
      target.focus();
      target.scrollIntoView({ block: "center" });
    }
  }, [showEdit, focusField]);

  return { showEdit, setShowEdit, anchorId: propertyEditSectionAnchor(section) };
}
