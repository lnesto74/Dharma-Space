import type { PrismaClient } from "@prisma/client";
import { CREDIT_PACK_SEEDS, CREDIT_VALID_MONTHS } from "./packs.js";

/**
 * Seeds the four credit packs. Idempotent — prices and credit counts are kept
 * in step with the price list on every boot, but packs the studio has
 * deactivated stay deactivated.
 */
export async function ensureCreditPacks(prisma: PrismaClient) {
  for (const seed of CREDIT_PACK_SEEDS) {
    await prisma.creditPack.upsert({
      where: { name: seed.name },
      create: {
        name: seed.name,
        credits: seed.credits,
        priceCents: seed.priceCents,
        validMonths: CREDIT_VALID_MONTHS,
        sortOrder: seed.sortOrder
      },
      update: {
        credits: seed.credits,
        priceCents: seed.priceCents,
        validMonths: CREDIT_VALID_MONTHS,
        sortOrder: seed.sortOrder
      }
    });
  }
}
