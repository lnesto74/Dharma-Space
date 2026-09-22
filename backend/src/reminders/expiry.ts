/**
 * The daily sweep for anything with a date on it.
 *
 * Three things can run out at Dharma Space: the credits in a pack, the access
 * on a membership somebody has cancelled, and a founding member's held rate.
 * Each gets a warning three, two and one month ahead. A fourth thing doesn't
 * run out at all but arrives all the same — a membership renewing itself — and
 * that gets three days' notice.
 *
 * Every warning is written to ExpiryReminder the moment it is sent. That table
 * — not a flag on the wallet, not a timestamp on the member — is what makes the
 * sweep safe to run on every boot and every day after, in any order, twice if
 * it likes.
 */

import type { PrismaClient } from "@prisma/client";
import { addMonths, nextMilestone } from "./milestones.js";
import {
  sendCreditExpiryReminder,
  sendMembershipEndingReminder,
  sendMembershipRenewalReminder,
  sendRateEndingReminder
} from "./emails.js";
import { addDays, effectivePriceCents, sessionsRemaining } from "../memberships/lifecycle.js";
import { isMailConfigured } from "../mail.js";

/** One notice per renewal date, so next month's notice is a different row. */
function renewalKey(membershipId: string, periodEnd: Date) {
  return `${membershipId}:${periodEnd.toISOString().slice(0, 10)}`;
}

export const REMINDER_KINDS = [
  "CREDIT_PACK",
  "MEMBERSHIP_END",
  "MEMBERSHIP_RATE",
  "MEMBERSHIP_RENEWAL"
] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** Days of warning before a membership bills itself again. */
export const RENEWAL_NOTICE_DAYS = 3;

export type SweepResult = {
  sent: number;
  skipped: number;
  failed: number;
  /** Populated in dry-run mode so the sweep can be inspected before it mails. */
  planned: { kind: ReminderKind; to: string; months: number; subject: string }[];
};

type Options = {
  now?: Date;
  /** Work out what would be sent, send nothing, write nothing. */
  dryRun?: boolean;
};

/** Milestones already recorded for a set of targets, keyed by target id. */
async function sentMilestones(prisma: PrismaClient, kind: ReminderKind, targetIds: string[]) {
  if (!targetIds.length) return new Map<string, number[]>();
  const rows = await prisma.expiryReminder.findMany({
    where: { kind, targetId: { in: targetIds } },
    select: { targetId: true, monthsOut: true }
  });
  const map = new Map<string, number[]>();
  for (const row of rows) {
    map.set(row.targetId, [...(map.get(row.targetId) || []), row.monthsOut]);
  }
  return map;
}

/**
 * Writes the reminder before trusting it was sent. If the insert loses a race
 * with a second process the unique index rejects it and we skip, which is the
 * right way round: a missed reminder is a small disappointment, a duplicate is
 * an annoyance we chose to inflict.
 */
async function record(
  prisma: PrismaClient,
  kind: ReminderKind,
  targetId: string,
  /** Months of notice, or 0 for the renewal notice, which is counted in days. */
  months: number,
  memberId: string | null,
  email: string,
  expiresAt: Date
): Promise<boolean> {
  try {
    await prisma.expiryReminder.create({
      data: { kind, targetId, monthsOut: months, memberId, email, expiresAt }
    });
    return true;
  } catch {
    return false;
  }
}

export async function sweepExpiryReminders(
  prisma: PrismaClient,
  options: Options = {}
): Promise<SweepResult> {
  const now = options.now || new Date();
  const dryRun = options.dryRun || false;
  const horizon = addMonths(now, 3);
  const result: SweepResult = { sent: 0, skipped: 0, failed: 0, planned: [] };

  if (!dryRun && !isMailConfigured("education")) {
    console.warn("[reminders] education SMTP not configured — sweep skipped");
    return result;
  }

  // ── Credit packs ───────────────────────────────────────────────────────────
  const wallets = await prisma.creditWallet.findMany({
    where: { status: "ACTIVE", expiresAt: { gt: now, lte: horizon } },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      pack: { select: { name: true } },
      sharedWith: { include: { member: { select: { name: true } } } }
    }
  });
  const walletSent = await sentMilestones(prisma, "CREDIT_PACK", wallets.map((w) => w.id));

  for (const wallet of wallets) {
    const creditsLeft = wallet.creditsTotal - wallet.creditsUsed;
    // An empty pack has nothing to lose, so saying so would just be noise.
    if (creditsLeft <= 0) continue;
    if (!wallet.owner?.email) continue;

    const months = nextMilestone(wallet.expiresAt, now, walletSent.get(wallet.id) || []);
    if (months === null) {
      result.skipped += 1;
      continue;
    }

    const payload = {
      to: wallet.owner.email,
      name: wallet.owner.name?.split(" ")[0] || "there",
      packName: wallet.pack?.name || "Credit pack",
      creditsLeft,
      expiresAt: wallet.expiresAt,
      months,
      sharedWith: wallet.sharedWith.map((s) => s.member?.name || "").filter(Boolean)
    };

    if (dryRun) {
      result.planned.push({
        kind: "CREDIT_PACK",
        to: payload.to,
        months,
        subject: `${creditsLeft} credits, expires ${wallet.expiresAt.toISOString().slice(0, 10)}`
      });
      continue;
    }

    if (!(await record(prisma, "CREDIT_PACK", wallet.id, months, wallet.owner.id, payload.to, wallet.expiresAt))) {
      result.skipped += 1;
      continue;
    }
    (await sendCreditExpiryReminder(payload)) ? (result.sent += 1) : (result.failed += 1);
  }

  // ── Memberships that have been cancelled and are winding down ──────────────
  const ending = await prisma.membership.findMany({
    where: { status: "PENDING_CANCEL", cancelEffectiveAt: { gt: now, lte: horizon } },
    include: {
      member: { select: { id: true, name: true, email: true } },
      tier: { select: { name: true } },
      periods: { orderBy: { periodStart: "desc" }, take: 1 }
    }
  });
  const endingSent = await sentMilestones(prisma, "MEMBERSHIP_END", ending.map((m) => m.id));

  for (const membership of ending) {
    const endsAt = membership.cancelEffectiveAt;
    if (!endsAt || !membership.member?.email) continue;

    const months = nextMilestone(endsAt, now, endingSent.get(membership.id) || []);
    if (months === null) {
      result.skipped += 1;
      continue;
    }

    const period = membership.periods[0];
    const payload = {
      to: membership.member.email,
      name: membership.member.name?.split(" ")[0] || "there",
      tierName: membership.tier?.name || "Membership",
      endsAt,
      months,
      sessionsLeft: period ? sessionsRemaining(period) : null
    };

    if (dryRun) {
      result.planned.push({
        kind: "MEMBERSHIP_END",
        to: payload.to,
        months,
        subject: `${payload.tierName} ends ${endsAt.toISOString().slice(0, 10)}`
      });
      continue;
    }

    if (!(await record(prisma, "MEMBERSHIP_END", membership.id, months, membership.member.id, payload.to, endsAt))) {
      result.skipped += 1;
      continue;
    }
    (await sendMembershipEndingReminder(payload)) ? (result.sent += 1) : (result.failed += 1);
  }

  // ── Memberships about to bill themselves again ─────────────────────────────
  //
  // Keyed on the renewal date rather than the membership, so every month gets
  // its own notice while a replayed sweep still gets nothing. PENDING_CANCEL
  // and FROZEN are left alone: neither is about to charge anyone.
  const renewing = await prisma.membership.findMany({
    where: {
      status: "ACTIVE",
      currentPeriodEnd: { gt: now, lte: addDays(now, RENEWAL_NOTICE_DAYS) },
      // A week-long pass ends rather than renews, so a renewal notice would be
      // telling it wrong.
      tier: { termDays: null }
    },
    include: {
      member: { select: { id: true, name: true, email: true } },
      tier: { select: { name: true, monthlyPriceCents: true } },
      periods: { orderBy: { periodStart: "desc" }, take: 1 }
    }
  });

  const renewalKeys = renewing.map((m) => renewalKey(m.id, m.currentPeriodEnd));
  const renewalSent = new Set(
    (
      await prisma.expiryReminder.findMany({
        where: { kind: "MEMBERSHIP_RENEWAL", targetId: { in: renewalKeys } },
        select: { targetId: true }
      })
    ).map((r) => r.targetId)
  );

  for (const membership of renewing) {
    if (!membership.member?.email) continue;
    const key = renewalKey(membership.id, membership.currentPeriodEnd);
    if (renewalSent.has(key)) {
      result.skipped += 1;
      continue;
    }

    const period = membership.periods[0];
    const payload = {
      to: membership.member.email,
      name: membership.member.name?.split(" ")[0] || "there",
      tierName: membership.tier?.name || "Membership",
      renewsAt: membership.currentPeriodEnd,
      priceCents: effectivePriceCents(
        membership.tier?.monthlyPriceCents ?? 0,
        membership.priceCentsOverride,
        membership.rateHeldUntil,
        membership.currentPeriodEnd
      ),
      sessionsLeft: period ? sessionsRemaining(period) : null,
      minimumTermEndsAt: membership.minimumTermEndsAt,
      autoRenews: Boolean(membership.stripeSubscriptionId)
    };

    if (dryRun) {
      result.planned.push({
        kind: "MEMBERSHIP_RENEWAL",
        to: payload.to,
        months: 0,
        subject: `${payload.tierName} renews ${membership.currentPeriodEnd.toISOString().slice(0, 10)}`
      });
      continue;
    }

    if (
      !(await record(
        prisma,
        "MEMBERSHIP_RENEWAL",
        key,
        0,
        membership.member.id,
        payload.to,
        membership.currentPeriodEnd
      ))
    ) {
      result.skipped += 1;
      continue;
    }
    (await sendMembershipRenewalReminder(payload)) ? (result.sent += 1) : (result.failed += 1);
  }

  // ── Founding rates about to return to standard price ───────────────────────
  const held = await prisma.membership.findMany({
    where: {
      status: { in: ["ACTIVE", "FROZEN"] },
      priceCentsOverride: { not: null },
      rateHeldUntil: { gt: now, lte: horizon }
    },
    include: {
      member: { select: { id: true, name: true, email: true } },
      tier: { select: { name: true, monthlyPriceCents: true } }
    }
  });
  const heldSent = await sentMilestones(prisma, "MEMBERSHIP_RATE", held.map((m) => m.id));

  for (const membership of held) {
    const heldUntil = membership.rateHeldUntil;
    if (!heldUntil || !membership.member?.email || membership.priceCentsOverride === null) continue;
    // Nothing to warn about if the held rate isn't actually cheaper.
    const standard = membership.tier?.monthlyPriceCents ?? 0;
    if (standard <= membership.priceCentsOverride) continue;

    const months = nextMilestone(heldUntil, now, heldSent.get(membership.id) || []);
    if (months === null) {
      result.skipped += 1;
      continue;
    }

    const payload = {
      to: membership.member.email,
      name: membership.member.name?.split(" ")[0] || "there",
      tierName: membership.tier?.name || "Membership",
      heldUntil,
      heldPriceCents: membership.priceCentsOverride,
      standardPriceCents: standard,
      months
    };

    if (dryRun) {
      result.planned.push({
        kind: "MEMBERSHIP_RATE",
        to: payload.to,
        months,
        subject: `rate holds until ${heldUntil.toISOString().slice(0, 10)}`
      });
      continue;
    }

    if (!(await record(prisma, "MEMBERSHIP_RATE", membership.id, months, membership.member.id, payload.to, heldUntil))) {
      result.skipped += 1;
      continue;
    }
    (await sendRateEndingReminder(payload)) ? (result.sent += 1) : (result.failed += 1);
  }

  if (result.sent || result.failed) {
    console.log(
      `[reminders] expiry sweep — sent ${result.sent}, skipped ${result.skipped}, failed ${result.failed}`
    );
  }
  return result;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Runs the sweep now and once a day after. Daily rather than hourly because
 * the windows are months wide; a reminder arriving in the morning rather than
 * at 3am is the more considerate default anyway.
 */
export function scheduleExpiryReminders(prisma: PrismaClient) {
  const run = () =>
    sweepExpiryReminders(prisma).catch((error) =>
      console.error("[reminders] expiry sweep failed:", error)
    );
  void run();
  const timer = setInterval(run, DAY_MS);
  timer.unref?.();
  return timer;
}
