import {
  isShowingCloseOutChoice,
  type ShowingCloseOutChoice,
} from "@/lib/leasing/showing-close-out";

export type ScheduleShowingFormInput = {
  scheduledStart: Date;
  scheduledEnd: Date | null;
  assignedToUserId: string | null;
  notes: string | null;
};

export type CloseOutShowingFormInput = {
  choice: ShowingCloseOutChoice;
  notes: string | null;
};

function parseOptionalString(
  value: unknown,
  field: string,
  maxLen: number,
): string | null | { error: string } {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return { error: `Invalid ${field}` };
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) return { error: `${field} is too long` };
  return trimmed;
}

function parseOptionalUserId(value: unknown): string | null | { error: string } {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return { error: "Invalid assignee" };
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

function parseDateTimeLocal(value: unknown, field: string): Date | { error: string } {
  if (typeof value !== "string") return { error: `${field} is required` };
  const trimmed = value.trim();
  if (!trimmed) return { error: `${field} is required` };
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return { error: `Invalid ${field}` };
  return d;
}

export function parseScheduleShowingFormInput(
  body: unknown,
): ScheduleShowingFormInput | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid form data" };
  }
  const raw = body as Record<string, unknown>;

  const scheduledStart = parseDateTimeLocal(raw.scheduledStart, "Scheduled start");
  if ("error" in scheduledStart) {
    return scheduledStart;
  }

  let scheduledEnd: Date | null = null;
  if (raw.scheduledEnd !== undefined && raw.scheduledEnd !== null && raw.scheduledEnd !== "") {
    const end = parseDateTimeLocal(raw.scheduledEnd, "Scheduled end");
    if ("error" in end) return end;
    scheduledEnd = end;
    if (scheduledEnd.getTime() < scheduledStart.getTime()) {
      return { error: "Scheduled end must be after scheduled start" };
    }
  }

  const assignedToUserId = parseOptionalUserId(raw.assignedToUserId);
  if (typeof assignedToUserId === "object" && assignedToUserId !== null && "error" in assignedToUserId) {
    return assignedToUserId;
  }

  const notes = parseOptionalString(raw.notes, "Notes", 4000);
  if (typeof notes === "object" && notes !== null && "error" in notes) {
    return notes;
  }

  return {
    scheduledStart,
    scheduledEnd,
    assignedToUserId,
    notes,
  };
}

export function parseCloseOutShowingFormInput(
  body: unknown,
): CloseOutShowingFormInput | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid form data" };
  }
  const raw = body as Record<string, unknown>;
  if (typeof raw.choice !== "string" || !isShowingCloseOutChoice(raw.choice)) {
    return { error: "Please select a close-out result" };
  }

  const notes = parseOptionalString(raw.notes, "Notes", 4000);
  if (typeof notes === "object" && notes !== null && "error" in notes) {
    return notes;
  }

  return {
    choice: raw.choice,
    notes,
  };
}
