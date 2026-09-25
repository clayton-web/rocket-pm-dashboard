import { PHOTO_ENHANCER_MAX_BATCH } from "./image-limits";
import { validatePhotoEnhancerUpload } from "./validate-upload";

export type PhotoSelectionInput = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

export type PhotoBatchRejection = {
  index: number;
  error: string;
};

export type PhotoBatchSelection = {
  acceptedIndexes: number[];
  rejected: PhotoBatchRejection[];
  truncated: boolean;
  error: string | null;
};

export function selectPhotoEnhancerBatch(
  inputs: readonly PhotoSelectionInput[],
  maxBatch = PHOTO_ENHANCER_MAX_BATCH,
): PhotoBatchSelection {
  if (inputs.length === 0) {
    return {
      acceptedIndexes: [],
      rejected: [],
      truncated: false,
      error: "A photo file is required.",
    };
  }

  const acceptedIndexes: number[] = [];
  const rejected: PhotoBatchRejection[] = [];
  let extraValid = 0;

  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index];
    const check = validatePhotoEnhancerUpload({
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      enforceSize: false,
    });
    if (!check.ok) {
      rejected.push({ index, error: check.error });
      continue;
    }
    if (acceptedIndexes.length >= maxBatch) {
      extraValid += 1;
      continue;
    }
    acceptedIndexes.push(index);
  }

  const truncated = extraValid > 0;
  let error: string | null = null;
  if (acceptedIndexes.length === 0) {
    error = rejected[0]?.error ?? "A photo file is required.";
  } else if (rejected.length > 0 && truncated) {
    error = `Some files were skipped. Up to ${maxBatch} JPG, PNG, or WebP photos can be enhanced at once.`;
  } else if (rejected.length === 1) {
    error = rejected[0].error;
  } else if (rejected.length > 1) {
    error = `${rejected.length} files were skipped because they are not valid JPG, PNG, or WebP photos.`;
  } else if (truncated) {
    error = `Only the first ${maxBatch} photos were added.`;
  }

  return { acceptedIndexes, rejected, truncated, error };
}
