const GUIDED_META_MARKER = "--- guided_meta ---";

export function splitTriageSummaryForDisplay(raw: string | null | undefined): {
  narrative: string;
  guidedMetaRaw: string | null;
} {
  if (!raw?.trim()) {
    return { narrative: "", guidedMetaRaw: null };
  }
  const idx = raw.indexOf(GUIDED_META_MARKER);
  if (idx === -1) {
    return { narrative: raw.trim(), guidedMetaRaw: null };
  }
  const narrative = raw.slice(0, idx).trim();
  const guidedMetaRaw = raw.slice(idx + GUIDED_META_MARKER.length).trim() || null;
  return { narrative, guidedMetaRaw };
}

export function triageSummaryListPreview(raw: string | null | undefined): string | null {
  const { narrative } = splitTriageSummaryForDisplay(raw);
  const t = narrative.trim();
  if (!t) return null;
  return t.length > 120 ? `${t.slice(0, 117)}…` : t;
}

export function formatGuidedMetaForDisplay(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}
