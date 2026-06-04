export type DraftClassificationFlags = {
  reviewRequired: boolean;
};

export function parseDraftClassification(raw: unknown): DraftClassificationFlags {
  if (!raw || typeof raw !== "object") {
    return { reviewRequired: false };
  }
  const reviewRequired = (raw as { review_required?: unknown }).review_required === true;
  return { reviewRequired };
}
