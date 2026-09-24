/**
 * Server-owned enhancement contract. Never accept a user-supplied prompt.
 *
 * Official Image API edits are still generative. This wording is conservative on purpose:
 * photographic correction only, no staging, renovation, or invented property features.
 */
export const PHOTO_ENHANCER_PROMPT = [
  "Enhance this exact real-estate photograph. Return a natural, professionally finished version of the same property, not a reimagined or generated listing.",
  "Allowed adjustments only: exposure, brightness, white balance, colour accuracy, contrast, highlights, shadows, sharpness, clarity, apparent photographic quality, perspective, vertical alignment, and minor lens-distortion correction.",
  "Preserve the factual contents of the property. Do not add, remove, replace, or move objects or furniture. Do not stage the room. Do not renovate or alter surfaces, finishes, paint, flooring, countertops, cabinetry, fixtures, appliances, architecture, room dimensions, window views, or landscaping. Do not invent features or otherwise materially misrepresent the property.",
  "Keep the same framing, layout, materials, and contents. The result must remain a truthful photograph of this property.",
].join(" ");
