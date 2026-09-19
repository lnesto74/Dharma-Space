/**
 * How a class booking gets paid for.
 *
 * Pure functions — no Prisma, no Express. The booking route asks these what
 * should happen, then performs the writes.
 */

import {
  consumesIncludedSession,
  tierCoversCategory,
  type Category
} from "./tiers.js";
import { canBook, planSessionSpend, type PeriodLedger } from "./lifecycle.js";
import { chooseWallet, planCreditSpend, type WalletLedger } from "../credits/wallet.js";

/**
 * Credits are tried whenever a membership doesn't cover the class — including
 * when there is no membership at all. Returns null when nothing is spendable,
 * so the caller falls through to paying.
 */
function fromCredits(
  category: string,
  wallets: WalletLedger[],
  now: Date
): PaymentPlan | null {
  const wallet = chooseWallet(wallets, category, now);
  if (!wallet) return null;
  const spend = planCreditSpend(wallet, category, now);
  if (!spend.ok) return null;
  return {
    method: "CREDITS",
    walletId: wallet.id,
    creditsSpent: spend.credits,
    reason: spend.reason
  };
}

/**
 * Best-effort category for a class from its name, used to classify existing
 * classes that were created before categories existed. The studio can always
 * override it in admin.
 */
export function deriveCategory(classType: string): Category {
  const name = classType.toLowerCase();
  if (/aerial|hammock|silk/.test(name)) return "AERIAL";
  if (/sound|gong|bowl|handpan/.test(name)) return "SOUND";
  if (/dance|ecstatic|embodiment|movement/.test(name)) return "DANCE";
  if (/meditation|mindfulness|breathwork|pranayama/.test(name)) return "MEDITATION";
  return "YOGA";
}

export type MembershipContext = {
  membershipId: string;
  status: string;
  allowedCategories: string;
  period: (PeriodLedger & { id: string }) | null;
};

export type PaymentPlan =
  /** Covered and free on every tier (meditation) — no session drawn. */
  | { method: "MEMBERSHIP"; membershipId: string; periodId: string | null; sessionsSpent: 0; reason: string }
  /** Covered, and one included session is drawn from the period. */
  | { method: "MEMBERSHIP"; membershipId: string; periodId: string; sessionsSpent: 1; reason: string }
  /** Paid from a prepaid credit pack, which may be shared with other people. */
  | { method: "CREDITS"; walletId: string; creditsSpent: number; reason: string }
  /** Not covered, allowance exhausted, or no membership — pay as normal. */
  | { method: "DROP_IN"; reason: string };

/**
 * Decides how a class booking is paid for. Never silently overdraws: when the
 * allowance is gone the member falls back to paying, with the reason surfaced
 * so the UI can explain it.
 */
export function resolvePaymentPlan(
  category: string,
  membership: MembershipContext | null,
  wallets: WalletLedger[] = [],
  now = new Date()
): PaymentPlan {
  if (!membership) {
    return fromCredits(category, wallets, now) ?? { method: "DROP_IN", reason: "No membership — walk-up rate." };
  }
  if (!canBook(membership.status)) {
    return (
      fromCredits(category, wallets, now) ?? {
        method: "DROP_IN",
        reason: `Membership is ${membership.status.replace(/_/g, " ").toLowerCase()} — cannot book on the plan.`
      }
    );
  }
  if (!tierCoversCategory(membership.allowedCategories, category)) {
    return (
      fromCredits(category, wallets, now) ?? {
        method: "DROP_IN",
        reason: "This plan doesn't cover that class type — member rate applies."
      }
    );
  }

  // Meditation is free on every tier and never consumes an included session.
  if (!consumesIncludedSession(category)) {
    return {
      method: "MEMBERSHIP",
      membershipId: membership.membershipId,
      periodId: membership.period?.id ?? null,
      sessionsSpent: 0,
      reason: "Meditation is free on every plan."
    };
  }

  // Unlimited tiers have no period counting.
  if (membership.period === null || membership.period.sessionsIncluded === null) {
    return {
      method: "MEMBERSHIP",
      membershipId: membership.membershipId,
      periodId: membership.period?.id ?? null,
      sessionsSpent: 0,
      reason: "Unlimited plan."
    };
  }

  // Allowance is gone for the month — credits are the next best thing before
  // asking them to pay again.
  const spend = planSessionSpend(membership.period, 1);
  if (!spend.ok) {
    return fromCredits(category, wallets, now) ?? { method: "DROP_IN", reason: spend.reason };
  }

  return {
    method: "MEMBERSHIP",
    membershipId: membership.membershipId,
    periodId: membership.period.id,
    sessionsSpent: 1,
    reason: "Included in the plan."
  };
}
