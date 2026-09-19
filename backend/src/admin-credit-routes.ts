/**
 * Admin routes for credit packs: what's on sale, who's holding credits, and
 * selling a pack across the front desk.
 *
 * The counter sale is the reason this exists. Someone pays by card on the
 * Qashier terminal or by PayNow on the spot, and the studio needs those credits
 * usable before the person has walked to the changing room — no Stripe session,
 * no waiting on a webhook.
 */

import type { Express, NextFunction, Request, Response } from "express";
import type { PrismaClient, User } from "@prisma/client";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { CREDIT_COSTS, CREDIT_VALID_MONTHS, centsPerCredit } from "./credits/packs.js";
import { recordCounterPackSale } from "./credits/purchase.js";
import { creditsRemaining, isExpired } from "./credits/wallet.js";
import { formatCents } from "./payments/money.js";

type AuthedRequest = Request & { user?: User };

const packBodySchema = z.object({
  name: z.string().min(2),
  credits: z.number().int().min(1),
  priceCents: z.number().int().min(0),
  validMonths: z.number().int().min(1).max(36).default(CREDIT_VALID_MONTHS),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0)
});

/** Someone who paid in the studio and may never have used the website. */
const newMemberSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional()
});

const counterSaleSchema = z
  .object({
    memberId: z.string().min(1).optional(),
    newMember: newMemberSchema.optional(),
    packId: z.string().min(1),
    provider: z.enum(["QASHIER", "CASH", "PAYNOW", "MANUAL"]).default("QASHIER"),
    method: z.enum(["CARD", "CASH", "PAYNOW", "OTHER"]).default("CARD"),
    shareEmails: z.array(z.string().email()).max(5).default([])
  })
  .refine((v) => Boolean(v.memberId) || Boolean(v.newMember), {
    message: "Select an existing member or enter a new person's details."
  });

function packView(pack: {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  validMonths: number;
  isActive: boolean;
  sortOrder: number;
}) {
  return {
    ...pack,
    price: formatCents(pack.priceCents),
    perCreditCents: centsPerCredit(pack),
    perCredit: formatCents(centsPerCredit(pack)),
    // What a pack buys, so the desk can answer "how many classes is that?"
    classesPerCategory: Object.fromEntries(
      Object.entries(CREDIT_COSTS).map(([category, cost]) => [
        category,
        Math.floor(pack.credits / cost)
      ])
    )
  };
}

export function registerAdminCreditRoutes(
  app: Express,
  prisma: PrismaClient,
  auth: (req: AuthedRequest, res: Response, next: NextFunction) => void,
  requireRole: (...roles: string[]) => (req: AuthedRequest, res: Response, next: NextFunction) => void
) {
  const superAdmin = requireRole("SUPER_ADMIN");

  // ── Overview: packs on sale, and the money and credits outstanding ─────────

  app.get("/api/admin/site/credit-packs/overview", auth, superAdmin, async (_req, res, next) => {
    try {
      const now = new Date();
      const [packs, wallets] = await Promise.all([
        prisma.creditPack.findMany({ orderBy: { sortOrder: "asc" } }),
        prisma.creditWallet.findMany({
          where: { status: { in: ["ACTIVE", "PENDING"] } },
          select: { creditsTotal: true, creditsUsed: true, expiresAt: true, status: true }
        })
      ]);

      const active = wallets.filter((w) => w.status === "ACTIVE" && !isExpired(w as never, now));
      const outstanding = active.reduce((sum, w) => sum + creditsRemaining(w as never), 0);
      const lapsingSoon = active.filter(
        (w) => w.expiresAt.getTime() - now.getTime() < 1000 * 60 * 60 * 24 * 60
      );

      const sold = await prisma.payment.aggregate({
        where: { kind: "CREDIT_PACK", status: "PAID" },
        _sum: { amountCents: true },
        _count: true
      });

      res.json({
        packs: packs.map(packView),
        stats: {
          activeWallets: active.length,
          pendingWallets: wallets.filter((w) => w.status === "PENDING").length,
          creditsOutstanding: outstanding,
          walletsLapsingIn60Days: lapsingSoon.length,
          packsSold: sold._count,
          revenue: formatCents(sold._sum.amountCents ?? 0)
        },
        costs: CREDIT_COSTS
      });
    } catch (error) {
      next(error);
    }
  });

  // ── Packs on sale ──────────────────────────────────────────────────────────

  app.post("/api/admin/site/credit-packs", auth, superAdmin, async (req, res, next) => {
    try {
      const parsed = packBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid pack" });
      }
      const pack = await prisma.creditPack.create({ data: parsed.data });
      res.status(201).json({ pack: packView(pack) });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin/site/credit-packs/:id", auth, superAdmin, async (req, res, next) => {
    try {
      const parsed = packBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid pack" });
      }
      const pack = await prisma.creditPack.update({
        where: { id: req.params.id },
        data: parsed.data
      });
      res.json({ pack: packView(pack) });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Packs are never deleted, only retired. Wallets point back at the pack they
   * came from, and a member's history shouldn't lose its name because the
   * studio stopped selling it.
   */
  app.delete("/api/admin/site/credit-packs/:id", auth, superAdmin, async (req, res, next) => {
    try {
      const pack = await prisma.creditPack.update({
        where: { id: req.params.id },
        data: { isActive: false }
      });
      res.json({ pack: packView(pack) });
    } catch (error) {
      next(error);
    }
  });

  // ── Who is holding credits ─────────────────────────────────────────────────

  app.get("/api/admin/site/credit-wallets", auth, superAdmin, async (req, res, next) => {
    try {
      const search = String(req.query.search || "").trim().toLowerCase();
      const status = String(req.query.status || "ACTIVE").toUpperCase();
      const now = new Date();

      const wallets = await prisma.creditWallet.findMany({
        where: {
          ...(status === "ALL" ? {} : { status }),
          ...(search
            ? {
                owner: {
                  OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { email: { contains: search, mode: "insensitive" } }
                  ]
                }
              }
            : {})
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          pack: { select: { name: true } },
          sharedWith: { include: { member: { select: { id: true, name: true, email: true } } } }
        },
        orderBy: { expiresAt: "asc" },
        take: 200
      });

      res.json({
        wallets: wallets.map((wallet) => ({
          id: wallet.id,
          packName: wallet.pack?.name || "Credit pack",
          owner: wallet.owner,
          creditsTotal: wallet.creditsTotal,
          creditsUsed: wallet.creditsUsed,
          creditsLeft: wallet.creditsTotal - wallet.creditsUsed,
          purchasedAt: wallet.purchasedAt,
          expiresAt: wallet.expiresAt,
          expired: isExpired(wallet as never, now),
          status: wallet.status,
          sharedWith: wallet.sharedWith.map((s) => s.member).filter(Boolean),
          notes: wallet.notes
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  // ── Selling a pack at the front desk ───────────────────────────────────────

  app.post("/api/admin/site/credit-packs/sell", auth, superAdmin, async (req, res, next) => {
    try {
      const parsed = counterSaleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid sale" });
      }
      const body = parsed.data;

      const pack = await prisma.creditPack.findUnique({ where: { id: body.packId } });
      if (!pack) return res.status(404).json({ message: "Pack not found" });

      // Either an existing website account, or a walk-in being added by hand.
      // Admin-created accounts get a random password; the person sets their own
      // through the website's reset when they first sign in.
      let member;
      if (body.memberId) {
        member = await prisma.siteMember.findUnique({ where: { id: body.memberId } });
        if (!member) return res.status(404).json({ message: "Member not found" });
      } else {
        const email = body.newMember!.email.toLowerCase().trim();
        member = await prisma.siteMember.findUnique({ where: { email } });
        if (!member) {
          member = await prisma.siteMember.create({
            data: {
              name: body.newMember!.name.trim(),
              email,
              phone: body.newMember!.phone?.trim() || null,
              passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 12)
            }
          });
        }
      }

      const sale = await recordCounterPackSale(prisma, {
        member,
        packId: body.packId,
        provider: body.provider,
        method: body.method,
        shareEmails: body.shareEmails
      });

      res.status(201).json({
        reference: sale.reference,
        member: { id: member.id, name: member.name, email: member.email },
        pack: packView(pack),
        walletId: sale.walletId
      });
    } catch (error) {
      next(error);
    }
  });
}
