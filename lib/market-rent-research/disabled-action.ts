import { MARKET_RENT_RESEARCH_DISABLED_MESSAGE } from "./constants";
import type { MarketRentResearchActionState } from "./types";

export function marketRentResearchDisabledActionState(): MarketRentResearchActionState {
  return {
    ok: false,
    error: MARKET_RENT_RESEARCH_DISABLED_MESSAGE,
    completedAt: Date.now(),
  };
}
