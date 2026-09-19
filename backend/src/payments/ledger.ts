/**
 * The payment ledger.
 *
 * Every attempt to collect money — card, PayNow, cash at the counter, or a
 * membership allowance — becomes a Payment row here, regardless of provider.
 * Booking rows keep their own status for the booking lifecycle; this module is
 * the record of the money.
 *
 * Adding a provider (a POS terminal, a new gateway) means calling `openPayment`
 * with a new provider name and settling it with `settlePayment` when its webhook
 * arrives. No schema change, no edits to the booking flow.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

export const PAYMENT_PROVIDERS = [
  "STRIPE",
  "QASHIER",
  "PAYNOW",
  "CASH",
  "MEMBERSHIP",
  "CREDITS",
  "MANUAL"
] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_METHODS = [
  "CARD",
  "PAYNOW",
  "CASH",
  "MEMBERSHIP",
  "CREDITS",
  "OTHER"
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED", "CANCELLED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Accepts a transaction client so callers can keep payments in their own transaction. */
type Db = PrismaClient | Prisma.TransactionClient;

/**
 * The booking's legacy `paymentMethod` string mapped onto the provider/method
 * pair. Kept in one place so the old values keep working while the ledger takes
 * over as the source of truth.
 */
export function providerFromLegacyMethod(
  legacy: string | null | undefined
): { provider: PaymentProvider; method: PaymentMethod } {
  switch (legacy) {
    case "STRIPE":
      return { provider: "STRIPE", method: "CARD" };
    case "PAYNOW":
      return { provider: "PAYNOW", method: "PAYNOW" };
    case "QASHIER":
      return { provider: "QASHIER", method: "CARD" };
    case "CASH":
      return { provider: "CASH", method: "CASH" };
    case "MEMBERSHIP":
      return { provider: "MEMBERSHIP", method: "MEMBERSHIP" };
    default:
      return { provider: "MANUAL", method: "OTHER" };
  }
}

export type OpenPaymentInput = {
  /** Null for money that isn't a booking — a credit pack, or a counter sale. */
  bookingId: string | null;
  memberId?: string | null;
  reference: string;
  provider: PaymentProvider;
  method: PaymentMethod;
  amountCents: number;
  currency?: string;
  providerRef?: string | null;
  checkoutUrl?: string | null;
  /** Settled immediately — cash taken at the counter, or a membership session. */
  paid?: boolean;
};

/**
 * Records a payment attempt. Idempotent on `reference`: replaying a webhook or a
 * double-submitted form updates the existing row instead of creating a second
 * charge record for the same booking.
 */
export async function openPayment(db: Db, input: OpenPaymentInput) {
  const existing = await db.payment.findFirst({
    where: { reference: input.reference, bookingId: input.bookingId }
  });

  const data = {
    bookingId: input.bookingId,
    memberId: input.memberId ?? null,
    reference: input.reference,
    provider: input.provider,
    method: input.method,
    amountCents: input.amountCents,
    currency: input.currency ?? "SGD",
    providerRef: input.providerRef ?? null,
    checkoutUrl: input.checkoutUrl ?? null,
    status: input.paid ? "PAID" : "PENDING",
    paidAt: input.paid ? new Date() : null
  };

  if (existing) {
    return db.payment.update({ where: { id: existing.id }, data });
  }
  return db.payment.create({ data });
}

/**
 * Marks the booking's outstanding payment as paid. Called from the single point
 * where bookings transition to PAID, so every rail settles the same way.
 *
 * If no pending row exists — an older booking, or one paid out of band — one is
 * written after the fact so the ledger still has a record of the money.
 */
export async function settlePayment(
  db: Db,
  booking: { id: string; reference: string; memberId: string | null; price: string },
  opts: {
    provider: PaymentProvider;
    method: PaymentMethod;
    amountCents: number;
    providerRef?: string | null;
    providerPaymentRef?: string | null;
  }
) {
  const pending = await db.payment.findFirst({
    where: { bookingId: booking.id, status: "PENDING" },
    orderBy: { createdAt: "desc" }
  });

  const settled = {
    status: "PAID",
    paidAt: new Date(),
    provider: opts.provider,
    method: opts.method,
    ...(opts.providerRef ? { providerRef: opts.providerRef } : {}),
    ...(opts.providerPaymentRef ? { providerPaymentRef: opts.providerPaymentRef } : {})
  };

  if (pending) {
    return db.payment.update({ where: { id: pending.id }, data: settled });
  }

  return db.payment.create({
    data: {
      bookingId: booking.id,
      memberId: booking.memberId,
      reference: booking.reference,
      amountCents: opts.amountCents,
      ...settled
    }
  });
}

/** Records a refund against the booking's paid payment. */
export async function refundPayment(
  db: Db,
  bookingId: string,
  opts: { amountCents?: number; providerPaymentRef?: string | null } = {}
) {
  const paid = await db.payment.findFirst({
    where: { bookingId, status: "PAID" },
    orderBy: { paidAt: "desc" }
  });
  if (!paid) return null;

  return db.payment.update({
    where: { id: paid.id },
    data: {
      status: "REFUNDED",
      refundedAt: new Date(),
      refundedAmountCents: opts.amountCents ?? paid.amountCents,
      ...(opts.providerPaymentRef ? { providerPaymentRef: opts.providerPaymentRef } : {})
    }
  });
}

/** Records a payment the provider told us failed, keeping the reason for support. */
export async function failPayment(db: Db, bookingId: string, reason: string) {
  await db.payment.updateMany({
    where: { bookingId, status: "PENDING" },
    data: { status: "FAILED", failureReason: reason.slice(0, 500) }
  });
}

/**
 * Voids payments that will never be collected, so abandoned checkouts don't sit
 * in the ledger as pending money forever.
 */
export async function cancelPayments(db: Db, bookingId: string) {
  await db.payment.updateMany({
    where: { bookingId, status: "PENDING" },
    data: { status: "CANCELLED" }
  });
}

/** The payment that best represents how a booking was settled, for display. */
export function primaryPayment<T extends { status: string; createdAt: Date }>(
  payments: T[]
): T | null {
  if (!payments.length) return null;
  const rank = (s: string) => (s === "PAID" ? 0 : s === "REFUNDED" ? 1 : s === "PENDING" ? 2 : 3);
  return [...payments].sort(
    (a, b) => rank(a.status) - rank(b.status) || b.createdAt.getTime() - a.createdAt.getTime()
  )[0];
}
