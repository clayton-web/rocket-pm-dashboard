import { GmailAuthError } from "@/lib/gmail/gmail-errors";

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

function assertOk(response: Response): void {
  if (response.status === 401) {
    throw new GmailAuthError("unauthorized", "Gmail rejected the access token (401).");
  }
  if (response.status === 403) {
    throw new GmailAuthError("forbidden", "Gmail returned forbidden (403).");
  }
}

export async function listInboxThreads(accessToken: string, args: { maxResults: number; labelIds: string[] }) {
  const params = new URLSearchParams();
  params.set("maxResults", String(args.maxResults));
  for (const labelId of args.labelIds) {
    params.append("labelIds", labelId);
  }

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads?${params.toString()}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  assertOk(response);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`threads.list failed (${response.status}): ${text}`);
  }

  return (await response.json()) as ThreadListResponse;
}

export async function getThreadFull(accessToken: string, threadId: string) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=full`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  assertOk(response);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`threads.get failed (${response.status}): ${text}`);
  }

  return (await response.json()) as GmailThreadResource;
}
