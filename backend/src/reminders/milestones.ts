/**
 * Which warning, if any, is due for something that expires on a given date.
 *
 * Pure so the awkward cases can be reasoned about without a database: a pack
 * bought before this feature existed, a member who joins with six weeks left,
 * a sweep that runs twice in a day.
 */

/** Months of notice we give, most relaxed first. */
export const MILESTONES = [3, 2, 1] as const;

export type Milestone = (typeof MILESTONES)[number];

export function addMonths(date: Date, months: number): Date {
  const out = new Date(date);
  const day = out.getDate();
  out.setMonth(out.getMonth() + months);
  // Clamp 31 Jan + 1 month to 28/29 Feb rather than letting it roll into March.
  if (out.getDate() < day) out.setDate(0);
  return out;
}

/**
 * The most urgent milestone that applies right now, or null if the date is
 * further off than our longest warning (or already gone).
 *
 * "Most urgent" rather than "every one that applies" is the important part.
 * Something with six weeks left technically sits inside both the three-month
 * and two-month windows, but the three-month warning is simply late — sending
 * it now would be a lie, and sending both would be spam. We send the two-month
 * one and the three-month one never fires, which is correct: time only moves
 * forward, so a window that has closed can never reopen.
 */
export function dueMilestone(expiresAt: Date, now: Date): Milestone | null {
  if (expiresAt <= now) return null;
  for (const months of [...MILESTONES].sort((a, b) => a - b)) {
    if (expiresAt <= addMonths(now, months)) return months as Milestone;
  }
  return null;
}

/**
 * The milestone to send, given those already sent for this thing. Returns null
 * when the current window has already been warned about, which is the normal
 * answer on all but a handful of days in a pack's life.
 */
export function nextMilestone(
  expiresAt: Date,
  now: Date,
  alreadySent: readonly number[]
): Milestone | null {
  const due = dueMilestone(expiresAt, now);
  if (due === null) return null;
  return alreadySent.includes(due) ? null : due;
}

/** Rough months left, for copy like "two months to go". */
export function monthsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}
