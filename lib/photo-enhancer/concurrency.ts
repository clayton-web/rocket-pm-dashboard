import { PHOTO_ENHANCER_MAX_CONCURRENCY } from "./image-limits";

export type PhotoJobStatus = "waiting" | "enhancing" | "complete" | "failed";

export const PHOTO_JOB_STATUS_LABEL: Record<PhotoJobStatus, string> = {
  waiting: "Waiting",
  enhancing: "Enhancing",
  complete: "Complete",
  failed: "Failed",
};

export function claimNextWaitingIndexes(
  statuses: readonly PhotoJobStatus[],
  maxConcurrency = PHOTO_ENHANCER_MAX_CONCURRENCY,
): number[] {
  const inFlight = statuses.reduce((count, status) => count + (status === "enhancing" ? 1 : 0), 0);
  const slots = Math.max(0, maxConcurrency - inFlight);
  if (slots === 0) return [];

  const next: number[] = [];
  for (let index = 0; index < statuses.length && next.length < slots; index += 1) {
    if (statuses[index] === "waiting") next.push(index);
  }
  return next;
}

/**
 * Worker pool: at most `concurrency` process() calls in flight.
 * claimNext is synchronous so tests can prove the cap and queue advance.
 * A rejected process() does not stop other items.
 */
export async function processPhotoQueue(options: {
  claimNext: () => string | null;
  process: (id: string) => Promise<void>;
  concurrency?: number;
}): Promise<void> {
  const concurrency = options.concurrency ?? PHOTO_ENHANCER_MAX_CONCURRENCY;
  if (concurrency < 1) return;

  const worker = async () => {
    for (;;) {
      const id = options.claimNext();
      if (!id) return;
      try {
        await options.process(id);
      } catch {
        // Isolation: the item owner records failure; the pool keeps draining.
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}
