import { GmailAuthError } from "@/lib/gmail/gmail-errors";

export const GMAIL_FETCH_TIMEOUT_MS = 30_000;

export type GmailFetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export type GmailApiRequestOptions = {
  fetchFn?: GmailFetchFn;
  timeoutMs?: number;
};

export type ThreadListResponse = {
  threads?: { id: string; snippet?: string; historyId?: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

export type GmailThreadResource = {
  id: string;
  snippet?: string;
  historyId?: string;
  messages?: GmailMessageResource[];
};

export type GmailMessageResource = {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPayloadPart;
};

export type GmailPayloadPart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; size?: number; attachmentId?: string };
  headers?: { name: string; value: string }[];
  parts?: GmailPayloadPart[];
};

export function createGmailFetchAbortSignal(timeoutMs: number = GMAIL_FETCH_TIMEOUT_MS): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  setTimeout(() => {
    controller.abort(new DOMException("The operation timed out.", "TimeoutError"));
  }, timeoutMs);
  return controller.signal;
}

async function gmailFetch(
  url: string,
  init: RequestInit,
  options?: GmailApiRequestOptions,
): Promise<Response> {
  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? GMAIL_FETCH_TIMEOUT_MS;

  return fetchFn(url, {
    ...init,
    signal: init.signal ?? createGmailFetchAbortSignal(timeoutMs),
  });
}

function assertOk(response: Response): void {
  if (response.status === 401) {
    throw new GmailAuthError("unauthorized", "Gmail rejected the access token (401).");
  }
  if (response.status === 403) {
    throw new GmailAuthError("forbidden", "Gmail returned forbidden (403).");
  }
}

export async function listInboxThreads(
  accessToken: string,
  args: { maxResults: number; labelIds: string[] },
  options?: GmailApiRequestOptions,
) {
  const params = new URLSearchParams();
  params.set("maxResults", String(args.maxResults));
  for (const labelId of args.labelIds) {
    params.append("labelIds", labelId);
  }

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads?${params.toString()}`;
  const response = await gmailFetch(
    url,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
    options,
  );

  assertOk(response);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`threads.list failed (${response.status}): ${text}`);
  }

  return (await response.json()) as ThreadListResponse;
}

export async function getThreadFull(
  accessToken: string,
  threadId: string,
  options?: GmailApiRequestOptions,
) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=full`;
  const response = await gmailFetch(
    url,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
    options,
  );

  assertOk(response);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`threads.get failed (${response.status}): ${text}`);
  }

  return (await response.json()) as GmailThreadResource;
}

export function getHeaderValue(
  headers: { name: string; value: string }[] | undefined,
  name: string,
): string | null {
  if (!headers) return null;
  const found = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  const v = found?.value?.trim();
  return v || null;
}

export async function getMessageMetadata(accessToken: string, providerMessageId: string): Promise<GmailMessageResource> {
  const params = new URLSearchParams();
  params.set("format", "metadata");
  params.append("metadataHeaders", "Message-ID");

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(
    providerMessageId,
  )}?${params.toString()}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  assertOk(response);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`messages.get failed (${response.status}): ${text}`);
  }

  return (await response.json()) as GmailMessageResource;
}

export async function createGmailDraft(args: {
  accessToken: string;
  gmailThreadId: string;
  rawRfc822: string;
}): Promise<{ id: string }> {
  const url = "https://gmail.googleapis.com/gmail/v1/users/me/drafts";
  const raw = Buffer.from(args.rawRfc822, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        threadId: args.gmailThreadId,
        raw,
      },
    }),
    cache: "no-store",
  });

  assertOk(response);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`drafts.create failed (${response.status}): ${text}`);
  }

  const body = (await response.json()) as { id?: string };
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    throw new Error("drafts.create succeeded but draft id missing.");
  }
  return { id };
}
