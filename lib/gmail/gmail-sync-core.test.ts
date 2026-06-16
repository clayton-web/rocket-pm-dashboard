import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  getSyncMaxThreads,
  getSyncMaxThreadsForTriggerSource,
  getSyncUserMaxThreads,
} from "@/lib/gmail/gmail-sync-core";

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

describe("getSyncUserMaxThreads", () => {
  const prev = process.env.GMAIL_SYNC_USER_MAX_THREADS;

  afterEach(() => {
    if (prev === undefined) delete process.env.GMAIL_SYNC_USER_MAX_THREADS;
    else process.env.GMAIL_SYNC_USER_MAX_THREADS = prev;
  });

  it("defaults to 5 when env is not set", () => {
    delete process.env.GMAIL_SYNC_USER_MAX_THREADS;
    assert.equal(getSyncUserMaxThreads(), 5);
  });

  it("respects env override within allowed bounds", () => {
    process.env.GMAIL_SYNC_USER_MAX_THREADS = "8";
    assert.equal(getSyncUserMaxThreads(), 8);
  });

  it("clamps env override to 1 through 100", () => {
    process.env.GMAIL_SYNC_USER_MAX_THREADS = "200";
    assert.equal(getSyncUserMaxThreads(), 100);

    process.env.GMAIL_SYNC_USER_MAX_THREADS = "0";
    assert.equal(getSyncUserMaxThreads(), 1);
  });
});

describe("getSyncMaxThreadsForTriggerSource", () => {
  const prevMax = process.env.GMAIL_SYNC_MAX_THREADS;
  const prevUser = process.env.GMAIL_SYNC_USER_MAX_THREADS;

  afterEach(() => {
    if (prevMax === undefined) delete process.env.GMAIL_SYNC_MAX_THREADS;
    else process.env.GMAIL_SYNC_MAX_THREADS = prevMax;
    if (prevUser === undefined) delete process.env.GMAIL_SYNC_USER_MAX_THREADS;
    else process.env.GMAIL_SYNC_USER_MAX_THREADS = prevUser;
  });

  it("uses user cap for USER-triggered jobs", () => {
    delete process.env.GMAIL_SYNC_USER_MAX_THREADS;
    delete process.env.GMAIL_SYNC_MAX_THREADS;
    assert.equal(getSyncMaxThreadsForTriggerSource("USER"), 5);
  });

  it("uses background cap for non-user trigger sources", () => {
    delete process.env.GMAIL_SYNC_MAX_THREADS;
    assert.equal(getSyncMaxThreadsForTriggerSource("CRON"), 15);
    assert.equal(getSyncMaxThreadsForTriggerSource("SYSTEM"), 15);
  });

  it("respects GMAIL_SYNC_USER_MAX_THREADS env override for USER jobs", () => {
    process.env.GMAIL_SYNC_USER_MAX_THREADS = "3";
    assert.equal(getSyncMaxThreadsForTriggerSource("USER"), 3);
  });
});
