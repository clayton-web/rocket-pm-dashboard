const DEFAULT_MODEL = "gpt-4o-mini";

type ChatMessage = { role: "system" | "user"; content: string };

export function getOpenAiModelName() {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

export function assertOpenAiConfigured() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
}

export async function createChatJsonCompletion(args: { messages: ChatMessage[] }): Promise<unknown> {
  assertOpenAiConfigured();

  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const url = `${baseUrl}/chat/completions`;

  const body = {
    model: getOpenAiModelName(),
    temperature: 0.35,
    response_format: { type: "json_object" },
    messages: args.messages,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${text}`);
  }

  const raw = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = raw.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response.");
  }

  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new Error("OpenAI returned non-JSON content.");
  }
}
