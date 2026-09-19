import type { Express, NextFunction, Request, Response } from "express";
import type { PrismaClient, User } from "@prisma/client";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  CATEGORIES,
  FOUNDING_FIFTY_CAP,
  MEMBERSHIP_STATUSES,
  TIER_GROUPS,
  tierCoversCategory
} from "./memberships/tiers.js";
import {
  canFreeze,
  cancellationEffectiveAt,
  effectivePriceCents,
  newMembershipDates,
  sessionsRemaining
} from "./memberships/lifecycle.js";

type AuthedRequest = Request & { user?: User };

const MEMBERSHIP_INCLUDE = {
  member: { select: { id: true, name: true, email: true, phone: true } },
  tier: true,
  periods: { orderBy: { periodStart: "desc" }, take: 12 }
} as const;

const tierBodySchema = z.object({
  name: z.string().min(2),
  tierGroup: z.enum(TIER_GROUPS),
  monthlyPriceCents: z.number().int().min(0),
  includedSessionsPerMonth: z.number().int().min(0).nullable(),
  allowedCategories: z.array(z.enum(CATEGORIES)).default([]),
  guestPassesPerMonth: z.number().int().min(0).default(0),
  priorityBookingDays: z.number().int().min(0).max(60).default(10),
  trainingDiscountCents: z.number().int().min(0).default(0),
  trainingDiscountPercent: z.number().int().min(0).max(100).default(0),
  maxMembers: z.number().int().min(1).nullable().default(null),
  rateHeldMonths: z.number().int().min(1).nullable().default(null),
  notes: z.string().default(""),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0)
});

/** Someone who paid in the studio and has never used the website. */
const newMemberSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional()
});

const createMembershipSchema = z
  .object({
    memberId: z.string().min(1).optional(),
    newMember: newMemberSchema.optional(),
    tierId: z.string().min(1),
    startedAt: z.string().datetime().optional(),
    priceCentsOverride: z.number().int().min(0).nullable().optional(),
    notes: z.string().optional()
  })
  .refine((v) => Boolean(v.memberId) || Boolean(v.newMember), {
    message: "Select an existing member or enter a new person's details."
  });

const statusActionSchema = z.object({
  action: z.enum(["freeze", "unfreeze", "cancel", "reactivate", "payment_failed"]),
  freezeMonths: z.number().int().min(1).max(2).optional()
});

function tierView(tier: {
  id: string;
  name: string;
  tierGroup: string;
  monthlyPriceCents: number;
  includedSessionsPerMonth: number | null;
  allowedCategories: string;
  guestPassesPerMonth: number;
  priorityBookingDays: number;
  trainingDiscountCents: number;
  trainingDiscountPercent: number;
  maxMembers: number | null;
  rateHeldMonths: number | null;
  notes: string;
  isActive: boolean;
  sortOrder: number;
}) {
  return {
    ...tier,
    allowedCategories: tier.allowedCategories
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
  };
}

export function registerAdminMembershipRoutes(
  app: Express,
  prisma: PrismaClient,
  auth: (req: AuthedRequest, res: Response, next: NextFunction) => void,
  requireRole: (...roles: string[]) => (req: AuthedRequest, res: Response, next: NextFunction) => void
) {
  const superAdmin = requireRole("SUPER_ADMIN");

  /** Count of non-cancelled Founding 50 memberships — the cap is enforced in code. */
  async function foundingFiftyUsed() {
    const tier = await prisma.membershipTier.findFirst({
      where: { maxMembers: { not: null } },
      orderBy: { sortOrder: "asc" }
    });
    if (!tier) return { tier: null, used: 0, remaining: 0 };
    const used = await prisma.membership.count({
      where: { tierId: tier.id, status: { not: "CANCELLED" } }
    });
    const cap = tier.maxMembers ?? FOUNDING_FIFTY_CAP;
    return { tier, used, remaining: Math.max(0, cap - used) };
  }

  // ── Overview ───────────────────────────────────────────────────────────────

  app.get("/api/admin/site/memberships/overview", auth, superAdmin, async (_req, res, next) => {
    try {
      const now = new Date();
      const [tiers, memberships, founding] = await Promise.all([
        prisma.membershipTier.findMany({ orderBy: { sortOrder: "asc" } }),
        prisma.membership.findMany({ include: { tier: true } }),
        foundingFiftyUsed()
      ]);

      const active = memberships.filter((m) => m.status === "ACTIVE");
      const monthlyRevenueCents = active.reduce(
        (sum, m) =>
          sum +
          effectivePriceCents(
            m.tier.monthlyPriceCents,
            m.priceCentsOverride,
            m.rateHeldUntil,
            now
          ),
        0
      );

      const byTier = tiers.map((tier) => ({
        id: tier.id,
        name: tier.name,
        tierGroup: tier.tierGroup,
        monthlyPriceCents: tier.monthlyPriceCents,
        activeCount: active.filter((m) => m.tierId === tier.id).length,
        totalCount: memberships.filter((m) => m.tierId === tier.id).length
      }));

      res.json({
        kpis: {
          activeCount: active.length,
          frozenCount: memberships.filter((m) => m.status === "FROZEN").length,
          pendingCancelCount: memberships.filter((m) => m.status === "PENDING_CANCEL").length,
          cancelledCount: memberships.filter((m) => m.status === "CANCELLED").length,
          paymentFailedCount: memberships.filter((m) => m.status === "PAYMENT_FAILED").length,
          monthlyRevenueCents,
          foundingFiftyUsed: founding.used,
          foundingFiftyRemaining: founding.remaining
        },
        byTier
      });
    } catch (error) {
      next(error);
    }
  });

  // ── Tiers (plans) ──────────────────────────────────────────────────────────

  app.get("/api/admin/site/membership-tiers", auth, superAdmin, async (_req, res, next) => {
    try {
      const [tiers, founding] = await Promise.all([
        prisma.membershipTier.findMany({ orderBy: { sortOrder: "asc" } }),
        foundingFiftyUsed()
      ]);
      const counts = await prisma.membership.groupBy({
        by: ["tierId"],
        where: { status: { not: "CANCELLED" } },
        _count: { _all: true }
      });
      res.json({
        tiers: tiers.map((t) => ({
          ...tierView(t),
          memberCount: counts.find((c) => c.tierId === t.id)?._count._all ?? 0,
          soldOut:
            t.maxMembers !== null &&
            (counts.find((c) => c.tierId === t.id)?._count._all ?? 0) >= t.maxMembers
        })),
        foundingFiftyRemaining: founding.remaining
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/site/membership-tiers", auth, superAdmin, async (req, res, next) => {
    try {
      const body = tierBodySchema.parse(req.body);
      const tier = await prisma.membershipTier.create({
        data: { ...body, allowedCategories: body.allowedCategories.join(",") }
      });
      res.status(201).json({ tier: tierView(tier) });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/site/membership-tiers/:id", auth, superAdmin, async (req, res, next) => {
    try {
      const body = tierBodySchema.partial().parse(req.body);
      const data: Record<string, unknown> = { ...body };
      if (body.allowedCategories) data.allowedCategories = body.allowedCategories.join(",");
      const tier = await prisma.membershipTier.update({
        where: { id: req.params.id },
        data
      });
      res.json({ tier: tierView(tier) });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/site/membership-tiers/:id", auth, superAdmin, async (req, res, next) => {
    try {
      const inUse = await prisma.membership.count({ where: { tierId: req.params.id } });
      if (inUse > 0) {
        return res.status(409).json({
          message: `This plan has ${inUse} membership(s) attached. Deactivate it instead of deleting.`
        });
      }
      await prisma.membershipTier.delete({ where: { id: req.params.id } });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  // ── Memberships ────────────────────────────────────────────────────────────

  app.get("/api/admin/site/memberships", auth, superAdmin, async (req, res, next) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

      const memberships = await prisma.membership.findMany({
        where: {
          ...(status && status !== "ALL" ? { status } : {}),
          ...(search
            ? {
                member: {
                  OR: [
                    { name: { contains: search, mode: "insensitive" as const } },
                    { email: { contains: search, mode: "insensitive" as const } }
                  ]
                }
              }
            : {})
        },
        include: MEMBERSHIP_INCLUDE,
        orderBy: { createdAt: "desc" }
      });

      const now = new Date();
      res.json({
        memberships: memberships.map((m) => {
          const current = m.periods[0] ?? null;
          return {
            id: m.id,
            status: m.status,
            member: m.member,
            tier: tierView(m.tier),
            startedAt: m.startedAt,
            currentPeriodStart: m.currentPeriodStart,
            currentPeriodEnd: m.currentPeriodEnd,
            minimumTermEndsAt: m.minimumTermEndsAt,
            cancelRequestedAt: m.cancelRequestedAt,
            cancelEffectiveAt: m.cancelEffectiveAt,
            freezeEndsAt: m.freezeEndsAt,
            freezeMonthsUsedYear: m.freezeYear === now.getFullYear() ? m.freezeMonthsUsedYear : 0,
            priceCentsOverride: m.priceCentsOverride,
            effectivePriceCents: effectivePriceCents(
              m.tier.monthlyPriceCents,
              m.priceCentsOverride,
              m.rateHeldUntil,
              now
            ),
            rateHeldUntil: m.rateHeldUntil,
            notes: m.notes,
            currentPeriod: current
              ? {
                  id: current.id,
                  periodStart: current.periodStart,
                  periodEnd: current.periodEnd,
                  sessionsIncluded: current.sessionsIncluded,
                  sessionsUsed: current.sessionsUsed,
                  sessionsRolledIn: current.sessionsRolledIn,
                  guestPassesUsed: current.guestPassesUsed,
                  sessionsRemaining: sessionsRemaining(current)
                }
              : null
          };
        })
      });
    } catch (error) {
      next(error);
    }
  });

  /** Full record: periods ledger + the bookings this membership paid for. */
  app.get("/api/admin/site/memberships/:id", auth, superAdmin, async (req, res, next) => {
    try {
      const membership = await prisma.membership.findUnique({
        where: { id: req.params.id },
        include: {
          member: { select: { id: true, name: true, email: true, phone: true } },
          tier: true,
          periods: { orderBy: { periodStart: "desc" } }
        }
      });
      if (!membership) return res.status(404).json({ message: "Membership not found" });

      const bookings = await prisma.booking.findMany({
        where: { OR: [{ membershipId: membership.id }, { memberId: membership.memberId }] },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          reference: true,
          offeringTitle: true,
          category: true,
          scheduledLabel: true,
          time: true,
          status: true,
          paymentMethod: true,
          price: true,
          sessionsSpent: true,
          membershipId: true,
          membershipPeriodId: true,
          createdAt: true
        }
      });

      res.json({
        membership: {
          ...membership,
          tier: tierView(membership.tier),
          periods: membership.periods.map((p) => ({
            ...p,
            sessionsRemaining: sessionsRemaining(p)
          }))
        },
        bookings
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/site/memberships", auth, superAdmin, async (req, res, next) => {
    try {
      const body = createMembershipSchema.parse(req.body);

      const tier = await prisma.membershipTier.findUnique({ where: { id: body.tierId } });
      if (!tier) return res.status(404).json({ message: "Plan not found" });
      if (!tier.isActive) return res.status(409).json({ message: "That plan is not active." });

      // Either an existing website account, or a walk-in the studio is adding by hand.
      // Admin-created accounts get a random password; the person sets their own via
      // the website's password reset when they first sign in.
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

      const existing = await prisma.membership.findFirst({
        where: { memberId: member.id, status: { notIn: ["CANCELLED"] } }
      });
      if (existing) {
        return res
          .status(409)
          .json({ message: `${member.name} already has an active membership.` });
      }

      // Founding 50 (and any capped plan) stops being sellable at its cap.
      if (tier.maxMembers !== null) {
        const used = await prisma.membership.count({
          where: { tierId: tier.id, status: { not: "CANCELLED" } }
        });
        if (used >= tier.maxMembers) {
          return res.status(409).json({
            message: `${tier.name} is sold out — all ${tier.maxMembers} places are taken.`
          });
        }
      }

      const startedAt = body.startedAt ? new Date(body.startedAt) : new Date();
      const dates = newMembershipDates(startedAt, tier.rateHeldMonths);
      // A capped, rate-held plan (Founding 50) holds its own price.
      const priceCentsOverride =
        body.priceCentsOverride ?? (tier.rateHeldMonths ? tier.monthlyPriceCents : null);

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
          notes: body.notes ?? "",
          periods: {
            create: {
              periodStart: dates.currentPeriodStart,
              periodEnd: dates.currentPeriodEnd,
              sessionsIncluded: tier.includedSessionsPerMonth
            }
          }
        },
        include: MEMBERSHIP_INCLUDE
      });

      res.status(201).json({ membership });
    } catch (error) {
      next(error);
    }
  });

  /** Tier switch — takes effect next period, nothing is prorated. */
  app.patch("/api/admin/site/memberships/:id/tier", auth, superAdmin, async (req, res, next) => {
    try {
      const { tierId } = z.object({ tierId: z.string().min(1) }).parse(req.body);
      const [membership, tier] = await Promise.all([
        prisma.membership.findUnique({ where: { id: req.params.id } }),
        prisma.membershipTier.findUnique({ where: { id: tierId } })
      ]);
      if (!membership) return res.status(404).json({ message: "Membership not found" });
      if (!tier) return res.status(404).json({ message: "Plan not found" });

      if (tier.maxMembers !== null && tier.id !== membership.tierId) {
        const used = await prisma.membership.count({
          where: { tierId: tier.id, status: { not: "CANCELLED" } }
        });
        if (used >= tier.maxMembers) {
          return res
            .status(409)
            .json({ message: `${tier.name} is sold out — all ${tier.maxMembers} places are taken.` });
        }
      }

      const updated = await prisma.membership.update({
        where: { id: membership.id },
        data: { tierId: tier.id },
        include: MEMBERSHIP_INCLUDE
      });
      res.json({ membership: updated, appliesFrom: membership.currentPeriodEnd });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/site/memberships/:id/status", auth, superAdmin, async (req, res, next) => {
    try {
      const body = statusActionSchema.parse(req.body);
      const membership = await prisma.membership.findUnique({ where: { id: req.params.id } });
      if (!membership) return res.status(404).json({ message: "Membership not found" });

      const now = new Date();
      let data: Record<string, unknown> = {};

      if (body.action === "freeze") {
        const months = body.freezeMonths ?? 1;
        const check = canFreeze(
          months,
          membership.freezeMonthsUsedYear,
          membership.freezeYear,
          now
        );
        if (!check.ok) return res.status(409).json({ message: check.reason });
        const freezeEndsAt = new Date(now.getTime());
        freezeEndsAt.setMonth(freezeEndsAt.getMonth() + months);
        data = {
          status: "FROZEN",
          frozenAt: now,
          freezeEndsAt,
          freezeMonthsUsedYear: check.monthsUsedAfter,
          freezeYear: now.getFullYear()
        };
      } else if (body.action === "unfreeze") {
        data = { status: "ACTIVE", frozenAt: null, freezeEndsAt: null };
      } else if (body.action === "cancel") {
        data = {
          status: "PENDING_CANCEL",
          cancelRequestedAt: now,
          cancelEffectiveAt: cancellationEffectiveAt(
            now,
            membership.currentPeriodEnd,
            membership.minimumTermEndsAt
          )
        };
      } else if (body.action === "reactivate") {
        data = {
          status: "ACTIVE",
          cancelRequestedAt: null,
          cancelEffectiveAt: null,
          frozenAt: null,
          freezeEndsAt: null
        };
      } else if (body.action === "payment_failed") {
        // Failed payment suspends booking rights — it never auto-cancels.
        data = { status: "PAYMENT_FAILED" };
      }

      const updated = await prisma.membership.update({
        where: { id: membership.id },
        data,
        include: MEMBERSHIP_INCLUDE
      });
      res.json({ membership: updated });
    } catch (error) {
      next(error);
    }
  });

  // ── Helpers for the admin UI ───────────────────────────────────────────────

  /** Members plus whether they already hold a membership (for the add form). */
  app.get("/api/admin/site/membership-members", auth, superAdmin, async (req, res, next) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
      const members = await prisma.siteMember.findMany({
        where: search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } }
              ]
            }
          : undefined,
        select: {
          id: true,
          name: true,
          email: true,
          memberships: {
            where: { status: { not: "CANCELLED" } },
            select: { id: true, tier: { select: { name: true } } }
          }
        },
        orderBy: { name: "asc" },
        take: 200
      });
      res.json({
        members: members.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          currentTier: m.memberships[0]?.tier.name ?? null
        })),
        statuses: MEMBERSHIP_STATUSES,
        categories: CATEGORIES
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Would this membership cover a given category? Used by the admin UI to
   * explain why a member is or isn't covered for a class.
   */
  app.get("/api/admin/site/memberships/:id/coverage", auth, superAdmin, async (req, res, next) => {
    try {
      const membership = await prisma.membership.findUnique({
        where: { id: req.params.id },
        include: { tier: true }
      });
      if (!membership) return res.status(404).json({ message: "Membership not found" });
      res.json({
        coverage: CATEGORIES.map((category) => ({
          category,
          covered: tierCoversCategory(membership.tier.allowedCategories, category)
        }))
      });
    } catch (error) {
      next(error);
    }
  });
}
