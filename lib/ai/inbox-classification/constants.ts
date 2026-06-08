export const INBOX_CLASSIFICATION_PROMPT_VERSION = "inbox-classify-v1";

/** Minimum model confidence required before persisting an AI category. */
export const INBOX_CLASSIFICATION_MIN_CONFIDENCE = 0.7;

/**
 * Max Gemini calls per agent.triage job run.
 * Conservative default for Gemini free tier (~5 requests/minute).
 */
export const INBOX_CLASSIFICATION_BATCH_SIZE = 5;

/** Max recent messages included in classification context. */
export const INBOX_CLASSIFICATION_MAX_MESSAGES = 6;

/** Max characters per message body in classification context. */
export const INBOX_CLASSIFICATION_MAX_BODY_CHARS = 2000;
