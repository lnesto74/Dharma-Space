import type { Express, Request, Response } from "express";
import express from "express";
import Stripe from "stripe";
import type { PrismaClient } from "@prisma/client";
import { completeBookingPayment } from "./booking-emails.js";

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
    cancel_url: `${base}/events`,
    payment_method_types: ["card", "paynow"]
  });

  if (!session.url) {
    throw Object.assign(new Error("Could not start Stripe checkout."), { status: 502 });
  }

  return { url: session.url, sessionId: session.id };
}

export async function markBookingPaidByReference(prisma: PrismaClient, reference: string) {
  return completeBookingPayment(prisma, reference, "STRIPE");
}

export async function verifyCheckoutSessionPaid(sessionId: string, expectedReference: string) {
  const stripe = getStripe();
  if (!stripe) return false;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.client_reference_id !== expectedReference) return false;
  return session.payment_status === "paid";
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
        if (event.type === "checkout.session.completed") {
          const session = event.data.object as Stripe.Checkout.Session;
          const reference = session.client_reference_id || session.metadata?.bookingReference;
          if (reference && session.payment_status === "paid") {
            await markBookingPaidByReference(getPrisma(), reference);
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
