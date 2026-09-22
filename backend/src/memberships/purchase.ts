/**
 * Buying a membership on the website.
 *
 * Unlike a credit pack, a membership is a standing arrangement: it has to bill
 * itself every month without anyone being asked again. That rules PayNow out —
 * it can only ever be a one-off push payment — so this path is card-only and
 * runs on a Stripe subscription. PayNow stays available for drop-ins and packs,
 * where a single payment is the whole story.
 *
 * Nothing is created up front except a pending Payment. The membership itself
 * is only born once Stripe says the first month is paid, which keeps an
 * abandoned checkout from leaving a member apparently on a plan they never
 * bought. The pending Payment is the thing the settlement is idempotent
 * against, so a webhook and a browser returning from Stripe at the same moment
 * still produce exactly one membership.
 */

import { randomBytes } from "crypto";
import type { PrismaClient, SiteMember } from "@prisma/client";
import { canJoinTier, startMembership } from "./signup.js";
import { formatCents } from "../payments/money.js";
import { openPayment } from "../payments/ledger.js";

/** Marks a Stripe session as starting a membership rather than paying for a booking. */
export const MEMBERSHIP_PURCHASE = "MEMBERSHIP";

export function membershipReference() {
  return `MEM-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/**
 * The plans as the website shows them — price, what's included, and whether
 * there are still places left on a capped plan.
 */
export async function listTiersForSale(prisma: PrismaClient) {
  const tiers = await prisma.membershipTier.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" }
  });

  const capped = tiers.filter((t) => t.maxMembers !== null);
  const taken = new Map<string, number>();
  if (capped.length) {
    const counts = await prisma.membership.groupBy({
      by: ["tierId"],
      where: { tierId: { in: capped.map((t) => t.id) }, status: { not: "CANCELLED" } },
      _count: { _all: true }
    });
    for (const row of counts) taken.set(row.tierId, row._count._all);
  }

  return tiers.map((tier) => {
    const used = taken.get(tier.id) ?? 0;
    const placesLeft = tier.maxMembers === null ? null : Math.max(0, tier.maxMembers - used);
    return {
      id: tier.id,
      name: tier.name,
      tierGroup: tier.tierGroup,
      monthlyPriceCents: tier.monthlyPriceCents,
      monthlyPrice: formatCents(tier.monthlyPriceCents),
      includedSessionsPerMonth: tier.includedSessionsPerMonth,
      allowedCategories: tier.allowedCategories,
      guestPassesPerMonth: tier.guestPassesPerMonth,
      rateHeldMonths: tier.rateHeldMonths,
      maxMembers: tier.maxMembers,
      // A one-off pass rather than a plan that renews.
      termDays: tier.termDays,
      introOnly: tier.introOnly,
      notes: tier.notes,
      placesLeft,
      soldOut: placesLeft === 0
    };
  });
}

export type StartedMembershipPurchase = {
  reference: string;
  amountCents: number;
  tier: {
    id: string;
    name: string;
    monthlyPriceCents: number;
    rateHeldMonths: number | null;
    termDays: number | null;
  };
};

/**
 * Opens the pending payment for a membership signup. Throws with an HTTP status
 * when the plan can't be joined, so the route can pass the reason straight on.
 */
export async function startMembershipPurchase(
  prisma: PrismaClient,
  member: SiteMember,
  input: { tierId: string }
): Promise<StartedMembershipPurchase> {
  const tier = await prisma.membershipTier.findUnique({ where: { id: input.tierId } });
  if (!tier) {
    throw Object.assign(new Error("That plan is not on sale."), { status: 404 });
  }

  const check = await canJoinTier(prisma, member.id, tier);
  if (!check.ok) {
    throw Object.assign(new Error(check.message), { status: check.status });
  }

  const reference = membershipReference();
  await openPayment(prisma, {
    bookingId: null,
    kind: "MEMBERSHIP",
    memberId: member.id,
    reference,
    provider: "STRIPE",
    method: "CARD",
    amountCents: tier.monthlyPriceCents
  });

  return {
    reference,
    amountCents: tier.monthlyPriceCents,
    tier: {
      id: tier.id,
      name: tier.name,
      monthlyPriceCents: tier.monthlyPriceCents,
      rateHeldMonths: tier.rateHeldMonths,
      termDays: tier.termDays
    }
  };
}

export async function attachCheckoutUrl(prisma: PrismaClient, reference: string, url: string) {
  await prisma.payment.updateMany({
    where: { reference, kind: "MEMBERSHIP" },
    data: { checkoutUrl: url }
  });
}

export type CompletedMembershipPurchase = {
  membershipId: string;
  tierName: string;
  termDays: number | null;
  alreadyStarted: boolean;
};

/**
 * Settles the first month and starts the membership. Safe to call more than
 * once: the pending payment is claimed with a guarded update, and whoever loses
 * the race finds the membership already there.
 */
export async function completeMembershipPurchase(
  prisma: PrismaClient,
  reference: string,
  opts: {
    tierId?: string | null;
    providerRef?: string | null;
    providerPaymentRef?: string | null;
    subscriptionId?: string | null;
  } = {}
): Promise<CompletedMembershipPurchase | null> {
  const payment = await prisma.payment.findFirst({
    where: { reference, kind: "MEMBERSHIP" },
    include: { member: true }
  });
  if (!payment || !payment.member) return null;

  const existing = await prisma.membership.findFirst({
    where: { memberId: payment.memberId ?? "", status: { notIn: ["CANCELLED"] } },
    include: { tier: true }
  });
  if (existing) {
    return {
      membershipId: existing.id,
      tierName: existing.tier?.name ?? "your plan",
      termDays: existing.tier?.termDays ?? null,
      alreadyStarted: true
    };
  }

  const tierId = opts.tierId || null;
  const tier = tierId ? await prisma.membershipTier.findUnique({ where: { id: tierId } }) : null;
  if (!tier) return null;

  // Whoever flips the payment out of PENDING owns the signup; a second caller
  // reads zero rows here and leaves the membership alone.
  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: "PENDING" },
    data: {
      status: "PAID",
      paidAt: new Date(),
      ...(opts.providerRef ? { providerRef: opts.providerRef } : {}),
      ...(opts.providerPaymentRef ? { providerPaymentRef: opts.providerPaymentRef } : {})
    }
  });
  if (claimed.count === 0) {
    const raced = await prisma.membership.findFirst({
      where: { memberId: payment.memberId ?? "", status: { notIn: ["CANCELLED"] } },
      include: { tier: true }
    });
    return raced
      ? {
          membershipId: raced.id,
          tierName: raced.tier?.name ?? tier.name,
          termDays: raced.tier?.termDays ?? null,
          alreadyStarted: true
        }
      : null;
  }

  const membership = await startMembership(prisma, {
    member: payment.member,
    tier,
    // The subscription will keep billing the amount it was created with, so the
    // membership holds that same figure rather than drifting from the card.
    priceCentsOverride: payment.amountCents,
    notes: `Joined online · ${reference}`,
    stripeSubscriptionId: opts.subscriptionId ?? null
  });

  return {
    membershipId: membership.id,
    tierName: tier.name,
    termDays: tier.termDays,
    alreadyStarted: false
  };
}

/** Checkout abandoned or card declined — nothing was created, so just close the payment off. */
export async function voidMembershipPurchase(
  prisma: PrismaClient,
  reference: string,
  reason: "FAILED" | "CANCELLED"
) {
  await prisma.payment.updateMany({
    where: { reference, kind: "MEMBERSHIP", status: "PENDING" },
    data: {
      status: reason,
      failureReason: reason === "FAILED" ? "Card declined at Stripe." : null
    }
  });
}

/**
 * A renewal invoice. Recorded as its own payment so a year on the plan reads as
 * twelve months of revenue rather than one.
 */
export async function recordRenewalPayment(
  prisma: PrismaClient,
  membershipId: string,
  input: { memberId: string | null; amountCents: number; invoiceId: string }
) {
  await openPayment(prisma, {
    bookingId: null,
    kind: "MEMBERSHIP",
    memberId: input.memberId,
    reference: `MEM-RENEW-${input.invoiceId.slice(-10).toUpperCase()}`,
    provider: "STRIPE",
    method: "CARD",
    amountCents: input.amountCents,
    providerRef: membershipId,
    paid: true
  });
}
