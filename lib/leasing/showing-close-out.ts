import type { ShowingOutcome, ShowingStatus } from "@prisma/client";

export const SHOWING_CLOSE_OUT_CHOICES = [
  "completed_interested",
  "completed_not_interested",
  "no_show",
  "cancelled",
  "reschedule_requested",
] as const;

export type ShowingCloseOutChoice = (typeof SHOWING_CLOSE_OUT_CHOICES)[number];

const CLOSE_OUT_CHOICE_SET = new Set<string>(SHOWING_CLOSE_OUT_CHOICES);

export function isShowingCloseOutChoice(value: string): value is ShowingCloseOutChoice {
  return CLOSE_OUT_CHOICE_SET.has(value);
}

export function formatShowingCloseOutChoice(choice: ShowingCloseOutChoice): string {
  switch (choice) {
    case "completed_interested":
      return "Completed · Interested";
    case "completed_not_interested":
      return "Completed · Not interested";
    case "no_show":
      return "No-show";
    case "cancelled":
      return "Cancelled";
    case "reschedule_requested":
      return "Reschedule requested";
    default:
      return choice;
  }
}

export function mapCloseOutChoiceToEnums(choice: ShowingCloseOutChoice): {
  status: ShowingStatus;
  showingOutcome: ShowingOutcome | null;
} {
  switch (choice) {
    case "completed_interested":
      return { status: "completed", showingOutcome: "interested" };
    case "completed_not_interested":
      return { status: "completed", showingOutcome: "not_interested" };
    case "no_show":
      return { status: "no_show", showingOutcome: "no_show" };
    case "cancelled":
      return { status: "cancelled", showingOutcome: null };
    case "reschedule_requested":
      return { status: "cancelled", showingOutcome: "reschedule" };
    default: {
      const _exhaustive: never = choice;
      return _exhaustive;
    }
  }
}

export function isShowingOpenForCloseOut(status: string): boolean {
  return status === "scheduled";
}
