import type { MarketRentResearchActionState } from "./types";

/** Client-safe initial state for useActionState — not a server action. */
export const marketRentResearchIdleState: MarketRentResearchActionState = {
  ok: true,
  status: "no_providers",
  message: "",
  completedAt: 0,
};
