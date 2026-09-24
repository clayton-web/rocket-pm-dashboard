import { PhotoEnhancerError } from "./errors";
import { PHOTO_ENHANCER_PROMPT } from "./prompt";
import type { PhotoEnhancerContentType } from "./image-limits";

/** Official Image API default for edit-precision workflows (Image generation guide, 2026). */
export const DEFAULT_PHOTO_ENHANCER_MODEL = "gpt-image-2.5-sunburst";

const OPENAI_IMAGES_EDITS_URL = "https://api.openai.com/v1/images/edits";
const OPENAI_TIMEOUT_MS = 55_000;

export function getOpenAiPhotoEnhancerModel(): string {
  return process.env.OPENAI_PHOTO_ENHANCER_MODEL?.trim() || DEFAULT_PHOTO_ENHANCER_MODEL;
}

export function isOpenAiApiKeyConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function assertOpenAiApiKeyConfigured(): void {
  if (!isOpenAiApiKeyConfigured()) {
    throw new PhotoEnhancerError(
      "missing_api_key",
      "OPENAI_API_KEY is not configured. Add OPENAI_API_KEY to the server environment to enable Photo Enhancer.",
    );
  }
}

/**
 * `input_fidelity` is valid for GPT Image 1 / 1.5 (`low` | `high`).
 * Official docs require omitting it for `gpt-image-2` and later: those models
 * always process image inputs at high fidelity.
 */
export function shouldSendInputFidelity(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return (
    normalized === "gpt-image-1" ||
    normalized === "gpt-image-1-mini" ||
    normalized === "gpt-image-1.5"
  );
}

function sanitizeOpenAiBody(body: string): string {
  return body
    .replace(/sk-[a-zA-Z0-9_-]+/g, "[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .slice(0, 240);
}

function throwForOpenAiStatus(status: number, body: string, model: string): never {
  const snippet = sanitizeOpenAiBody(body);
  const combined = `${status} ${snippet}`.toLowerCase();

  if (status === 401) {
    throw new PhotoEnhancerError(
      "missing_api_key",
      "OPENAI_API_KEY was rejected. Confirm the server key is valid.",
    );
  }

  if (
    status === 403 ||
    status === 404 ||
    combined.includes("model_not_found") ||
    combined.includes("does not have access") ||
    combined.includes("organization verification") ||
    combined.includes("not available")
  ) {
    throw new PhotoEnhancerError(
      "model_unavailable",
      `This OpenAI project does not have access to the configured image model (${model}). Verify GPT Image access in the OpenAI dashboard, complete organization verification if required, or set OPENAI_PHOTO_ENHANCER_MODEL to an allowed edits model.`,
    );
  }

  if (status === 429) {
    throw new PhotoEnhancerError(
      "openai_rejected",
      "OpenAI rate-limited the enhancement request. Wait a moment and try again.",
    );
  }

  throw new PhotoEnhancerError(
    "openai_rejected",
    "OpenAI rejected the enhancement request. Try a different photo or try again.",
  );
}

export async function enhanceRealEstatePhoto(args: {
  bytes: Uint8Array;
  fileName: string;
  contentType: PhotoEnhancerContentType;
}): Promise<Uint8Array> {
  assertOpenAiApiKeyConfigured();

  const apiKey = process.env.OPENAI_API_KEY!.trim();
  const model = getOpenAiPhotoEnhancerModel();

  const form = new FormData();
  form.set("model", model);
  form.set("prompt", PHOTO_ENHANCER_PROMPT);
  form.set(
    "image",
    new Blob([Buffer.from(args.bytes)], { type: args.contentType }),
    args.fileName,
  );
  form.set("output_format", "png");
  form.set("quality", "high");
  form.set("size", "auto");
  if (shouldSendInputFidelity(model)) {
    form.set("input_fidelity", "high");
  }

  let response: Response;
  try {
    response = await fetch(OPENAI_IMAGES_EDITS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new PhotoEnhancerError(
        "openai_timeout",
        "The enhancement request timed out. Try a smaller photo or try again.",
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new PhotoEnhancerError(
      "openai_failed",
      `The enhancement request failed: ${message.slice(0, 160)}`,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throwForOpenAiStatus(response.status, body, model);
  }

  let payload: { data?: Array<{ b64_json?: string | null }> };
  try {
    payload = (await response.json()) as { data?: Array<{ b64_json?: string | null }> };
  } catch {
    throw new PhotoEnhancerError(
      "openai_malformed",
      "OpenAI returned an unreadable image response.",
    );
  }

  const encoded = payload.data?.[0]?.b64_json?.trim() ?? "";
  if (!encoded) {
    throw new PhotoEnhancerError(
      "openai_malformed",
      "OpenAI returned an empty image response.",
    );
  }

  try {
    return Uint8Array.from(Buffer.from(encoded, "base64"));
  } catch {
    throw new PhotoEnhancerError(
      "openai_malformed",
      "OpenAI returned an image that could not be decoded.",
    );
  }
}
