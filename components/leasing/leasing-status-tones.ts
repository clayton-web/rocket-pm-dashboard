import type { StatusTone } from "@/components/portal/status-badge";
import type { OffboardingAttentionRow } from "@/lib/leasing/offboarding-attention-queue";
import type { OnboardingAttentionRow } from "@/lib/leasing/onboarding-attention-queue";

/**
 * Leasing's `attention kind -> tone` vocabulary.
 *
 * The maps live here rather than in `lib/leasing/*-attention-queue.ts` because those modules import
 * prisma and cannot be pulled into a client bundle, and rather than in the components because the
 * leasing dashboard and the onboarding command centre both render the same rows and previously
 * carried byte-identical copies of these maps.
 *
 * `StatusBadge` still owns `tone -> visual treatment`; nothing about leasing reaches the primitive.
 */

/**
 * Onboarding attention maps cleanly onto the shared tones: a move-in past its date is a failure, an
 * imminent one is informational, a tenancy whose portal is not ready needs action before move-in,
 * and a plain pending move-in is the routine baseline.
 */
export const ONBOARDING_ATTENTION_TONES: Record<OnboardingAttentionRow["kind"], StatusTone> = {
  overdue: "danger",
  upcoming: "info",
  portal_not_ready: "warning",
  pending: "neutral",
};

/**
 * Offboarding previously used four unrelated hues — amber, sky, violet, indigo — for four sequential
 * steps. Only the first two encoded anything: a notice awaiting review is time-sensitive, and a
 * notice awaiting scheduling is passive waiting.
 *
 * Violet and indigo were sequence markers, not meaning. They sat one hue apart, which no reader can
 * decode, and every row already states its step in the badge label. Both inspection stages are
 * therefore the routine neutral, leaving three tones that form an actual ladder — review needed,
 * awaiting, routine — instead of a rainbow.
 */
export const OFFBOARDING_ATTENTION_TONES: Record<OffboardingAttentionRow["kind"], StatusTone> = {
  pending_notice: "warning",
  awaiting_schedule: "info",
  awaiting_inspection_schedule: "neutral",
  awaiting_inspection_complete: "neutral",
};
