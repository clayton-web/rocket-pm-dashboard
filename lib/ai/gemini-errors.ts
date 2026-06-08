export function isGeminiRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return (
    message.includes("429") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    normalized.includes("quota") ||
    normalized.includes("rate limit") ||
    normalized.includes("rate-limit")
  );
}
