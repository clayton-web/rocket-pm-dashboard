/**
 * Normalize a sender address for inbox classification memory lookups.
 * Handles raw From headers and already-extracted addresses.
 */
export function normalizeSenderEmail(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed === "unknown") return null;

  const angle = trimmed.match(/<([^>]+)>/);
  const candidate = (angle ? angle[1] : trimmed).replace(/[<>]/g, "").trim();
  if (!candidate.includes("@")) return null;

  return candidate;
}
