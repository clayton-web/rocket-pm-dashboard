import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-2.5-flash";

type ChatRole = "system" | "user";
type ChatMessage = { role: ChatRole; content: string };

export function getGeminiResponderModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

export function assertGeminiApiKeyConfigured(): void {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Add GEMINI_API_KEY to your environment (e.g. .env). Obtain a key from Google AI Studio: https://aistudio.google.com/apikey",
    );
  }
}

function mapMessagesToGemini(messages: ChatMessage[]): { systemInstruction: string | undefined; userText: string } {
  const systemParts: string[] = [];
  const userParts: string[] = [];
  for (const m of messages) {
    if (m.role === "system") systemParts.push(m.content);
    else userParts.push(m.content);
  }
  const systemJoined = systemParts.join("\n\n").trim();
  const userText = userParts.join("\n\n").trim();
  return {
    systemInstruction: systemJoined.length > 0 ? systemJoined : undefined,
    userText,
  };
}

/**
 * Chat-style JSON completion for the responder pipeline (Gemini Developer API via @google/genai).
 * Expects structured JSON aligned with responder system prompt; same caller contract as the former OpenAI helper.
 */
export async function createChatJsonCompletion(args: { messages: ChatMessage[] }): Promise<unknown> {
  assertGeminiApiKeyConfigured();

  const { systemInstruction, userText } = mapMessagesToGemini(args.messages);
  if (!userText) {
    throw new Error("Gemini request is missing user message content.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!.trim() });

  let response;
  try {
    response = await ai.models.generateContent({
      model: getGeminiResponderModel(),
      contents: userText,
      config: {
        systemInstruction,
        temperature: 0.35,
        responseMimeType: "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini request failed: ${message}`);
  }

  const text = typeof response.text === "string" ? response.text.trim() : "";
  if (!text) {
    const pf = response.promptFeedback;
    const blockReason =
      pf && typeof pf === "object" && pf !== null && "blockReason" in pf
        ? String((pf as { blockReason?: unknown }).blockReason ?? "")
        : "";
    throw new Error(
      blockReason
        ? `Gemini returned no text (prompt blocked${blockReason ? `: ${blockReason}` : ""}).`
        : "Gemini returned an empty response.",
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Gemini returned content that could not be parsed as JSON.");
  }
}
