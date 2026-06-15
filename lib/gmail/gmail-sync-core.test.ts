import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getSyncMaxThreads } from "@/lib/gmail/gmail-sync-core";

describe("getSyncMaxThreads", () => {
  const prev = process.env.GMAIL_SYNC_MAX_THREADS;

  afterEach(() => {
    if (prev === undefined) delete process.env.GMAIL_SYNC_MAX_THREADS;
    else process.env.GMAIL_SYNC_MAX_THREADS = prev;
  });

  it("defaults to 15 when env is not set", () => {
    delete process.env.GMAIL_SYNC_MAX_THREADS;
    assert.equal(getSyncMaxThreads(), 15);
  });

  it("respects env override within allowed bounds", () => {
    process.env.GMAIL_SYNC_MAX_THREADS = "25";
    assert.equal(getSyncMaxThreads(), 25);
  });

  it("clamps env override to 1 through 100", () => {
    process.env.GMAIL_SYNC_MAX_THREADS = "500";
    assert.equal(getSyncMaxThreads(), 100);

    process.env.GMAIL_SYNC_MAX_THREADS = "0";
    assert.equal(getSyncMaxThreads(), 1);
  });
});
