type ChatRole = "system" | "user";
export type MarketRentChatMessage = { role: ChatRole; content: string };

const DEFAULT_MODEL = "gpt-4o-mini";

export function getOpenAiMarketRentModel(): string {
  return process.env.OPENAI_MARKET_RENT_MODEL?.trim() || DEFAULT_MODEL;
}

export function isOpenAiApiKeyConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function assertOpenAiApiKeyConfigured(): void {
  if (!isOpenAiApiKeyConfigured()) {
    throw new Error(
      "OPENAI_API_KEY is not configured. Add OPENAI_API_KEY to your environment to enable OpenAI synthesis for market rent research.",
    );
  }
}

export type CreateMarketRentChatJsonCompletion = (args: {
  messages: MarketRentChatMessage[];
}) => Promise<unknown>;

/**
 * Chat-style JSON completion for Market Rent Research synthesis (OpenAI Chat Completions API).
 * Separate from the Rental Ad Assistant and inbox AI responder pipeline.
 */
export async function createMarketRentChatJsonCompletion(args: {
  messages: MarketRentChatMessage[];
}): Promise<unknown> {
  assertOpenAiApiKeyConfigured();

  const apiKey = process.env.OPENAI_API_KEY!.trim();
  const model = getOpenAiMarketRentModel();

  const systemMessages = args.messages.filter((m) => m.role === "system").map((m) => m.content);
  const userMessages = args.messages.filter((m) => m.role === "user").map((m) => m.content);
  const systemInstruction = systemMessages.join("\n\n").trim();
  const userText = userMessages.join("\n\n").trim();

  if (!userText) {
    throw new Error("OpenAI request is missing user message content.");
  }

  const openAiMessages: Array<{ role: "system" | "user"; content: string }> = [];
  if (systemInstruction) {
    openAiMessages.push({ role: "system", content: systemInstruction });
  }
  openAiMessages.push({ role: "user", content: userText });

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: openAiMessages,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`OpenAI request failed: ${message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `OpenAI request failed (${response.status})${body ? `: ${body.slice(0, 300)}` : ""}`,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    throw new Error("OpenAI returned an empty response.");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("OpenAI returned content that could not be parsed as JSON.");
  }
}
