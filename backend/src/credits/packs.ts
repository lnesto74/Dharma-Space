/**
 * Prepaid credit packs — live business rules.
 *
 * Money is integer cents (SGD). Credits are whole numbers.
 *
 * Credits are the third way to pay for a class, alongside a membership and
 * paying per class. They differ from a membership in three ways:
 *  - they are shareable, so a couple or family can draw on one pack
 *  - they expire six months after purchase rather than refilling monthly
 *  - they are bought outright, with no minimum term or notice period
 */

/** Unused credits lapse this many months after purchase. */
export const CREDIT_VALID_MONTHS = 6;

export type CreditPackSeed = {
  name: string;
  credits: number;
  priceCents: number;
  sortOrder: number;
};

export const CREDIT_PACK_SEEDS: CreditPackSeed[] = [
  { name: "10 credits", credits: 10, priceCents: 17000, sortOrder: 1 },
  { name: "20 credits", credits: 20, priceCents: 32000, sortOrder: 2 },
  { name: "40 credits", credits: 40, priceCents: 60000, sortOrder: 3 },
  { name: "80 credits", credits: 80, priceCents: 112000, sortOrder: 4 }
];

/**
 * Credits to book one place in a class. Meditation is absent deliberately —
 * it is free for anyone holding credits, the same as it is for members.
 */
export const CREDIT_COSTS: Record<string, number> = {
  YOGA: 2,
  AERIAL: 3,
  DANCE: 3,
  SOUND: 4,
  CEREMONY: 5
};

/** Categories credits can't be spent on at all. */
const NOT_CREDIT_ELIGIBLE = new Set(["WORKSHOP", "TRAINING"]);

function normalize(category: string): string {
  return category.trim().toUpperCase();
}

export function isCreditEligible(category: string): boolean {
  return !NOT_CREDIT_ELIGIBLE.has(normalize(category));
}

/** Zero means free — covered without drawing down the balance. */
export function creditCost(category: string): number {
  return CREDIT_COSTS[normalize(category)] ?? 0;
}

/** Per-credit value of a pack, used to show the saving against walk-up. */
export function centsPerCredit(pack: { credits: number; priceCents: number }): number {
  if (pack.credits <= 0) return 0;
  return Math.round(pack.priceCents / pack.credits);
}
