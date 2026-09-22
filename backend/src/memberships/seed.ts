import type { PrismaClient } from "@prisma/client";
import { TIER_SEEDS } from "./tiers.js";

/**
 * Creates the live membership plans if they are missing.
 *
 * Prices and allowances are real business rules, so an existing plan is never
 * silently overwritten here — the studio can edit plans in admin and those
 * edits must survive a restart. Only missing plans are inserted.
 */
export async function ensureMembershipTiers(prisma: PrismaClient) {
  for (const seed of TIER_SEEDS) {
    const existing = await prisma.membershipTier.findUnique({ where: { name: seed.name } });
    if (existing) continue;
    await prisma.membershipTier.create({
      data: {
        name: seed.name,
        tierGroup: seed.tierGroup,
        monthlyPriceCents: seed.monthlyPriceCents,
        includedSessionsPerMonth: seed.includedSessionsPerMonth,
        allowedCategories: seed.allowedCategories.join(","),
        guestPassesPerMonth: seed.guestPassesPerMonth,
        priorityBookingDays: seed.priorityBookingDays,
        trainingDiscountCents: seed.trainingDiscountCents,
        trainingDiscountPercent: seed.trainingDiscountPercent,
        maxMembers: seed.maxMembers,
        rateHeldMonths: seed.rateHeldMonths,
        termDays: seed.termDays ?? null,
        introOnly: seed.introOnly ?? false,
        notes: seed.notes,
        sortOrder: seed.sortOrder
      }
    });
  }
}
