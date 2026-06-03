/** Max length for staff-entered move-out inspection notes. */
export const MOVE_OUT_INSPECTION_NOTES_MAX = 8000;

export function normalizeInspectionNotes(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > MOVE_OUT_INSPECTION_NOTES_MAX) {
    throw new Error(`Inspection notes must be at most ${MOVE_OUT_INSPECTION_NOTES_MAX} characters`);
  }
  return trimmed;
}

export function normalizeInspectionReportUrl(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Inspection report URL must be a valid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Inspection report URL must use http or https");
  }
  return trimmed;
}
