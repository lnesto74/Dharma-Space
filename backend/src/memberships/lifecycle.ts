/**
 * Membership lifecycle and session-ledger rules.
 *
 * Pure functions only — no Prisma, no Express. These are the rules the admin
 * API orchestrates, kept separate so they can be reasoned about and tested
 * without a database.
 */

import {
  CANCELLATION_NOTICE_DAYS,
  MAX_FREEZE_MONTHS_PER_YEAR,
  MINIMUM_TERM_MONTHS
} from "./tiers.js";

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  const targetDay = next.getDate();
  next.setMonth(next.getMonth() + months);
  // Clamp when the target month is shorter (e.g. Jan 31 + 1 month → Feb 28).
  if (next.getDate() < targetDay) next.setDate(0);
  return next;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

export type NewMembershipDates = {
  startedAt: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  minimumTermEndsAt: Date;
  rateHeldUntil: Date | null;
};

export function newMembershipDates(
  startedAt: Date,
  rateHeldMonths: number | null
): NewMembershipDates {
  return {
    startedAt,
    currentPeriodStart: startedAt,
    currentPeriodEnd: addMonths(startedAt, 1),
    minimumTermEndsAt: addMonths(startedAt, MINIMUM_TERM_MONTHS),
    rateHeldUntil: rateHeldMonths ? addMonths(startedAt, rateHeldMonths) : null
  };
}

/**
 * Cancellation requires 14 days' notice. Access continues to the end of the
 * current period, and never ends before the notice period or the minimum term.
 */
export function cancellationEffectiveAt(
  requestedAt: Date,
  currentPeriodEnd: Date,
  minimumTermEndsAt: Date
): Date {
  const noticeEnds = addDays(requestedAt, CANCELLATION_NOTICE_DAYS);
  return new Date(
    Math.max(
      currentPeriodEnd.getTime(),
      noticeEnds.getTime(),
      minimumTermEndsAt.getTime()
    )
  );
}

export type FreezeCheck = { ok: true; monthsUsedAfter: number } | { ok: false; reason: string };

/** Freeze is limited to 2 months per calendar year. */
export function canFreeze(
  months: number,
  freezeMonthsUsedYear: number,
  freezeYear: number | null,
  now: Date
): FreezeCheck {
  if (months < 1) return { ok: false, reason: "Freeze must be at least 1 month." };
  const year = now.getFullYear();
  const usedThisYear = freezeYear === year ? freezeMonthsUsedYear : 0;
  const after = usedThisYear + months;
  if (after > MAX_FREEZE_MONTHS_PER_YEAR) {
    return {
      ok: false,
      reason: `Freeze limit reached — ${MAX_FREEZE_MONTHS_PER_YEAR} months per calendar year (${usedThisYear} already used in ${year}).`
    };
  }
  return { ok: true, monthsUsedAfter: after };
}

/** A frozen, cancelled or payment-failed membership cannot book. */
export function canBook(status: string): boolean {
  return status === "ACTIVE" || status === "PENDING_CANCEL";
}

export type PeriodLedger = {
  sessionsIncluded: number | null;
  sessionsUsed: number;
  sessionsRolledIn: number;
};

/** Unlimited tiers return null; otherwise included + rolled-in minus used. */
export function sessionsRemaining(period: PeriodLedger): number | null {
  if (period.sessionsIncluded === null) return null;
  return Math.max(
    0,
    period.sessionsIncluded + period.sessionsRolledIn - period.sessionsUsed
  );
}

/**
 * Unused sessions roll forward exactly one month — they do not stack.
 * Only this period's own allowance rolls out; anything rolled in that went
 * unused expires.
 */
export function sessionsRollingOut(period: PeriodLedger): number {
  if (period.sessionsIncluded === null) return 0;
  const usedAgainstOwn = Math.max(0, period.sessionsUsed - period.sessionsRolledIn);
  return Math.max(0, period.sessionsIncluded - usedAgainstOwn);
}

export type SpendPlan =
  | { ok: true; fromRolledIn: number; fromCurrent: number }
  | { ok: false; reason: string };

/**
 * Spend order: rolled-in sessions first, because they expire sooner.
 * Never silently overdraws — an exhausted allowance returns ok:false so the
 * caller can offer the member drop-in rate or credits instead.
 */
export function planSessionSpend(period: PeriodLedger, count = 1): SpendPlan {
  if (period.sessionsIncluded === null) {
    return { ok: true, fromRolledIn: 0, fromCurrent: 0 };
  }
  const remaining = sessionsRemaining(period) ?? 0;
  if (count > remaining) {
    return {
      ok: false,
      reason: "No included sessions left this period — offer the member drop-in rate or credits."
    };
  }
  const rolledInLeft = Math.max(0, period.sessionsRolledIn - Math.min(period.sessionsUsed, period.sessionsRolledIn));
  const fromRolledIn = Math.min(count, rolledInLeft);
  return { ok: true, fromRolledIn, fromCurrent: count - fromRolledIn };
}

/** Effective monthly price, honouring a held rate such as Founding 50's $199. */
export function effectivePriceCents(
  tierMonthlyPriceCents: number,
  priceCentsOverride: number | null,
  rateHeldUntil: Date | null,
  now: Date
): number {
  if (priceCentsOverride === null) return tierMonthlyPriceCents;
  if (rateHeldUntil && now.getTime() > rateHeldUntil.getTime()) {
    // The held rate has lapsed — roll to the standard tier price.
    return tierMonthlyPriceCents;
  }
  return priceCentsOverride;
}
