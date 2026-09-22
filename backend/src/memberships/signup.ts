/**
 * Starting a membership, wherever it is started from.
 *
 * Two doors lead here — the studio adding someone at the desk, and a member
 * paying on the website — and they must agree about the rules, because a
 * membership sold one way and a membership sold the other are the same thing
 * to everyone except the code. The capacity cap, the held rate, the first
 * period's allowance and the welcome email all live here so neither door can
 * quietly get them wrong.
 */

import type { MembershipTier, PrismaClient, SiteMember } from "@prisma/client";
import { newMembershipDates, sessionsRollingOut } from "./lifecycle.js";
import { sendMembershipWelcomeEmail } from "./emails.js";

export type JoinCheck = { ok: true } | { ok: false; status: number; message: string };

/**
 * Whether this person can start this plan right now. Separate from starting it
 * so the website can grey out a sold-out plan before anyone reaches payment.
 */
export async function canJoinTier(
  prisma: PrismaClient,
  memberId: string,
  tier: MembershipTier
): Promise<JoinCheck> {
  if (!tier.isActive) {
    return { ok: false, status: 409, message: `${tier.name} isn't on sale at the moment.` };
  }

  const existing = await prisma.membership.findFirst({
    where: { memberId, status: { notIn: ["CANCELLED"] } },
    include: { tier: true }
  });
  if (existing) {
    return {
      ok: false,
      status: 409,
      message: `You're already on ${existing.tier?.name || "a membership"}. Contact us to change plans.`
    };
  }

  // "New here" means new. Cancelled and lapsed plans count, otherwise the
  // week-long pass becomes a $59 rolling membership for anyone patient enough.
  if (tier.introOnly) {
    const everHeld = await prisma.membership.count({ where: { memberId } });
    if (everHeld > 0) {
      return {
        ok: false,
        status: 409,
        message: `${tier.name} is for a first visit only — you've been with us before. Have a look at the monthly plans.`
      };
    }
  }

  // Founding 50 and any other capped plan stops being sellable at its cap.
  if (tier.maxMembers !== null) {
    const used = await prisma.membership.count({
      where: { tierId: tier.id, status: { not: "CANCELLED" } }
    });
    if (used >= tier.maxMembers) {
      return {
        ok: false,
        status: 409,
        message: `${tier.name} is fully subscribed — all ${tier.maxMembers} places are taken.`
      };
    }
  }

  return { ok: true };
}

export type StartMembershipInput = {
  member: Pick<SiteMember, "id" | "name" | "email">;
  tier: MembershipTier;
  startedAt?: Date;
  /** Overrides the tier price; defaults to holding the rate on a rate-held tier. */
  priceCentsOverride?: number | null;
  notes?: string;
  /** True when the account was created for them, so the email explains signing in. */
  isNewAccount?: boolean;
  stripeSubscriptionId?: string | null;
};

/**
 * Creates the membership, its first period, and sends the welcome email.
 * The caller is responsible for having checked `canJoinTier` and, where money
 * is involved, for having collected it.
 */
export async function startMembership(prisma: PrismaClient, input: StartMembershipInput) {
  const { member, tier } = input;
  const startedAt = input.startedAt ?? new Date();
  const dates = newMembershipDates(startedAt, tier.rateHeldMonths, tier.termDays);
  // A capped, rate-held plan (Founding 50) holds its own price.
  const priceCentsOverride =
    input.priceCentsOverride ?? (tier.rateHeldMonths ? tier.monthlyPriceCents : null);

  const membership = await prisma.membership.create({
    data: {
      memberId: member.id,
      tierId: tier.id,
      status: "ACTIVE",
      startedAt: dates.startedAt,
      currentPeriodStart: dates.currentPeriodStart,
      currentPeriodEnd: dates.currentPeriodEnd,
      minimumTermEndsAt: dates.minimumTermEndsAt,
      rateHeldUntil: dates.rateHeldUntil,
      priceCentsOverride,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      notes: input.notes ?? "",
      periods: {
        create: {
          periodStart: dates.currentPeriodStart,
          periodEnd: dates.currentPeriodEnd,
          sessionsIncluded: tier.includedSessionsPerMonth
        }
      }
    },
    include: {
      member: { select: { id: true, name: true, email: true, phone: true } },
      tier: true,
      periods: { orderBy: { periodStart: "desc" }, take: 12 }
    }
  });

  await sendMembershipWelcomeEmail({
    member: { name: member.name, email: member.email },
    tier: {
      name: tier.name,
      includedSessionsPerMonth: tier.includedSessionsPerMonth,
      allowedCategories: tier.allowedCategories,
      guestPassesPerMonth: tier.guestPassesPerMonth
    },
    priceCents: priceCentsOverride ?? tier.monthlyPriceCents,
    startedAt: dates.startedAt,
    currentPeriodEnd: dates.currentPeriodEnd,
    minimumTermEndsAt: dates.minimumTermEndsAt,
    rateHeld: priceCentsOverride !== null,
    isNewAccount: input.isNewAccount ?? false,
    termDays: tier.termDays
  }).catch((error) => {
    console.error("[membership-mail] welcome failed:", error);
  });

  return membership;
}

/**
 * Closes fixed-length passes whose time is up.
 *
 * Booking already refuses a lapsed pass on the date itself, so this is not
 * what protects the studio — it is what stops a finished week sitting in the
 * admin list looking active, and what makes the member's own account honest.
 */
export async function expireLapsedPasses(prisma: PrismaClient, now = new Date()) {
  const lapsed = await prisma.membership.updateMany({
    where: {
      status: { in: ["ACTIVE", "PAYMENT_FAILED"] },
      currentPeriodEnd: { lt: now },
      tier: { termDays: { not: null } }
    },
    data: { status: "CANCELLED", cancelEffectiveAt: now }
  });
  if (lapsed.count) {
    console.log(`[memberships] closed ${lapsed.count} finished pass(es)`);
  }
  return lapsed.count;
}

/**
 * Moves a membership into its next month when the subscription renews.
 *
 * Unused sessions roll forward exactly one month and do not stack, which is the
 * only subtle part: what rolls out of the closing period is its own untouched
 * allowance, never sessions that themselves rolled in.
 */
export async function renewMembershipPeriod(
  prisma: PrismaClient,
  membershipId: string,
  periodStart: Date,
  periodEnd: Date
) {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: { tier: true, periods: { orderBy: { periodStart: "desc" }, take: 1 } }
  });
  if (!membership) return null;

  const closing = membership.periods[0];
  // Already rolled — a replayed invoice webhook must not mint a second month.
  if (closing && closing.periodStart.getTime() >= periodStart.getTime()) return closing;

  const rolledIn = closing ? sessionsRollingOut(closing) : 0;

  const [, period] = await prisma.$transaction([
    prisma.membership.update({
      where: { id: membershipId },
      data: { currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, status: "ACTIVE" }
    }),
    prisma.membershipPeriod.create({
      data: {
        membershipId,
        periodStart,
        periodEnd,
        sessionsIncluded: membership.tier?.includedSessionsPerMonth ?? null,
        sessionsRolledIn: rolledIn
      }
    }),
    ...(closing
      ? [
          prisma.membershipPeriod.update({
            where: { id: closing.id },
            data: { sessionsRolledOut: rolledIn }
          })
        ]
      : [])
  ]);

  return period;
}
