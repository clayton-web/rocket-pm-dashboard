import type { RentalAdAssistantOutput } from "@/lib/validation/rental-ad-assistant";
import { scanListingCopyForReview } from "./scan-listing-copy";

/** Recomputes reviewFlags from ad copy fields before persisting draft output. */
export function finalizeRentalAdAssistantOutput(
  output: RentalAdAssistantOutput,
): RentalAdAssistantOutput {
  const reviewFlags = scanListingCopyForReview({
    headline: output.headline,
    fullDescription: output.fullDescription,
    shortDescription: output.shortDescription,
  });

  if (reviewFlags.length === 0) {
    const rest = { ...output };
    delete rest.reviewFlags;
    return rest;
  }

  return {
    ...output,
    reviewFlags,
  };
}
