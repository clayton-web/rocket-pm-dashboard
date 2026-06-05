/** Normalize and validate an OpenAI API key from env (supports optional quotes). */
export function normalizeOpenAiApiKey(raw: string | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) return undefined;
  if (!trimmed.startsWith("sk-")) return undefined;
  if (trimmed.length < 20) return undefined;

  const lower = trimmed.toLowerCase();
  if (
    lower.includes("your-api-key") ||
    lower.includes("replace-me") ||
    lower.includes("changeme") ||
    lower === "sk-" ||
    lower.startsWith("sk-xxx")
  ) {
    return undefined;
  }

  return trimmed;
}

/**
 * Resolve OpenAI key for Market Rent Research.
 * Preview may set OPENAI_MARKET_RENT_API_KEY without touching shared OPENAI_API_KEY.
 */
export function resolveOpenAiApiKeyForMarketRent(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return (
    normalizeOpenAiApiKey(env.OPENAI_MARKET_RENT_API_KEY) ??
    normalizeOpenAiApiKey(env.OPENAI_API_KEY)
  );
}
