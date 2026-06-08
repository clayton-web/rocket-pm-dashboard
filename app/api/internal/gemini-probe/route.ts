import { NextResponse } from "next/server";
import {
  createChatJsonCompletion,
  getGeminiResponderModel,
} from "@/lib/ai/gemini-client";
import { getJobProcessorSecret, verifyJobProcessorRequest } from "@/lib/jobs/policy";

export const runtime = "nodejs";
export const maxDuration = 30;

function sanitizeGeminiError(message: string): string {
  return message
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, "[REDACTED]")
    .slice(0, 500);
}

/** Minimal Gemini connectivity check for production diagnostics. No secrets in response. */
export async function POST(request: Request) {
  if (!getJobProcessorSecret()) {
    return NextResponse.json(
      { error: "Job processor is not configured (JOB_PROCESSOR_SECRET or CRON_SECRET)." },
      { status: 503 },
    );
  }

  if (!verifyJobProcessorRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
  const model = getGeminiResponderModel();

  if (!geminiConfigured) {
    return NextResponse.json({
      ok: false,
      geminiConfigured: false,
      model,
      probe: { ok: false, errorClass: "missing_api_key" },
    });
  }

  try {
    const raw = await createChatJsonCompletion({
      messages: [
        { role: "system", content: "Reply with JSON only." },
        {
          role: "user",
          content:
            'Return {"category":"UNCATEGORIZED","confidence":0.1,"reason":"probe"}',
        },
      ],
    });

    const parsed =
      typeof raw === "object" &&
      raw !== null &&
      "category" in raw &&
      "confidence" in raw &&
      "reason" in raw;

    return NextResponse.json({
      ok: parsed,
      geminiConfigured: true,
      model,
      probe: { ok: parsed, errorClass: parsed ? null : "invalid_model_output" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const sanitized = sanitizeGeminiError(message);

    let errorClass = "gemini_request_failed";
    if (sanitized.includes("GEMINI_API_KEY is not configured")) {
      errorClass = "missing_api_key";
    } else if (sanitized.includes("PERMISSION_DENIED") || sanitized.includes("API key not valid")) {
      errorClass = "invalid_api_key";
    } else if (sanitized.includes("leaked")) {
      errorClass = "leaked_api_key";
    } else if (sanitized.includes("429") || sanitized.toLowerCase().includes("quota")) {
      errorClass = "quota_or_rate_limit";
    } else if (sanitized.includes("404") || sanitized.toLowerCase().includes("not found")) {
      errorClass = "wrong_model_name";
    } else if (sanitized.includes("prompt blocked") || sanitized.includes("blockReason")) {
      errorClass = "blocked_prompt";
    } else if (sanitized.includes("could not be parsed as JSON")) {
      errorClass = "json_parse_error";
    }

    return NextResponse.json({
      ok: false,
      geminiConfigured: true,
      model,
      probe: { ok: false, errorClass, message: sanitized },
    });
  }
}
