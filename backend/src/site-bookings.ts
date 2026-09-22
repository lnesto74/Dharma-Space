import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import type { PrismaClient, SiteMember } from "@prisma/client";
import { z } from "zod";
import { assertProgramHasCapacity, getProgramBookingStats } from "./program-bookings.js";
import { serializeProgram } from "./education.js";
import { sortProgramsForDisplay } from "./program-schedule.js";
import { serializeClass, sortClasses } from "./class-schedule.js";
import {
  createStripeCheckoutSession,
  stripeConfigured,
  verifyCheckoutSessionPaid,
  syncStripePaymentIds,
  refundStripeBooking,
  markBookingRefundedManual,
  retrieveCheckoutSession
} from "./stripe.js";
import {
  completeBookingPayment,
  sendBookingConfirmation,
  sendBookingPayNowPendingEmails
} from "./booking-emails.js";
import { verifyGoogleIdToken } from "./google-auth.js";
import {
  deriveCategory,
  resolvePaymentPlan,
  type MembershipContext,
  type PaymentPlan
} from "./memberships/booking-rules.js";
import {
  cancelPayments,
  openPayment,
  primaryPayment,
  providerFromLegacyMethod,
  refundPayment
} from "./payments/ledger.js";
import { parsePriceToCents } from "./payments/money.js";
import { formatPrice, singleClassCents, walkUpCents } from "./schedule/pricing.js";
import type { WalletLedger } from "./credits/wallet.js";

export type MemberToken = { sub: string; kind: "site_member" };

export type MemberRequest = Request & { siteMember?: SiteMember };

const BOOKING_STATUSES = ["AWAITING_PAYMENT", "PAID", "CANCELLED"] as const;

function bookingReference(prefix = "DS") {
  return `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function stripeCheckoutUrl(base: string, email: string, reference: string) {
  const url = new URL(base);
  url.searchParams.set("prefilled_email", email);
  url.searchParams.set("client_reference_id", reference);
  return url.toString();
}

export function serializeBooking(booking: {
  id: string;
  reference: string;
  memberId: string | null;
  siteProgramId: string | null;
  siteClassId: string | null;
  offeringType: string;
  offeringTitle: string;
  category: string;
  scheduledLabel: string;
  time: string;
  location: string;
  facilitator: string;
  price: string;
  guests: number;
  notes: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  status: string;
  paymentMethod: string | null;
  stripeCheckoutUrl: string | null;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  membershipId?: string | null;
  membershipPeriodId?: string | null;
  sessionsSpent?: number;
}) {
  const refundable =
    booking.status === "PAID" &&
    !booking.refundedAt &&
    (booking.paymentMethod === "STRIPE" || booking.paymentMethod === "PAYNOW");

  return {
    id: booking.id,
    reference: booking.reference,
    memberId: booking.memberId,
    siteProgramId: booking.siteProgramId,
    siteClassId: booking.siteClassId,
    offeringType: booking.offeringType,
    offeringTitle: booking.offeringTitle,
    category: booking.category,
    scheduledLabel: booking.scheduledLabel,
    time: booking.time,
    location: booking.location,
    facilitator: booking.facilitator,
    price: booking.price,
    guests: booking.guests,
    notes: booking.notes,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone,
    status: booking.status,
    paymentMethod: booking.paymentMethod,
    membershipId: booking.membershipId ?? null,
    sessionsSpent: booking.sessionsSpent ?? 0,
    stripeCheckoutUrl: booking.stripeCheckoutUrl,
    paidAt: booking.paidAt?.toISOString() ?? null,
    refundedAt: booking.refundedAt?.toISOString() ?? null,
    refundable,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
    paymentStatus:
      booking.status === "REFUNDED"
        ? "REFUNDED"
        : booking.status === "CANCELLED"
          ? "CANCELLED"
          : booking.status === "PAID"
            ? "PAID"
            : "NOT_PAID"
  };
}

export function signMemberToken(member: SiteMember, jwtSecret: string) {
  return jwt.sign({ sub: member.id, kind: "site_member" } satisfies MemberToken, jwtSecret, {
    expiresIn: "30d"
  });
}

export function sanitizeMember(member: SiteMember) {
  const { passwordHash, ...safe } = member;
  return safe;
}

export function createMemberAuth(prisma: PrismaClient, jwtSecret: string) {
  return async (req: MemberRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Please sign in to continue." });
    }
    try {
      const payload = jwt.verify(header.slice(7), jwtSecret) as MemberToken;
      if (payload.kind !== "site_member") {
        return res.status(401).json({ message: "Invalid member session." });
      }
      const member = await prisma.siteMember.findUnique({ where: { id: payload.sub } });
      if (!member) return res.status(401).json({ message: "Account not found." });
      req.siteMember = member;
      next();
    } catch {
      res.status(401).json({ message: "Session expired. Please sign in again." });
    }
  };
}

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const createBookingSchema = z.object({
  siteProgramId: z.string().optional(),
  siteClassId: z.string().optional(),
  guests: z.number().int().min(1).max(10).optional(),
  notes: z.string().optional(),
  paymentMethod: z.enum(["STRIPE", "PAYNOW"]).optional()
});

async function loadOffering(prisma: PrismaClient, input: { siteProgramId?: string; siteClassId?: string }) {
  if (input.siteProgramId) {
    const program = await prisma.siteProgram.findUnique({ where: { id: input.siteProgramId } });
    if (!program || !program.published) throw Object.assign(new Error("Program not found"), { status: 404 });
    if (program.comingSoon) throw Object.assign(new Error("This offering is not open for booking yet."), { status: 400 });
    const stats = await getProgramBookingStats(prisma, program);
    if (stats.finished) throw Object.assign(new Error("This session has finished."), { status: 400 });
    if (stats.soldOut) throw Object.assign(new Error("This session is sold out."), { status: 400 });
    return {
      offeringType: "PROGRAM" as const,
      siteProgramId: program.id,
      siteClassId: null as string | null,
      offeringTitle: program.title,
      category: program.category,
      // Programs (workshops, trainings, events) are never part of a weekly
      // membership allowance — they're ticketed separately.
      membershipCategory: null as string | null,
      scheduledLabel: program.dates,
      time: program.time,
      location: program.location,
      facilitator: program.facilitator,
      price: program.price,
      stripeLink: program.stripeLink,
      usePayNow: program.usePayNow,
      depositAmount: program.depositAmount
    };
  }

  if (input.siteClassId) {
    const siteClass = await prisma.siteClass.findUnique({ where: { id: input.siteClassId } });
    if (!siteClass || !siteClass.published) throw Object.assign(new Error("Class not found"), { status: 404 });
    if (siteClass.comingSoon) throw Object.assign(new Error("This class is not open for booking yet."), { status: 400 });
    const scheduledLabel = siteClass.classDate
      ? `${siteClass.day}, ${siteClass.classDate}`
      : siteClass.day;
    return {
      offeringType: "CLASS" as const,
      siteProgramId: null as string | null,
      siteClassId: siteClass.id,
      offeringTitle: siteClass.classType,
      category: "REGULAR_CLASS",
      // The membership category (YOGA / AERIAL / …) decides which plans cover it,
      // separately from the booking's "REGULAR_CLASS" grouping category.
      membershipCategory: siteClass.category || deriveCategory(siteClass.classType),
      scheduledLabel,
      time: siteClass.time,
      location: siteClass.location,
      facilitator: siteClass.instructor,
      price: siteClass.price,
      stripeLink: siteClass.stripeLink,
      // Drop-ins can be settled by PayNow, same as programs. Per-class Stripe
      // links don't scale to a timetable republished every week.
      usePayNow: true,
      depositAmount: null as string | null
    };
  }

  throw Object.assign(new Error("Choose a program or class to book."), { status: 400 });
}

const ACTIVE_BOOKING_STATUSES = ["AWAITING_PAYMENT", "PAID"] as const;

export async function assertMemberHasNoActiveBooking(
  prisma: PrismaClient,
  memberId: string,
  offering: { siteProgramId: string | null; siteClassId: string | null; offeringTitle: string }
) {
  if (!offering.siteProgramId && !offering.siteClassId) return;

  const existing = await prisma.booking.findFirst({
    where: {
      memberId,
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
      ...(offering.siteProgramId ? { siteProgramId: offering.siteProgramId } : { siteClassId: offering.siteClassId })
    }
  });

  if (existing) {
    throw Object.assign(
      new Error(`You already have a booking for ${offering.offeringTitle}. See My account → My bookings.`),
      { status: 409 }
    );
  }
}

/**
 * How full a weekly class is. `capacity` of 0 means the room is uncapped,
 * which is how classes behaved before mats were counted.
 *
 * Guests are summed rather than rows counted, because one booking can bring
 * more than one body into the room.
 */
export async function classCapacityStatus(prisma: PrismaClient, siteClassId: string) {
  const [siteClass, taken] = await Promise.all([
    prisma.siteClass.findUnique({ where: { id: siteClassId }, select: { capacity: true } }),
    prisma.booking.aggregate({
      where: { siteClassId, status: { in: [...ACTIVE_BOOKING_STATUSES] } },
      _sum: { guests: true }
    })
  ]);

  const capacity = siteClass?.capacity ?? 0;
  const booked = taken._sum.guests ?? 0;
  return {
    capacity,
    booked,
    placesLeft: capacity > 0 ? Math.max(0, capacity - booked) : null,
    full: capacity > 0 && booked >= capacity
  };
}

/**
 * Stops a class being booked past the mats in the room. The front desk can
 * override this — someone standing in reception with cash is a different
 * situation from a stranger on the website at midnight — but nobody can
 * overfill a room by accident.
 */
async function assertClassHasCapacity(
  prisma: PrismaClient,
  siteClassId: string,
  guests: number,
  offeringTitle: string
) {
  const room = await classCapacityStatus(prisma, siteClassId);
  if (room.capacity > 0 && room.booked + guests > room.capacity) {
    throw Object.assign(
      new Error(
        room.placesLeft && room.placesLeft > 0
          ? `${offeringTitle} has only ${room.placesLeft} ${
              room.placesLeft === 1 ? "place" : "places"
            } left.`
          : `${offeringTitle} is full.`
      ),
      { status: 409 }
    );
  }
}

export async function getBookableOfferings(prisma: PrismaClient) {
  const [programs, classes] = await Promise.all([
    prisma.siteProgram.findMany({ where: { published: true }, orderBy: { sortOrder: "asc" } }),
    prisma.siteClass.findMany({ where: { published: true }, orderBy: [{ dayIndex: "asc" }, { startMinutes: "asc" }] })
  ]);

  const enrichedPrograms = await Promise.all(
    programs.map(async (program) => ({
      ...serializeProgram(program),
      offeringType: "PROGRAM" as const,
      bookable: !program.comingSoon,
      ...(await getProgramBookingStats(prisma, program))
    }))
  );

  return {
    programs: sortProgramsForDisplay(enrichedPrograms),
    classes: sortClasses(classes.map(serializeClass)).map((siteClass) => ({
      ...siteClass,
      offeringType: "CLASS" as const,
      bookable: !siteClass.comingSoon
    }))
  };
}

/** The member's current plan and this month's ledger, if they have one. */
export async function loadMembershipContext(
  prisma: PrismaClient,
  memberId: string
): Promise<MembershipContext | null> {
  const membership = await prisma.membership.findFirst({
    where: { memberId, status: { not: "CANCELLED" } },
    include: {
      tier: true,
      periods: { orderBy: { periodStart: "desc" }, take: 1 }
    }
  });
  if (!membership) return null;
  const period = membership.periods[0] ?? null;
  return {
    membershipId: membership.id,
    status: membership.status,
    allowedCategories: membership.tier.allowedCategories,
    period: period
      ? {
          id: period.id,
          sessionsIncluded: period.sessionsIncluded,
          sessionsUsed: period.sessionsUsed,
          sessionsRolledIn: period.sessionsRolledIn
        }
      : null
  };
}

/**
 * Every credit wallet this person may spend from — their own purchases plus any
 * pack someone else shared with them. Expired and spent-out packs are filtered
 * here so the booking rules only ever see usable balances.
 */
export async function loadCreditWallets(
  prisma: PrismaClient,
  memberId: string
): Promise<WalletLedger[]> {
  return prisma.creditWallet.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
      OR: [{ ownerId: memberId }, { sharedWith: { some: { memberId } } }]
    },
    select: {
      id: true,
      creditsTotal: true,
      creditsUsed: true,
      expiresAt: true,
      status: true
    }
  });
}

/**
 * Confirms a booking paid out of a credit pack. The draw, the booking and the
 * ledger entry are one transaction, so a shared wallet can never be debited
 * without a booking to show for it — and two people spending the last credits
 * at the same moment can't both succeed.
 */
async function createCreditBooking(
  prisma: PrismaClient,
  member: SiteMember,
  offering: Awaited<ReturnType<typeof loadOffering>>,
  plan: Extract<PaymentPlan, { method: "CREDITS" }>,
  notes?: string
) {
  const reference = bookingReference();

  const booking = await prisma.$transaction(async (tx) => {
    if (plan.creditsSpent > 0) {
      // Re-check inside the transaction — this wallet may be shared, so someone
      // else could have spent the balance since the plan was resolved.
      const wallet = await tx.creditWallet.findUnique({ where: { id: plan.walletId } });
      if (!wallet) throw Object.assign(new Error("Credit pack not found."), { status: 409 });
      const remaining = wallet.creditsTotal - wallet.creditsUsed;
      if (
        wallet.status !== "ACTIVE" ||
        wallet.expiresAt.getTime() <= Date.now() ||
        remaining < plan.creditsSpent
      ) {
        throw Object.assign(new Error("Not enough credits left in the pack."), { status: 409 });
      }
      await tx.creditWallet.update({
        where: { id: plan.walletId },
        data: { creditsUsed: { increment: plan.creditsSpent } }
      });
    }

    const created = await tx.booking.create({
      data: {
        reference,
        memberId: member.id,
        siteProgramId: offering.siteProgramId,
        siteClassId: offering.siteClassId,
        offeringType: offering.offeringType,
        offeringTitle: offering.offeringTitle,
        category: offering.category,
        scheduledLabel: offering.scheduledLabel,
        time: offering.time,
        location: offering.location,
        facilitator: offering.facilitator,
        price:
          plan.creditsSpent > 0
            ? `${plan.creditsSpent} credit${plan.creditsSpent === 1 ? "" : "s"}`
            : "Free with credits",
        guests: 1,
        notes: notes?.trim() || null,
        customerName: member.name,
        customerEmail: member.email,
        customerPhone: member.phone,
        // Nothing to collect — the pack was paid for up front.
        status: "PAID",
        paidAt: new Date(),
        paymentMethod: "CREDITS",
        creditWalletId: plan.walletId,
        creditsSpent: plan.creditsSpent
      }
    });

    // Who spent what, so a pack shared between people can be accounted for.
    await tx.creditLedgerEntry.create({
      data: {
        walletId: plan.walletId,
        memberId: member.id,
        bookingId: created.id,
        credits: -plan.creditsSpent,
        reason: `${offering.offeringTitle} — ${plan.reason}`
      }
    });

    await openPayment(tx, {
      bookingId: created.id,
      memberId: member.id,
      reference,
      provider: "CREDITS",
      method: "CREDITS",
      amountCents: 0,
      paid: true
    });

    return created;
  });

  // Confirmed the moment it's booked, so the confirmation and calendar entry
  // are sent here rather than waiting on a payment that will never arrive.
  await sendBookingConfirmation(prisma, booking);

  return {
    booking: serializeBooking(booking),
    checkoutUrl: null as string | null,
    payNowAmount: null as string | null,
    credits: {
      reason: plan.reason,
      creditsSpent: plan.creditsSpent,
      walletId: plan.walletId
    }
  };
}

/**
 * Confirms a booking paid out of the membership allowance. The session draw and
 * the booking row are written in one transaction so an allowance can never be
 * decremented without a booking to show for it.
 */
async function createMembershipBooking(
  prisma: PrismaClient,
  member: SiteMember,
  offering: Awaited<ReturnType<typeof loadOffering>>,
  plan: Extract<PaymentPlan, { method: "MEMBERSHIP" }>,
  notes?: string
) {
  const reference = bookingReference();

  const booking = await prisma.$transaction(async (tx) => {
    if (plan.sessionsSpent > 0 && plan.periodId) {
      // Re-check inside the transaction so two concurrent bookings can't both
      // take the last included session.
      const period = await tx.membershipPeriod.findUnique({ where: { id: plan.periodId } });
      if (!period) throw Object.assign(new Error("Membership period not found."), { status: 409 });
      const available =
        period.sessionsIncluded === null
          ? Number.POSITIVE_INFINITY
          : period.sessionsIncluded + period.sessionsRolledIn - period.sessionsUsed;
      if (available < plan.sessionsSpent) {
        throw Object.assign(
          new Error("No included sessions left this period."),
          { status: 409 }
        );
      }
      await tx.membershipPeriod.update({
        where: { id: plan.periodId },
        data: { sessionsUsed: { increment: plan.sessionsSpent } }
      });
    }

    const created = await tx.booking.create({
      data: {
        reference,
        memberId: member.id,
        siteProgramId: offering.siteProgramId,
        siteClassId: offering.siteClassId,
        offeringType: offering.offeringType,
        offeringTitle: offering.offeringTitle,
        category: offering.category,
        scheduledLabel: offering.scheduledLabel,
        time: offering.time,
        location: offering.location,
        facilitator: offering.facilitator,
        price: plan.sessionsSpent > 0 ? "Included in membership" : "Free on membership",
        guests: 1,
        notes: notes?.trim() || null,
        customerName: member.name,
        customerEmail: member.email,
        customerPhone: member.phone,
        // Nothing to collect — the membership already paid for it.
        status: "PAID",
        paidAt: new Date(),
        paymentMethod: "MEMBERSHIP",
        membershipId: plan.membershipId,
        membershipPeriodId: plan.periodId,
        sessionsSpent: plan.sessionsSpent
      }
    });

    // A zero-value payment, so a membership class still appears in the ledger
    // next to cash and card takings rather than vanishing from the day's report.
    await openPayment(tx, {
      bookingId: created.id,
      memberId: member.id,
      reference,
      provider: "MEMBERSHIP",
      method: "MEMBERSHIP",
      amountCents: 0,
      paid: true
    });

    return created;
  });

  await sendBookingConfirmation(prisma, booking);

  return {
    booking: serializeBooking(booking),
    checkoutUrl: null as string | null,
    payNowAmount: null as string | null,
    membership: { reason: plan.reason, sessionsSpent: plan.sessionsSpent }
  };
}

export async function createSiteBooking(
  prisma: PrismaClient,
  member: SiteMember,
  input: z.infer<typeof createBookingSchema>
) {
  const guests = input.guests ?? 1;
  const offering = await loadOffering(prisma, input);

  if (offering.siteProgramId) {
    await assertProgramHasCapacity(prisma, offering.siteProgramId, guests);
  }
  if (offering.siteClassId) {
    await assertClassHasCapacity(prisma, offering.siteClassId, guests, offering.offeringTitle);
  }

  await assertMemberHasNoActiveBooking(prisma, member.id, offering);

  // A weekly class may be covered by the member's plan. If it is, the booking is
  // confirmed against their allowance instead of going to checkout.
  const plan = offering.membershipCategory
    ? resolvePaymentPlan(
        offering.membershipCategory,
        await loadMembershipContext(prisma, member.id),
        await loadCreditWallets(prisma, member.id)
      )
    : { method: "DROP_IN" as const, reason: "Ticketed separately from memberships." };

  if (plan.method === "MEMBERSHIP") {
    return createMembershipBooking(prisma, member, offering, plan, input.notes);
  }

  if (plan.method === "CREDITS") {
    return createCreditBooking(prisma, member, offering, plan, input.notes);
  }

  // Whether Stripe can take this payment is a server-side fact: it needs either
  // API keys or a payment link on the offering. The browser asking for Stripe
  // doesn't make it available, so a request for it falls back to PayNow rather
  // than failing the booking outright.
  const stripeAvailable = stripeConfigured() || Boolean(offering.stripeLink?.trim());
  const paymentMethod: "STRIPE" | "PAYNOW" = stripeAvailable
    ? input.paymentMethod === "PAYNOW" && offering.usePayNow
      ? "PAYNOW"
      : "STRIPE"
    : offering.usePayNow
      ? "PAYNOW"
      : "STRIPE";

  const reference = bookingReference();
  const priceLabel = offering.depositAmount || offering.price;

  let checkoutUrl: string | null = null;
  let stripeSessionId: string | null = null;
  if (paymentMethod === "STRIPE") {
    if (stripeConfigured()) {
      const session = await createStripeCheckoutSession({
        reference,
        email: member.email,
        title: offering.offeringTitle,
        subtitle: [offering.scheduledLabel, offering.time].filter(Boolean).join(" · "),
        priceLabel,
        guests,
        siteProgramId: offering.siteProgramId,
        siteClassId: offering.siteClassId
      });
      checkoutUrl = session?.url ?? null;
      stripeSessionId = session?.sessionId ?? null;
    } else if (offering.stripeLink?.trim()) {
      checkoutUrl = stripeCheckoutUrl(offering.stripeLink, member.email, reference);
    }
    if (!checkoutUrl) {
      throw Object.assign(
        new Error(
          "Online payment isn't set up for this offering yet. Please contact us on WhatsApp to book."
        ),
        { status: 400 }
      );
    }
  }

  const booking = await prisma.booking.create({
    data: {
      reference,
      memberId: member.id,
      siteProgramId: offering.siteProgramId,
      siteClassId: offering.siteClassId,
      offeringType: offering.offeringType,
      offeringTitle: offering.offeringTitle,
      category: offering.category,
      scheduledLabel: offering.scheduledLabel,
      time: offering.time,
      location: offering.location,
      facilitator: offering.facilitator,
      price: offering.depositAmount || offering.price,
      guests,
      notes: input.notes?.trim() || null,
      customerName: member.name,
      customerEmail: member.email,
      customerPhone: member.phone,
      status: "AWAITING_PAYMENT",
      paymentMethod,
      stripeCheckoutUrl: checkoutUrl,
      stripeSessionId
    }
  });

  await openPayment(prisma, {
    bookingId: booking.id,
    memberId: member.id,
    reference,
    ...providerFromLegacyMethod(paymentMethod),
    amountCents: parsePriceToCents(booking.price),
    providerRef: stripeSessionId,
    checkoutUrl
  }).catch((error) => {
    console.error("[payments] could not open payment:", error);
  });

  if (paymentMethod === "PAYNOW") {
    await sendBookingPayNowPendingEmails(booking).catch((error) => {
      console.error("[booking-mail] PayNow pending email failed:", error);
    });
  }

  return {
    booking: serializeBooking(booking),
    checkoutUrl,
    payNowAmount: paymentMethod === "PAYNOW" ? offering.depositAmount || offering.price : null
  };
}

// ─── Front desk ──────────────────────────────────────────────────────────────

/**
 * Booking somebody in at the counter.
 *
 * The website flow starts from a signed-in member and ends at a payment page.
 * At the desk it is the other way round: the money is already in the till and
 * the person in front of you may never have visited the website. So this takes
 * a name and an email, finds or makes the account behind them, and writes a
 * booking that is paid from the moment it exists.
 *
 * The email is not bureaucracy — it is what the confirmation and the calendar
 * invite are sent to, and it is how someone who already has a membership or a
 * credit pack is recognised instead of being charged twice.
 */

export const DESK_TENDERS = ["CASH", "CARD", "PAYNOW", "PLAN"] as const;
export type DeskTender = (typeof DESK_TENDERS)[number];

/** Tender as the booking and the ledger record it. PLAN never reaches here. */
const TENDER_METHOD: Record<Exclude<DeskTender, "PLAN">, string> = {
  CASH: "CASH",
  CARD: "QASHIER",
  PAYNOW: "PAYNOW"
};

export const frontDeskBookingSchema = z.object({
  siteClassId: z.string().optional(),
  siteProgramId: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("A valid email is required"),
  phone: z.string().optional(),
  guests: z.number().int().min(1).max(10).optional(),
  notes: z.string().optional(),
  tender: z.enum(DESK_TENDERS).default("CASH"),
  /** What was actually taken, when it differs from the standard rate. */
  amountCents: z.number().int().min(0).optional(),
  /** Squeeze someone into a full room. Deliberate, never the default. */
  overrideFull: z.boolean().optional()
});

/**
 * What the desk needs to know before taking money: whether this person is
 * already known, what they're on, and what this class should cost them.
 */
export async function lookupWalkIn(
  prisma: PrismaClient,
  email: string,
  input: { siteClassId?: string; siteProgramId?: string }
) {
  const member = await prisma.siteMember.findUnique({
    where: { email: email.toLowerCase().trim() }
  });

  const offering =
    input.siteClassId || input.siteProgramId ? await loadOffering(prisma, input) : null;

  if (!member) {
    const category = offering?.membershipCategory;
    return {
      found: false,
      member: null,
      plan: null,
      priceCents: category
        ? walkUpCents(category)
        : parsePriceToCents(offering?.price ?? ""),
      alreadyBooked: false
    };
  }

  const [membership, wallets] = await Promise.all([
    loadMembershipContext(prisma, member.id),
    loadCreditWallets(prisma, member.id)
  ]);

  const plan = offering?.membershipCategory
    ? resolvePaymentPlan(offering.membershipCategory, membership, wallets)
    : null;

  const alreadyBooked = offering
    ? Boolean(
        await prisma.booking.findFirst({
          where: {
            memberId: member.id,
            status: { in: [...ACTIVE_BOOKING_STATUSES] },
            ...(offering.siteProgramId
              ? { siteProgramId: offering.siteProgramId }
              : { siteClassId: offering.siteClassId })
          },
          select: { id: true }
        })
      )
    : false;

  const creditsLeft = wallets.reduce(
    (sum, wallet) => sum + (wallet.creditsTotal - wallet.creditsUsed),
    0
  );

  return {
    found: true,
    member: {
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      hasMembership: Boolean(membership),
      membershipStatus: membership?.status ?? null,
      creditsLeft
    },
    plan: plan ? { method: plan.method, reason: plan.reason } : null,
    // A member whose plan doesn't cover this class still pays less than a
    // stranger, so the desk is shown the rate that actually applies.
    priceCents: offering?.membershipCategory
      ? singleClassCents(offering.membershipCategory, Boolean(membership))
      : parsePriceToCents(offering?.price ?? ""),
    alreadyBooked
  };
}

/** Finds the person by email, or opens an account for them there and then. */
async function resolveWalkInMember(
  prisma: PrismaClient,
  input: { name: string; email: string; phone?: string }
) {
  const email = input.email.toLowerCase().trim();
  const existing = await prisma.siteMember.findUnique({ where: { email } });
  if (existing) {
    // A phone number given at the desk is worth keeping if we didn't have one.
    if (!existing.phone && input.phone?.trim()) {
      return {
        member: await prisma.siteMember.update({
          where: { id: existing.id },
          data: { phone: input.phone.trim() }
        }),
        isNewAccount: false
      };
    }
    return { member: existing, isNewAccount: false };
  }

  // The password is a placeholder they never see; they set their own through
  // the website's reset link the first time they want to sign in.
  const member = await prisma.siteMember.create({
    data: {
      name: input.name.trim(),
      email,
      phone: input.phone?.trim() || null,
      passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 12)
    }
  });
  return { member, isNewAccount: true };
}

export async function createFrontDeskBooking(
  prisma: PrismaClient,
  input: z.infer<typeof frontDeskBookingSchema>
) {
  const guests = input.guests ?? 1;
  const offering = await loadOffering(prisma, input);

  if (offering.siteProgramId) {
    await assertProgramHasCapacity(prisma, offering.siteProgramId, guests);
  }
  if (offering.siteClassId && !input.overrideFull) {
    await assertClassHasCapacity(prisma, offering.siteClassId, guests, offering.offeringTitle);
  }

  const { member, isNewAccount } = await resolveWalkInMember(prisma, input);

  const clash = await prisma.booking.findFirst({
    where: {
      memberId: member.id,
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
      ...(offering.siteProgramId
        ? { siteProgramId: offering.siteProgramId }
        : { siteClassId: offering.siteClassId })
    }
  });
  if (clash) {
    throw Object.assign(
      new Error(`${member.name} is already booked into ${offering.offeringTitle} (${clash.reference}).`),
      { status: 409 }
    );
  }

  // Someone holding a membership or a pack shouldn't be charged cash for a
  // class they've already paid for, so their plan is checked either way and
  // used when the desk asked for it.
  const plan = offering.membershipCategory
    ? resolvePaymentPlan(
        offering.membershipCategory,
        await loadMembershipContext(prisma, member.id),
        await loadCreditWallets(prisma, member.id)
      )
    : { method: "DROP_IN" as const, reason: "Ticketed separately from memberships." };

  if (input.tender === "PLAN") {
    if (plan.method === "MEMBERSHIP") {
      return { ...(await createMembershipBooking(prisma, member, offering, plan, input.notes)), isNewAccount };
    }
    if (plan.method === "CREDITS") {
      return { ...(await createCreditBooking(prisma, member, offering, plan, input.notes)), isNewAccount };
    }
    throw Object.assign(
      new Error(`${member.name} has nothing that covers this class — ${plan.reason}`),
      { status: 409 }
    );
  }

  const amountCents =
    input.amountCents ??
    (offering.membershipCategory
      ? singleClassCents(offering.membershipCategory, plan.method !== "DROP_IN")
      : parsePriceToCents(offering.depositAmount || offering.price));

  const reference = bookingReference("DSK");
  const paymentMethod = TENDER_METHOD[input.tender];

  const booking = await prisma.booking.create({
    data: {
      reference,
      memberId: member.id,
      siteProgramId: offering.siteProgramId,
      siteClassId: offering.siteClassId,
      offeringType: offering.offeringType,
      offeringTitle: offering.offeringTitle,
      category: offering.category,
      scheduledLabel: offering.scheduledLabel,
      time: offering.time,
      location: offering.location,
      facilitator: offering.facilitator,
      price: formatPrice(amountCents),
      guests,
      notes: input.notes?.trim() || null,
      customerName: member.name,
      customerEmail: member.email,
      customerPhone: member.phone,
      // The money is already in the till, so there is nothing to await.
      status: "PAID",
      paidAt: new Date(),
      paymentMethod
    }
  });

  await openPayment(prisma, {
    bookingId: booking.id,
    kind: "BOOKING",
    memberId: member.id,
    reference,
    ...providerFromLegacyMethod(paymentMethod),
    amountCents,
    paid: true
  }).catch((error) => {
    console.error("[payments] could not record desk payment:", error);
  });

  // Same confirmation and calendar invite as a booking made on the website —
  // being booked in at the desk shouldn't mean a worse experience afterwards.
  await sendBookingConfirmation(prisma, booking).catch((error) => {
    console.error("[booking-mail] desk confirmation failed:", error);
  });

  return {
    booking: serializeBooking(booking),
    checkoutUrl: null as string | null,
    payNowAmount: null as string | null,
    isNewAccount,
    paidWith: input.tender
  };
}

/**
 * What plan each booker is on right now, keyed by member id. Bookers with no
 * member account or no membership are absent and shown as walk-ups.
 */
async function loadMemberTypes(prisma: PrismaClient, memberIds: string[]) {
  if (!memberIds.length) return new Map<string, { tierName: string; status: string }>();
  const memberships = await prisma.membership.findMany({
    where: { memberId: { in: memberIds }, status: { not: "CANCELLED" } },
    include: { tier: true }
  });
  const byMember = new Map<string, { tierName: string; status: string }>();
  for (const m of memberships) {
    byMember.set(m.memberId, { tierName: m.tier.name, status: m.status });
  }
  return byMember;
}

export async function getAdminBookingOverview(prisma: PrismaClient) {
  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    include: { payments: true }
  });
  const memberTypes = await loadMemberTypes(
    prisma,
    [...new Set(bookings.map((b) => b.memberId).filter((id): id is string => Boolean(id)))]
  );
  const grouped = new Map<string, {
    key: string;
    offeringType: string;
    offeringTitle: string;
    category: string;
    scheduledLabel: string;
    siteProgramId: string | null;
    siteClassId: string | null;
    paidCount: number;
    unpaidCount: number;
    guestTotal: number;
    /** Heads per plan on this offering, e.g. { "Walk-up": 3, "Flow 4": 2 }. */
    memberTypeCounts: Record<string, number>;
    /** Money actually taken for this offering, across every rail. */
    collectedCents: number;
    bookings: (ReturnType<typeof serializeBooking> & {
      memberType: string;
      memberStatus: string | null;
      payment: {
        provider: string;
        method: string;
        status: string;
        amountCents: number;
      } | null;
    })[];
  }>();

  for (const row of bookings) {
    const key = row.siteProgramId ? `program:${row.siteProgramId}` : `class:${row.siteClassId}`;
    const entry = grouped.get(key) ?? {
      key,
      offeringType: row.offeringType,
      offeringTitle: row.offeringTitle,
      category: row.category,
      scheduledLabel: row.scheduledLabel,
      siteProgramId: row.siteProgramId,
      siteClassId: row.siteClassId,
      paidCount: 0,
      unpaidCount: 0,
      guestTotal: 0,
      memberTypeCounts: {},
      collectedCents: 0,
      bookings: []
    };
    const memberType = row.memberId ? memberTypes.get(row.memberId) : undefined;
    const label = memberType?.tierName ?? "Walk-up";
    const payment = primaryPayment(row.payments);
    entry.bookings.push({
      ...serializeBooking(row),
      memberType: label,
      memberStatus: memberType?.status ?? null,
      payment: payment
        ? {
            provider: payment.provider,
            method: payment.method,
            status: payment.status,
            amountCents: payment.amountCents
          }
        : null
    });
    if (payment?.status === "PAID") {
      entry.collectedCents += payment.amountCents;
    }
    if (row.status !== "CANCELLED") {
      entry.memberTypeCounts[label] = (entry.memberTypeCounts[label] ?? 0) + row.guests;
    }
    entry.guestTotal += row.guests;
    if (row.status === "PAID") entry.paidCount += row.guests;
    else if (row.status === "AWAITING_PAYMENT") entry.unpaidCount += row.guests;
    grouped.set(key, entry);
  }

  return {
    totals: {
      bookings: bookings.length,
      paid: bookings.filter((b) => b.status === "PAID").length,
      awaitingPayment: bookings.filter((b) => b.status === "AWAITING_PAYMENT").length
    },
    offerings: [...grouped.values()].sort((a, b) => a.offeringTitle.localeCompare(b.offeringTitle))
  };
}

export function registerSiteBookingRoutes(
  app: import("express").Express,
  prisma: PrismaClient,
  jwtSecret: string,
  adminAuth: (req: Request, res: Response, next: NextFunction) => void,
  requireAdmin: (req: Request, res: Response, next: NextFunction) => void
) {
  const memberAuth = createMemberAuth(prisma, jwtSecret);

  app.post("/api/member/register", async (req, res, next) => {
    try {
      const body = registerSchema.parse(req.body);
      const existing = await prisma.siteMember.findUnique({ where: { email: body.email.toLowerCase() } });
      if (existing) return res.status(409).json({ message: "An account with this email already exists." });
      const member = await prisma.siteMember.create({
        data: {
          name: body.name.trim(),
          email: body.email.toLowerCase(),
          phone: body.phone?.trim() || null,
          passwordHash: await bcrypt.hash(body.password, 12)
        }
      });
      res.status(201).json({
        token: signMemberToken(member, jwtSecret),
        member: sanitizeMember(member)
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/member/login", async (req, res, next) => {
    try {
      const body = loginSchema.parse(req.body);
      const member = await prisma.siteMember.findUnique({ where: { email: body.email.toLowerCase() } });
      if (!member || !(await bcrypt.compare(body.password, member.passwordHash))) {
        return res.status(401).json({ message: "Invalid email or password." });
      }
      res.json({
        token: signMemberToken(member, jwtSecret),
        member: sanitizeMember(member)
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/member/google", async (req, res, next) => {
    try {
      const { idToken } = z.object({ idToken: z.string().min(10) }).parse(req.body);
      const profile = await verifyGoogleIdToken(idToken);
      if (!profile.emailVerified) {
        return res.status(401).json({ message: "Google email is not verified." });
      }
      let member = await prisma.siteMember.findUnique({ where: { email: profile.email } });
      if (!member) {
        member = await prisma.siteMember.create({
          data: {
            name: profile.name,
            email: profile.email,
            passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 12)
          }
        });
      }
      res.json({
        token: signMemberToken(member, jwtSecret),
        member: sanitizeMember(member)
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/member/me", memberAuth, async (req: MemberRequest, res, next) => {
    try {
      const body = z
        .object({
          name: z.string().min(2).optional(),
          phone: z.string().optional().nullable()
        })
        .parse(req.body);
      const updated = await prisma.siteMember.update({
        where: { id: req.siteMember!.id },
        data: {
          ...(body.name ? { name: body.name.trim() } : {}),
          ...(body.phone !== undefined ? { phone: body.phone?.trim() || null } : {})
        }
      });
      res.json({ member: sanitizeMember(updated) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/member/bookings/confirm-return", memberAuth, async (req: MemberRequest, res, next) => {
    try {
      const body = z
        .object({
          reference: z.string().min(3),
          sessionId: z.string().optional()
        })
        .parse(req.body);
      const booking = await prisma.booking.findFirst({
        where: { reference: body.reference, memberId: req.siteMember!.id }
      });
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.status === "PAID") {
        return res.json({ booking: serializeBooking(booking), alreadyPaid: true });
      }
      if (body.sessionId) {
        const paid = await verifyCheckoutSessionPaid(body.sessionId, body.reference);
        if (!paid) {
          return res.status(402).json({ message: "Payment not completed yet. Please wait a moment and refresh." });
        }
        const session = await retrieveCheckoutSession(body.sessionId);
        if (session) await syncStripePaymentIds(prisma, body.reference, session);
      }
      const updated = await completeBookingPayment(prisma, body.reference, booking.paymentMethod || "STRIPE");
      if (!updated) return res.status(404).json({ message: "Booking not found" });
      res.json({ booking: serializeBooking(updated) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/member/me", memberAuth, (req: MemberRequest, res) => {
    res.json({ member: sanitizeMember(req.siteMember!) });
  });

  app.get("/api/member/offerings", async (_req, res, next) => {
    try {
      res.json(await getBookableOfferings(prisma));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/member/bookings", memberAuth, async (req: MemberRequest, res, next) => {
    try {
      const rows = await prisma.booking.findMany({
        where: { memberId: req.siteMember!.id },
        orderBy: { createdAt: "desc" }
      });
      res.json({ bookings: rows.map(serializeBooking) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/member/bookings", memberAuth, async (req: MemberRequest, res, next) => {
    try {
      const body = createBookingSchema.parse(req.body);
      const result = await createSiteBooking(prisma, req.siteMember!, body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  /** Who this email belongs to, what they're on, and what to charge them. */
  app.get("/api/admin/bookings/walk-in-lookup", adminAuth, requireAdmin, async (req, res, next) => {
    try {
      const email = typeof req.query.email === "string" ? req.query.email : "";
      if (!email.includes("@")) return res.status(400).json({ message: "A valid email is required" });
      res.json(
        await lookupWalkIn(prisma, email, {
          siteClassId: typeof req.query.siteClassId === "string" ? req.query.siteClassId : undefined,
          siteProgramId:
            typeof req.query.siteProgramId === "string" ? req.query.siteProgramId : undefined
        })
      );
    } catch (error) {
      next(error);
    }
  });

  /** Booking someone in at the counter, with the money already taken. */
  app.post("/api/admin/bookings", adminAuth, requireAdmin, async (req, res, next) => {
    try {
      const body = frontDeskBookingSchema.parse(req.body);
      res.status(201).json(await createFrontDeskBooking(prisma, body));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/bookings/overview", adminAuth, requireAdmin, async (_req, res, next) => {
    try {
      res.json(await getAdminBookingOverview(prisma));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/bookings", adminAuth, requireAdmin, async (req, res, next) => {
    try {
      const siteProgramId = typeof req.query.siteProgramId === "string" ? req.query.siteProgramId : undefined;
      const siteClassId = typeof req.query.siteClassId === "string" ? req.query.siteClassId : undefined;
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const rows = await prisma.booking.findMany({
        where: {
          ...(siteProgramId ? { siteProgramId } : {}),
          ...(siteClassId ? { siteClassId } : {}),
          ...(status && BOOKING_STATUSES.includes(status as typeof BOOKING_STATUSES[number]) ? { status } : {})
        },
        orderBy: { createdAt: "desc" }
      });
      res.json({ bookings: rows.map(serializeBooking) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/bookings/:id/mark-paid", adminAuth, requireAdmin, async (req, res, next) => {
    try {
      const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.status === "PAID") {
        return res.json({ booking: serializeBooking(booking), alreadyPaid: true });
      }
      const updated = await completeBookingPayment(prisma, booking.reference, "PAYNOW");
      if (!updated) return res.status(404).json({ message: "Booking not found" });
      res.json({ booking: serializeBooking(updated) });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/bookings/:id/cancel", adminAuth, requireAdmin, async (req, res, next) => {
    try {
      const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.status === "CANCELLED" || booking.status === "REFUNDED") {
        return res.status(409).json({ message: "Booking is already cancelled or refunded." });
      }
      // Membership and credit bookings are "paid" with an allowance rather than
      // money — there is nothing to refund, so cancelling returns the session or
      // the credits instead.
      const onMembership = booking.paymentMethod === "MEMBERSHIP";
      const onCredits = booking.paymentMethod === "CREDITS";
      if (booking.status === "PAID" && !onMembership && !onCredits) {
        return res.status(400).json({
          message: "Paid bookings must be refunded before cancelling. Use Refund for Stripe/PayNow payments."
        });
      }
      const updated = await prisma.$transaction(async (tx) => {
        if (onMembership && booking.sessionsSpent > 0 && booking.membershipPeriodId) {
          await tx.membershipPeriod.update({
            where: { id: booking.membershipPeriodId },
            data: { sessionsUsed: { decrement: booking.sessionsSpent } }
          });
        }
        if (onCredits && booking.creditsSpent > 0 && booking.creditWalletId) {
          await tx.creditWallet.update({
            where: { id: booking.creditWalletId },
            data: { creditsUsed: { decrement: booking.creditsSpent } }
          });
          // Positive entry, so the wallet history shows the return rather than
          // the spend silently disappearing.
          await tx.creditLedgerEntry.create({
            data: {
              walletId: booking.creditWalletId,
              memberId: booking.memberId,
              bookingId: booking.id,
              credits: booking.creditsSpent,
              reason: `Cancelled — ${booking.offeringTitle}`
            }
          });
        }
        await cancelPayments(tx, booking.id);
        return tx.booking.update({
          where: { id: booking.id },
          data: { status: "CANCELLED", sessionsSpent: 0, creditsSpent: 0 }
        });
      });
      res.json({ booking: serializeBooking(updated) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/bookings/:id/refund", adminAuth, requireAdmin, async (req, res, next) => {
    try {
      const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
      if (!booking) return res.status(404).json({ message: "Booking not found" });

      let updated;
      if (booking.paymentMethod === "STRIPE") {
        updated = await refundStripeBooking(prisma, booking);
      } else if (booking.paymentMethod === "PAYNOW") {
        updated = await markBookingRefundedManual(prisma, booking.id);
      } else {
        return res.status(400).json({
          message: "Only Stripe or PayNow bookings can be refunded from here."
        });
      }

      await refundPayment(prisma, booking.id, {
        providerPaymentRef: booking.stripePaymentIntentId
      }).catch((error) => {
        console.error("[payments] could not record refund:", error);
      });

      res.json({
        booking: serializeBooking(updated),
        message:
          booking.paymentMethod === "PAYNOW"
            ? "Marked as refunded. Send the PayNow refund to the customer manually."
            : "Stripe refund processed."
      });
    } catch (error) {
      next(error);
    }
  });
}
