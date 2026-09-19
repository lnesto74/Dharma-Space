import type { Express, Request, Response } from "express";
import express from "express";
import Stripe from "stripe";
import type { PrismaClient } from "@prisma/client";
import { completeBookingPayment } from "./booking-emails.js";
import { cancelPayments, failPayment } from "./payments/ledger.js";
import {
  CREDIT_PACK_PURCHASE,
  completePackPurchase,
  failPackPurchase,
  voidPackPurchase
} from "./credits/purchase.js";
import {
  MEMBERSHIP_PURCHASE,
  completeMembershipPurchase,
  recordRenewalPayment,
  voidMembershipPurchase
} from "./memberships/purchase.js";
import { addMonths } from "./memberships/lifecycle.js";
import { renewMembershipPeriod } from "./memberships/signup.js";

let stripeClient: Stripe | null = null;

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function stripeWebhookConfigured() {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}

export function parseSgdCents(price: string, guests = 1): number {
  const match = String(price ?? "").replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  if (!match) throw Object.assign(new Error("Invalid price for payment."), { status: 400 });
  const cents = Math.round(parseFloat(match[1]) * 100);
  if (cents < 50) throw Object.assign(new Error("Minimum payment is SGD 0.50."), { status: 400 });
  return cents * Math.max(1, guests);
}

function frontendBaseUrl() {
  return (process.env.FRONTEND_URL || "https://dharma-space.com").replace(/\/$/, "");
}

export async function createStripeCheckoutSession(input: {
  reference: string;
  email: string;
  title: string;
  subtitle?: string;
  priceLabel: string;
  guests?: number;
  siteProgramId?: string | null;
  siteClassId?: string | null;
}) {
  const stripe = getStripe();
  if (!stripe) return null;

  const unitAmount = parseSgdCents(input.priceLabel, 1);
  const quantity = input.guests ?? 1;
  const base = frontendBaseUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.email,
    client_reference_id: input.reference,
    line_items: [
      {
        quantity,
        price_data: {
          currency: "sgd",
          unit_amount: unitAmount,
          product_data: {
            name: input.title,
            description: input.subtitle?.trim() || undefined
          }
        }
      }
    ],
    metadata: {
      bookingReference: input.reference,
      siteProgramId: input.siteProgramId || "",
      siteClassId: input.siteClassId || ""
    },
    success_url: `${base}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
    // Send people back where they came from — classes and programs are
    // different pages now.
    cancel_url: `${base}/${input.siteClassId ? "classes" : "events"}`,
    // Order sets the order Checkout displays them in. PayNow leads because it
    // avoids the fixed per-card fee that bites hardest on a SGD 35 drop-in, and
    // it's the method most Singapore customers expect. Card stays available for
    // anyone without a participating bank app, and for overseas visitors.
    payment_method_types: ["paynow", "card"]
  });

  if (!session.url) {
    throw Object.assign(new Error("Could not start Stripe checkout."), { status: 502 });
  }

  return { url: session.url, sessionId: session.id };
}

/**
 * Checkout for a credit pack. Unlike a booking there is no session to attend —
 * the metadata carries the wallet reserved for the purchase so the webhook can
 * release it without looking anything up by guesswork.
 */
export async function createCreditPackCheckoutSession(input: {
  reference: string;
  email: string;
  packName: string;
  credits: number;
  amountCents: number;
  validMonths: number;
  walletId: string;
  sharedCount?: number;
}) {
  const stripe = getStripe();
  if (!stripe) return null;

  const base = frontendBaseUrl();
  const shared = input.sharedCount
    ? `, shared with ${input.sharedCount} ${input.sharedCount === 1 ? "person" : "people"}`
    : "";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.email,
    client_reference_id: input.reference,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "sgd",
          unit_amount: input.amountCents,
          product_data: {
            name: `${input.packName} — Dharma Space`,
            description: `${input.credits} class credits, valid ${input.validMonths} months${shared}`
          }
        }
      }
    ],
    metadata: {
      purchaseType: CREDIT_PACK_PURCHASE,
      purchaseReference: input.reference,
      creditWalletId: input.walletId
    },
    success_url: `${base}/credits/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/classes`,
    payment_method_types: ["paynow", "card"]
  });

  if (!session.url) {
    throw Object.assign(new Error("Could not start Stripe checkout."), { status: 502 });
  }

  return { url: session.url, sessionId: session.id };
}

/**
 * Memberships bill themselves every month, which PayNow cannot do — it is a
 * one-off push payment with nothing to charge against next month. So this is a
 * card-only Stripe subscription, and the studio's PayNow option stays where it
 * works: drop-ins and credit packs.
 */
export async function createMembershipCheckoutSession(input: {
  reference: string;
  email: string;
  tierId: string;
  tierName: string;
  amountCents: number;
  includedSessions: number | null;
  rateHeldMonths: number | null;
}) {
  const stripe = getStripe();
  if (!stripe) return null;

  const base = frontendBaseUrl();
  const included =
    input.includedSessions === null
      ? "Unlimited classes"
      : `${input.includedSessions} classes a month`;
  const held = input.rateHeldMonths
    ? `, rate held for ${input.rateHeldMonths} months`
    : "";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: input.email,
    client_reference_id: input.reference,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "sgd",
          unit_amount: input.amountCents,
          recurring: { interval: "month" },
          product_data: {
            name: `${input.tierName} — Dharma Space`,
            description: `${included}${held}`
          }
        }
      }
    ],
    metadata: {
      purchaseType: MEMBERSHIP_PURCHASE,
      purchaseReference: input.reference,
      membershipTierId: input.tierId
    },
    // Copied onto the subscription so renewal invoices, which carry no session,
    // can still be traced back to the plan that was bought.
    subscription_data: {
      metadata: {
        purchaseType: MEMBERSHIP_PURCHASE,
        purchaseReference: input.reference,
        membershipTierId: input.tierId
      }
    },
    success_url: `${base}/memberships/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/classes`,
    payment_method_types: ["card"]
  });

  if (!session.url) {
    throw Object.assign(new Error("Could not start Stripe checkout."), { status: 502 });
  }

  return { url: session.url, sessionId: session.id };
}

function paymentIntentIdFromSession(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

export async function syncStripePaymentIds(
  prisma: PrismaClient,
  reference: string,
  session: Stripe.Checkout.Session
) {
  const paymentIntentId = paymentIntentIdFromSession(session);
  if (!session.id && !paymentIntentId) return;

  await prisma.booking.updateMany({
    where: { reference },
    data: {
      ...(session.id ? { stripeSessionId: session.id } : {}),
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {})
    }
  });
}

async function resolvePaymentIntentId(booking: {
  reference: string;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
}): Promise<string | null> {
  if (booking.stripePaymentIntentId) return booking.stripePaymentIntentId;

  const stripe = getStripe();
  if (!stripe) return null;

  if (booking.stripeSessionId) {
    const session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId);
    const paymentIntentId = paymentIntentIdFromSession(session);
    if (paymentIntentId) return paymentIntentId;
  }

  const sessions = await stripe.checkout.sessions.list({ limit: 100 });
  const hit = sessions.data.find((session) => session.client_reference_id === booking.reference);
  if (!hit) return null;
  return paymentIntentIdFromSession(hit);
}

export async function refundStripeBooking(
  prisma: PrismaClient,
  booking: {
    id: string;
    reference: string;
    status: string;
    paymentMethod: string | null;
    refundedAt: Date | null;
    stripeSessionId: string | null;
    stripePaymentIntentId: string | null;
  }
) {
  if (booking.status !== "PAID") {
    throw Object.assign(new Error("Only paid bookings can be refunded."), { status: 400 });
  }
  if (booking.refundedAt) {
    throw Object.assign(new Error("This booking was already refunded."), { status: 409 });
  }

  const stripe = getStripe();
  if (!stripe) {
    throw Object.assign(new Error("Stripe is not configured."), { status: 503 });
  }

  const paymentIntentId = await resolvePaymentIntentId(booking);
  if (!paymentIntentId) {
    throw Object.assign(
      new Error("Could not find the Stripe payment for this booking. Refund manually in Stripe Dashboard."),
      { status: 404 }
    );
  }

  await stripe.refunds.create({ payment_intent: paymentIntentId });

  return prisma.booking.update({
    where: { id: booking.id },
    data: { status: "REFUNDED", refundedAt: new Date() }
  });
}

export async function markBookingRefundedManual(prisma: PrismaClient, bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw Object.assign(new Error("Booking not found"), { status: 404 });
  if (booking.status !== "PAID") {
    throw Object.assign(new Error("Only paid bookings can be marked refunded."), { status: 400 });
  }
  if (booking.refundedAt) {
    throw Object.assign(new Error("This booking was already refunded."), { status: 409 });
  }

  return prisma.booking.update({
    where: { id: bookingId },
    data: { status: "REFUNDED", refundedAt: new Date() }
  });
}

export async function markBookingPaidByReference(prisma: PrismaClient, reference: string) {
  return completeBookingPayment(prisma, reference, "STRIPE");
}

/**
 * The booking stays AWAITING_PAYMENT so the customer can retry — only the
 * payment attempt is marked failed, with the reason kept for support.
 */
export async function markBookingPaymentFailed(
  prisma: PrismaClient,
  reference: string,
  reason: string
) {
  const booking = await prisma.booking.findUnique({ where: { reference } });
  if (!booking) return;
  await failPayment(prisma, booking.id, reason);
}

/** Abandoned checkout — stop the attempt showing as money still owed. */
export async function voidBookingPayment(prisma: PrismaClient, reference: string) {
  const booking = await prisma.booking.findUnique({ where: { reference } });
  if (!booking) return;
  await cancelPayments(prisma, booking.id);
}

export async function verifyCheckoutSessionPaid(sessionId: string, expectedReference: string) {
  const stripe = getStripe();
  if (!stripe) return false;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.client_reference_id !== expectedReference) return false;
  return session.payment_status === "paid";
}

export async function retrieveCheckoutSession(sessionId: string) {
  const stripe = getStripe();
  if (!stripe) return null;
  return stripe.checkout.sessions.retrieve(sessionId);
}

async function handleCreditPackEvent(
  prisma: PrismaClient,
  eventType: string,
  reference: string,
  session: Stripe.Checkout.Session
) {
  switch (eventType) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      if (session.payment_status !== "paid") return;
      await completePackPurchase(prisma, reference, {
        providerRef: session.id,
        providerPaymentRef: paymentIntentIdFromSession(session)
      });
      break;
    }
    case "checkout.session.async_payment_failed": {
      await failPackPurchase(prisma, reference, "Payment failed at Stripe.");
      break;
    }
    case "checkout.session.expired": {
      await voidPackPurchase(prisma, reference);
      break;
    }
  }
}

function subscriptionIdFromSession(session: Stripe.Checkout.Session): string | null {
  const sub = session.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

async function handleMembershipEvent(
  prisma: PrismaClient,
  eventType: string,
  reference: string,
  session: Stripe.Checkout.Session
) {
  switch (eventType) {
    case "checkout.session.completed": {
      // Subscriptions report `paid` on the first invoice; anything else means
      // the card did not go through and no membership should exist yet.
      if (session.payment_status !== "paid") return;
      await completeMembershipPurchase(prisma, reference, {
        tierId: session.metadata?.membershipTierId ?? null,
        providerRef: session.id,
        providerPaymentRef: paymentIntentIdFromSession(session),
        subscriptionId: subscriptionIdFromSession(session)
      });
      break;
    }
    case "checkout.session.async_payment_failed": {
      await voidMembershipPurchase(prisma, reference, "FAILED");
      break;
    }
    case "checkout.session.expired": {
      await voidMembershipPurchase(prisma, reference, "CANCELLED");
      break;
    }
  }
}

/**
 * Renewals, and the two ways a subscription stops.
 *
 * These arrive without a checkout session, so the subscription id is the only
 * thread back to the membership. The first invoice of a subscription is skipped
 * — the signup path has already accounted for that month.
 */
async function handleSubscriptionEvent(prisma: PrismaClient, event: Stripe.Event) {
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    await prisma.membership.updateMany({
      where: { stripeSubscriptionId: subscription.id, status: { not: "CANCELLED" } },
      data: { status: "CANCELLED", cancelEffectiveAt: new Date() }
    });
    return;
  }

  const invoice = event.data.object as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
    billing_reason?: string | null;
  };
  const subscriptionId =
    typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
  if (!subscriptionId) return;

  const membership = await prisma.membership.findFirst({
    where: { stripeSubscriptionId: subscriptionId }
  });
  if (!membership) return;

  if (event.type === "invoice.payment_failed") {
    await prisma.membership.update({
      where: { id: membership.id },
      data: { status: "PAYMENT_FAILED" }
    });
    return;
  }

  // invoice.paid
  if (invoice.billing_reason === "subscription_create") return;

  const line = invoice.lines?.data?.[0];
  const start = line?.period?.start ? new Date(line.period.start * 1000) : new Date();
  const end = line?.period?.end
    ? new Date(line.period.end * 1000)
    : addMonths(start, 1);

  await renewMembershipPeriod(prisma, membership.id, start, end);
  await recordRenewalPayment(prisma, membership.id, {
    memberId: membership.memberId,
    amountCents: invoice.amount_paid ?? 0,
    invoiceId: invoice.id ?? `${subscriptionId}-${start.getTime()}`
  });
}

export function registerStripeWebhook(app: Express, getPrisma: () => PrismaClient) {
  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
      const stripe = getStripe();
      if (!secret || !stripe) {
        return res.status(503).json({ message: "Stripe webhook not configured" });
      }

      const signature = req.headers["stripe-signature"];
      if (!signature || Array.isArray(signature)) {
        return res.status(400).json({ message: "Missing Stripe signature" });
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(req.body, signature, secret);
      } catch (err) {
        console.error("[stripe webhook] signature verification failed:", err);
        return res.status(400).json({ message: "Invalid webhook signature" });
      }

      try {
        // Renewals and cancellations arrive as invoice and subscription events,
        // which carry no checkout session at all.
        if (
          event.type === "invoice.paid" ||
          event.type === "invoice.payment_failed" ||
          event.type === "customer.subscription.deleted"
        ) {
          await handleSubscriptionEvent(getPrisma(), event);
          return res.json({ received: true });
        }

        const session = event.data.object as Stripe.Checkout.Session;
        const reference = session.client_reference_id || session.metadata?.bookingReference;

        // Credits are bought without a booking, so they settle down their own
        // path rather than through the booking lifecycle.
        if (session.metadata?.purchaseType === CREDIT_PACK_PURCHASE) {
          const packRef = session.metadata.purchaseReference || reference;
          if (packRef) await handleCreditPackEvent(getPrisma(), event.type, packRef, session);
          return res.json({ received: true });
        }

        if (session.metadata?.purchaseType === MEMBERSHIP_PURCHASE) {
          const memberRef = session.metadata.purchaseReference || reference;
          if (memberRef) await handleMembershipEvent(getPrisma(), event.type, memberRef, session);
          return res.json({ received: true });
        }

        switch (event.type) {
          // PayNow can settle after the customer has closed the tab, so the
          // paid signal may arrive as an async event rather than on completion.
          // Both paths lead to the same place.
          case "checkout.session.completed":
          case "checkout.session.async_payment_succeeded": {
            if (reference && session.payment_status === "paid") {
              await syncStripePaymentIds(getPrisma(), reference, session);
              await markBookingPaidByReference(getPrisma(), reference);
            }
            break;
          }
          case "checkout.session.async_payment_failed": {
            if (reference) await markBookingPaymentFailed(getPrisma(), reference, "Payment failed at Stripe.");
            break;
          }
          case "checkout.session.expired": {
            if (reference) await voidBookingPayment(getPrisma(), reference);
            break;
          }
        }
        res.json({ received: true });
      } catch (err) {
        console.error("[stripe webhook] handler error:", err);
        res.status(500).json({ message: "Webhook handler failed" });
      }
    }
  );
}

export function stripeStatusPayload() {
  return {
    configured: stripeConfigured(),
    webhookConfigured: stripeWebhookConfigured()
  };
}
