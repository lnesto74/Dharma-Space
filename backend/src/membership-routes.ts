/**
 * Public and member-facing routes for memberships: what's on sale, joining a
 * plan, and what the member is currently on.
 *
 * Admin routes for starting a membership at the desk live in
 * `admin-membership-routes.ts`; both ends share the rules in
 * `memberships/signup.ts` so neither can sell a plan the other wouldn't.
 */

import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { createMemberAuth, type MemberRequest } from "./site-bookings.js";
import {
  attachCheckoutUrl,
  completeMembershipPurchase,
  listTiersForSale,
  startMembershipPurchase,
  voidMembershipPurchase
} from "./memberships/purchase.js";
import { effectivePriceCents, sessionsRemaining } from "./memberships/lifecycle.js";
import { isFixedTerm } from "./memberships/tiers.js";
import { formatCents } from "./payments/money.js";
import {
  createMembershipCheckoutSession,
  retrieveCheckoutSession,
  stripeConfigured
} from "./stripe.js";

const checkoutSchema = z.object({ tierId: z.string().min(1) });

const confirmSchema = z.object({
  reference: z.string().min(3).optional(),
  sessionId: z.string().min(3).optional()
});

export function registerMembershipRoutes(app: Express, prisma: PrismaClient, jwtSecret: string) {
  const memberAuth = createMemberAuth(prisma, jwtSecret);

  app.get("/api/site/membership-tiers", async (_req, res, next) => {
    try {
      res.json({ tiers: await listTiersForSale(prisma), stripeReady: stripeConfigured() });
    } catch (error) {
      next(error);
    }
  });

  /** The member's own plan, for showing "you're on this one" beside the prices. */
  app.get("/api/member/membership", memberAuth, async (req: MemberRequest, res, next) => {
    try {
      const membership = await prisma.membership.findFirst({
        where: { memberId: req.siteMember!.id, status: { notIn: ["CANCELLED"] } },
        include: { tier: true, periods: { orderBy: { periodStart: "desc" }, take: 1 } }
      });
      if (!membership || !membership.tier) return res.json({ membership: null });

      const period = membership.periods[0];
      const priceCents = effectivePriceCents(
        membership.tier.monthlyPriceCents,
        membership.priceCentsOverride,
        membership.rateHeldUntil,
        new Date()
      );

      res.json({
        membership: {
          id: membership.id,
          status: membership.status,
          tierId: membership.tierId,
          tierName: membership.tier.name,
          priceCents,
          price: formatCents(priceCents),
          currentPeriodEnd: membership.currentPeriodEnd,
          sessionsRemaining: period ? sessionsRemaining(period) : null,
          unlimited: membership.tier.includedSessionsPerMonth === null,
          // A pass ends on its date; a plan renews on it. The difference is
          // the whole message, so the date alone isn't enough to send.
          renews: !isFixedTerm(membership.tier),
          termDays: membership.tier.termDays
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/member/memberships/checkout", memberAuth, async (req: MemberRequest, res, next) => {
    try {
      const body = checkoutSchema.parse(req.body);
      if (!stripeConfigured()) {
        return res.status(503).json({
          message:
            "Card payment isn't available right now. Please contact us on WhatsApp to start a membership."
        });
      }

      const started = await startMembershipPurchase(prisma, req.siteMember!, body);
      const tier = await prisma.membershipTier.findUnique({ where: { id: started.tier.id } });

      const session = await createMembershipCheckoutSession({
        reference: started.reference,
        email: req.siteMember!.email,
        tierId: started.tier.id,
        tierName: started.tier.name,
        amountCents: started.amountCents,
        includedSessions: tier?.includedSessionsPerMonth ?? null,
        rateHeldMonths: started.tier.rateHeldMonths,
        termDays: started.tier.termDays
      });

      if (!session) {
        await voidMembershipPurchase(prisma, started.reference, "CANCELLED");
        return res.status(503).json({ message: "Could not start checkout. Please try again." });
      }

      await attachCheckoutUrl(prisma, started.reference, session.url);

      res.status(201).json({
        reference: started.reference,
        checkoutUrl: session.url,
        tier: started.tier
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Called when the browser lands back from Stripe, as a head start on the
   * webhook rather than something the membership depends on.
   */
  app.post(
    "/api/member/memberships/confirm-return",
    memberAuth,
    async (req: MemberRequest, res, next) => {
      try {
        const body = confirmSchema.parse(req.body);
        let reference = body.reference ?? "";
        let tierId: string | null = null;
        let subscriptionId: string | null = null;
        let providerPaymentRef: string | null = null;

        if (body.sessionId) {
          const session = await retrieveCheckoutSession(body.sessionId);
          if (!session) return res.status(503).json({ message: "Could not reach Stripe." });
          if (session.payment_status !== "paid") {
            return res.status(402).json({
              message: "Payment hasn't completed yet. We'll email you as soon as it does."
            });
          }
          reference =
            session.metadata?.purchaseReference || session.client_reference_id || reference;
          tierId = session.metadata?.membershipTierId ?? null;
          const sub = session.subscription;
          subscriptionId = typeof sub === "string" ? sub : sub?.id ?? null;
          const pi = session.payment_intent;
          providerPaymentRef = typeof pi === "string" ? pi : pi?.id ?? null;
        }

        if (!reference) return res.status(400).json({ message: "Missing purchase reference." });

        // Only the buyer may settle their own signup.
        const payment = await prisma.payment.findFirst({
          where: { reference, kind: "MEMBERSHIP" }
        });
        if (!payment || payment.memberId !== req.siteMember!.id) {
          return res.status(404).json({ message: "Purchase not found." });
        }

        const result = await completeMembershipPurchase(prisma, reference, {
          tierId,
          providerRef: body.sessionId,
          providerPaymentRef,
          subscriptionId
        });
        if (!result) return res.status(404).json({ message: "Purchase not found." });

        res.json({
          membershipId: result.membershipId,
          tierName: result.tierName,
          termDays: result.termDays,
          alreadyStarted: result.alreadyStarted
        });
      } catch (error) {
        next(error);
      }
    }
  );
}
