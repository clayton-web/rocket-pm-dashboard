import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GMAIL_FETCH_TIMEOUT_MS,
  createGmailFetchAbortSignal,
  getThreadFull,
  listInboxThreads,
  type GmailFetchFn,
} from "@/lib/gmail/gmail-api";

describe("createGmailFetchAbortSignal", () => {
  it("returns an active abort signal", () => {
    const signal = createGmailFetchAbortSignal(30_000);
    assert.equal(signal.aborted, false);
  });
});

describe("Gmail sync API fetch timeouts", () => {
  it("passes an abort signal to fetch for listInboxThreads", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchFn: GmailFetchFn = async (_url, init) => {
      capturedInit = init;
      return new Response(JSON.stringify({ threads: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    await listInboxThreads("token", { maxResults: 15, labelIds: ["INBOX"] }, { fetchFn });

    assert.ok(capturedInit?.signal);
    assert.equal(capturedInit.signal?.aborted, false);
  });

  it("passes an abort signal to fetch for getThreadFull", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchFn: GmailFetchFn = async (_url, init) => {
      capturedInit = init;
      return new Response(JSON.stringify({ id: "thread-1", messages: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    await getThreadFull("token", "thread-1", { fetchFn });

    assert.ok(capturedInit?.signal);
    assert.equal(capturedInit.signal?.aborted, false);
  });

  it("uses the default 30 second timeout budget", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchFn: GmailFetchFn = async (_url, init) => {
      capturedInit = init;
      return new Response(JSON.stringify({ threads: [] }), { status: 200 });
    };

    await listInboxThreads("token", { maxResults: 15, labelIds: ["INBOX"] }, { fetchFn });

    assert.equal(GMAIL_FETCH_TIMEOUT_MS, 30_000);
    assert.ok(capturedInit?.signal);
  });

  it("propagates timeout abort errors from fetch", async () => {
    const fetchFn: GmailFetchFn = async (_url, init) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error("missing abort signal"));
          return;
        }
        if (signal.aborted) {
          reject(signal.reason ?? new DOMException("The operation timed out.", "TimeoutError"));
          return;
        }
        signal.addEventListener("abort", () => {
          reject(signal.reason ?? new DOMException("The operation timed out.", "TimeoutError"));
        });
      });

    await assert.rejects(
      () =>
        listInboxThreads(
          "token",
          { maxResults: 15, labelIds: ["INBOX"] },
          { fetchFn, timeoutMs: 10 },
        ),
      (error: unknown) => error instanceof DOMException && error.name === "TimeoutError",
    );
  });
});
