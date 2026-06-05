/** When false (default), rental ad assistant UI and actions are disabled. */
export function isRentalAdAssistantEnabled(): boolean {
  const raw = process.env.RENTAL_AD_ASSISTANT_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}
