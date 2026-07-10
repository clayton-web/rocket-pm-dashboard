import { UPCOMING_MOVE_IN_DAYS, todayDateString } from "@/lib/leasing/onboarding-progress";

/** Calendar-date (YYYY-MM-DD) comparison helpers for Operations classification. */

export function isDateOverdue(date: string | null | undefined, today = todayDateString()): boolean {
  if (!date) return false;
  const day = date.slice(0, 10);
  return day < today;
}

export function isDateWithinUpcomingWindow(
  date: string | null | undefined,
  opts?: { today?: string; windowDays?: number },
): boolean {
  if (!date) return false;
  const today = opts?.today ?? todayDateString();
  const windowDays = opts?.windowDays ?? UPCOMING_MOVE_IN_DAYS;
  const day = date.slice(0, 10);
  if (day < today) return false;

  const moveIn = new Date(`${day}T12:00:00.000Z`);
  const todayDate = new Date(`${today}T12:00:00.000Z`);
  const diffDays = Math.floor((moveIn.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000));
  return diffDays >= 0 && diffDays <= windowDays;
}

export function isDateTimeOverdue(
  iso: string | null | undefined,
  reference = new Date(),
): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < reference.getTime();
}

export function isDateTimeWithinUpcomingWindow(
  iso: string | null | undefined,
  opts?: { reference?: Date; windowDays?: number },
): boolean {
  if (!iso) return false;
  const reference = opts?.reference ?? new Date();
  const windowDays = opts?.windowDays ?? UPCOMING_MOVE_IN_DAYS;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  if (d.getTime() < reference.getTime()) return false;
  const diffMs = d.getTime() - reference.getTime();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  return diffDays <= windowDays;
}
