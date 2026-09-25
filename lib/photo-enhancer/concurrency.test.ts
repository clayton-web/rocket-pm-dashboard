import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  claimNextWaitingIndexes,
  processPhotoQueue,
  type PhotoJobStatus,
} from "./concurrency";
import { PHOTO_ENHANCER_MAX_CONCURRENCY } from "./image-limits";

describe("claimNextWaitingIndexes", () => {
  it("starts at most 3 waiting photos when none are in flight", () => {
    const statuses: PhotoJobStatus[] = [
      "waiting",
      "waiting",
      "waiting",
      "waiting",
      "complete",
    ];
    assert.equal(PHOTO_ENHANCER_MAX_CONCURRENCY, 3);
    assert.deepEqual(claimNextWaitingIndexes(statuses), [0, 1, 2]);
  });

  it("does not exceed 3 when some are already enhancing", () => {
    const statuses: PhotoJobStatus[] = [
      "enhancing",
      "enhancing",
      "waiting",
      "waiting",
    ];
    assert.deepEqual(claimNextWaitingIndexes(statuses), [2]);
  });

  it("returns no work when the pool is full", () => {
    const statuses: PhotoJobStatus[] = ["enhancing", "enhancing", "enhancing", "waiting"];
    assert.deepEqual(claimNextWaitingIndexes(statuses), []);
  });
});

describe("processPhotoQueue", () => {
  it("never runs more than 3 process calls at once and advances the queue", async () => {
    const ids = Array.from({ length: 8 }, (_, index) => `p${index}`);
    const waiting = [...ids];
    let inFlight = 0;
    let peak = 0;
    const started: string[] = [];
    const finished: string[] = [];

    await processPhotoQueue({
      concurrency: 3,
      claimNext: () => waiting.shift() ?? null,
      process: async (id) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        started.push(id);
        await new Promise((resolve) => setTimeout(resolve, 20));
        inFlight -= 1;
        finished.push(id);
      },
    });

    assert.equal(peak, 3);
    assert.deepEqual(started.slice(0, 3), ["p0", "p1", "p2"]);
    assert.deepEqual(finished.sort(), ids);
    assert.equal(waiting.length, 0);
  });

  it("continues the batch when one photo fails", async () => {
    const ids = ["a", "b", "c", "d", "e"];
    const waiting = [...ids];
    const results = new Map<string, "complete" | "failed">();

    await processPhotoQueue({
      concurrency: 3,
      claimNext: () => waiting.shift() ?? null,
      process: async (id) => {
        if (id === "d") {
          results.set(id, "failed");
          throw new Error("openai failed");
        }
        results.set(id, "complete");
      },
    });

    assert.equal(results.get("d"), "failed");
    assert.deepEqual(
      ids.filter((id) => id !== "d").map((id) => results.get(id)),
      ["complete", "complete", "complete", "complete"],
    );
  });

  it("can retry a single failed photo without reprocessing completed ones", async () => {
    const completed = new Set(["a", "b", "c"]);
    let processedRetry = 0;

    await processPhotoQueue({
      concurrency: 3,
      claimNext: (() => {
        let claimed = false;
        return () => {
          if (claimed) return null;
          claimed = true;
          return "d";
        };
      })(),
      process: async (id) => {
        assert.equal(id, "d");
        processedRetry += 1;
      },
    });

    assert.equal(processedRetry, 1);
    assert.deepEqual([...completed], ["a", "b", "c"]);
  });
});
