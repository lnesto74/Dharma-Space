/**
 * Credit wallet rules — pure functions, no Prisma and no Express.
 *
 * The booking route asks these what should happen, then performs the writes.
 */

import { CREDIT_VALID_MONTHS, creditCost, isCreditEligible } from "./packs.js";

export const WALLET_STATUSES = ["ACTIVE", "EXPIRED", "CANCELLED"] as const;
export type WalletStatus = (typeof WALLET_STATUSES)[number];

export type WalletLedger = {
  id: string;
  creditsTotal: number;
  creditsUsed: number;
  expiresAt: Date;
  status: string;
};

/** Same month arithmetic as memberships — clamps when the day doesn't exist. */
export function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  const targetDay = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() < targetDay) next.setDate(0);
  return next;
}

export function walletExpiryFrom(purchasedAt: Date): Date {
  return addMonths(purchasedAt, CREDIT_VALID_MONTHS);
}

export function creditsRemaining(wallet: WalletLedger): number {
  return Math.max(0, wallet.creditsTotal - wallet.creditsUsed);
}

export function isExpired(wallet: WalletLedger, now = new Date()): boolean {
  return wallet.expiresAt.getTime() <= now.getTime();
}

export function isSpendable(wallet: WalletLedger, now = new Date()): boolean {
  return wallet.status === "ACTIVE" && !isExpired(wallet, now) && creditsRemaining(wallet) > 0;
}

export type CreditSpend =
  | { ok: true; credits: number; reason: string }
  | { ok: false; reason: string };

/**
 * Decides whether a wallet can cover one place in a class. Never overdraws:
 * a partial balance falls back to paying rather than going negative.
 */
export function planCreditSpend(
  wallet: WalletLedger,
  category: string,
  now = new Date()
): CreditSpend {
  if (!isCreditEligible(category)) {
    return { ok: false, reason: "Credits can't be used for workshops or trainings." };
  }
  if (wallet.status !== "ACTIVE") {
    return { ok: false, reason: `Credit pack is ${wallet.status.toLowerCase()}.` };
  }
  if (isExpired(wallet, now)) {
    return { ok: false, reason: "Credit pack has expired." };
  }

  const cost = creditCost(category);
  if (cost === 0) {
    return { ok: true, credits: 0, reason: "Meditation is free with a credit pack." };
  }

  const remaining = creditsRemaining(wallet);
  if (remaining < cost) {
    return {
      ok: false,
      reason:
        remaining === 0
          ? "No credits left in the pack."
          : `Needs ${cost} credits, only ${remaining} left.`
    };
  }

  return { ok: true, credits: cost, reason: `${cost} credits from the pack.` };
}

/**
 * Picks which wallet to spend from when someone can draw on more than one:
 * soonest to expire first, so credits are used before they lapse. Ties break
 * on the smaller balance to finish off nearly-empty packs.
 */
export function chooseWallet<T extends WalletLedger>(
  wallets: T[],
  category: string,
  now = new Date()
): T | null {
  const usable = wallets
    .filter((w) => planCreditSpend(w, category, now).ok)
    .sort((a, b) => {
      const byExpiry = a.expiresAt.getTime() - b.expiresAt.getTime();
      if (byExpiry !== 0) return byExpiry;
      return creditsRemaining(a) - creditsRemaining(b);
    });
  return usable[0] ?? null;
}
