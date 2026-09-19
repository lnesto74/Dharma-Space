/**
 * Public and member-facing routes for credit packs: what's on sale, buying one,
 * seeing the balance, and managing who else may spend from it.
 *
 * Admin routes for selling a pack at the counter live with the other admin
 * membership routes; this file is only what the marketing site talks to.
 */

import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { createMemberAuth, type MemberRequest } from "./site-bookings.js";
import {
  completePackPurchase,
  listPacksForSale,
  memberCreditSummary,
  shareWallet,
  startPackPurchase,
  unshareWallet,
  voidPackPurchase
} from "./credits/purchase.js";
import {
  createCreditPackCheckoutSession,
  retrieveCheckoutSession,
  stripeConfigured
} from "./stripe.js";

const checkoutSchema = z.object({
  packId: z.string().min(1),
  // The buyer names who else may spend from the pack. Absent means just them.
  shareEmails: z.array(z.string().email()).max(10).optional()
});

const shareSchema = z.object({ email: z.string().email() });

const confirmSchema = z.object({
  reference: z.string().min(3).optional(),
  sessionId: z.string().min(3).optional()
});

export function registerCreditRoutes(app: Express, prisma: PrismaClient, jwtSecret: string) {
  const memberAuth = createMemberAuth(prisma, jwtSecret);

  app.get("/api/site/credit-packs", async (_req, res, next) => {
    try {
      res.json({ packs: await listPacksForSale(prisma), stripeReady: stripeConfigured() });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/member/credits/checkout", memberAuth, async (req: MemberRequest, res, next) => {
    try {
      const body = checkoutSchema.parse(req.body);
      if (!stripeConfigured()) {
        return res.status(503).json({
          message: "Card payment isn't available right now. Please contact us on WhatsApp to buy credits."
        });
      }

      const started = await startPackPurchase(prisma, req.siteMember!, body);
      const session = await createCreditPackCheckoutSession({
        reference: started.reference,
        email: req.siteMember!.email,
        packName: started.pack.name,
        credits: started.pack.credits,
        amountCents: started.amountCents,
        validMonths: started.pack.validMonths,
        walletId: started.walletId,
        sharedCount: started.sharedWith.length
      });

      if (!session) {
        // Release the wallet we reserved — nothing will ever pay for it.
        await voidPackPurchase(prisma, started.reference);
        return res.status(503).json({ message: "Could not start checkout. Please try again." });
      }

      res.status(201).json({
        reference: started.reference,
        checkoutUrl: session.url,
        pack: started.pack,
        sharedWith: started.sharedWith
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Called when the browser lands back from Stripe. PayNow can settle after the
   * tab closes, so this is a best-effort head start on the webhook rather than
   * the thing the purchase depends on.
   */
  app.post("/api/member/credits/confirm-return", memberAuth, async (req: MemberRequest, res, next) => {
    try {
      const body = confirmSchema.parse(req.body);
      let reference = body.reference ?? "";
      let providerPaymentRef: string | null = null;

      if (body.sessionId) {
        const session = await retrieveCheckoutSession(body.sessionId);
        if (!session) return res.status(503).json({ message: "Could not reach Stripe." });
        if (session.payment_status !== "paid") {
          return res.status(402).json({
            message: "Payment hasn't completed yet. We'll email you as soon as it does."
          });
        }
        reference = session.metadata?.purchaseReference || session.client_reference_id || reference;
        const pi = session.payment_intent;
        providerPaymentRef = typeof pi === "string" ? pi : pi?.id ?? null;
      }

      if (!reference) return res.status(400).json({ message: "Missing purchase reference." });

      const wallet = await prisma.creditWallet.findUnique({ where: { purchaseRef: reference } });
      if (!wallet || wallet.ownerId !== req.siteMember!.id) {
        return res.status(404).json({ message: "Purchase not found." });
      }

      const result = await completePackPurchase(prisma, reference, {
        providerRef: body.sessionId,
        providerPaymentRef
      });
      if (!result) return res.status(404).json({ message: "Purchase not found." });

      res.json({
        credits: result.credits,
        packName: result.packName,
        expiresAt: result.expiresAt.toISOString(),
        summary: await memberCreditSummary(prisma, req.siteMember!.id)
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/member/credits", memberAuth, async (req: MemberRequest, res, next) => {
    try {
      res.json(await memberCreditSummary(prisma, req.siteMember!.id));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/member/credits/:walletId/share", memberAuth, async (req: MemberRequest, res, next) => {
    try {
      const body = shareSchema.parse(req.body);
      const person = await shareWallet(prisma, req.siteMember!, req.params.walletId, body.email);
      res.status(201).json({
        person,
        summary: await memberCreditSummary(prisma, req.siteMember!.id)
      });
    } catch (error) {
      next(error);
    }
  });

  app.delete(
    "/api/member/credits/:walletId/share/:memberId",
    memberAuth,
    async (req: MemberRequest, res, next) => {
      try {
        await unshareWallet(prisma, req.siteMember!, req.params.walletId, req.params.memberId);
        res.json({ summary: await memberCreditSummary(prisma, req.siteMember!.id) });
      } catch (error) {
        next(error);
      }
    }
  );
}
