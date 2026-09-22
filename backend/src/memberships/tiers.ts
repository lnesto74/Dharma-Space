/**
 * Dharma Space membership tiers — live business rules.
 *
 * Money is always integer cents (SGD). Never floats.
 *
 * Coverage rules:
 *  - FLOW tiers cover YOGA only. A Flow member booking an experience session
 *    pays the member drop-in rate.
 *  - EXPERIENCE tiers cover AERIAL, SOUND and DANCE.
 *  - ALL_ACCESS covers every weekly category, uncapped.
 *  - MEDITATION is free for every member on every tier and never consumes an
 *    included session.
 */

export const CATEGORIES = [
  "YOGA",
  "AERIAL",
  "SOUND",
  "DANCE",
  "MEDITATION",
  "CEREMONY",
  "WORKSHOP",
  "TRAINING"
] as const;
export type Category = (typeof CATEGORIES)[number];

export const TIER_GROUPS = ["FLOW", "EXPERIENCE", "ALL_ACCESS"] as const;
export type TierGroup = (typeof TIER_GROUPS)[number];

export const MEMBERSHIP_STATUSES = [
  "ACTIVE",
  "FROZEN",
  "PENDING_CANCEL",
  "CANCELLED",
  "PAYMENT_FAILED"
] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

/** Meditation is free on every tier and never counts against an allowance. */
export const FREE_CATEGORY: Category = "MEDITATION";

/** Founding 50 is capped at 50 members, ever. */
export const FOUNDING_FIFTY_NAME = "Founding 50";
export const FOUNDING_FIFTY_CAP = 50;

/** Initial commitment before a membership becomes month-to-month. */
export const MINIMUM_TERM_MONTHS = 3;
/** Notice required to cancel. */
export const CANCELLATION_NOTICE_DAYS = 14;
/** Freeze allowance and fee. */
export const MAX_FREEZE_MONTHS_PER_YEAR = 2;
export const FREEZE_FEE_CENTS = 1500;

/** The week-long introduction: everything, once, for people who are new. */
export const NEW_HERE_NAME = "New Here";
export const NEW_HERE_DAYS = 7;

export type TierSeed = {
  name: string;
  tierGroup: TierGroup;
  monthlyPriceCents: number;
  /** null = unlimited, no session counting */
  includedSessionsPerMonth: number | null;
  allowedCategories: Category[];
  guestPassesPerMonth: number;
  priorityBookingDays: number;
  trainingDiscountCents: number;
  trainingDiscountPercent: number;
  maxMembers: number | null;
  rateHeldMonths: number | null;
  /** Fixed-length pass in days. null = the usual monthly plan. */
  termDays?: number | null;
  /** Sellable only to someone who has never held a membership here. */
  introOnly?: boolean;
  notes: string;
  sortOrder: number;
};

/** A pass that ends on its own date rather than renewing. */
export function isFixedTerm(tier: { termDays: number | null }): boolean {
  return tier.termDays !== null && tier.termDays > 0;
}

const FLOW_CATEGORIES: Category[] = ["YOGA", "MEDITATION"];
const EXPERIENCE_CATEGORIES: Category[] = ["AERIAL", "SOUND", "DANCE", "MEDITATION"];
const ALL_ACCESS_CATEGORIES: Category[] = [
  "YOGA",
  "AERIAL",
  "SOUND",
  "DANCE",
  "MEDITATION"
];

export const TIER_SEEDS: TierSeed[] = [
  {
    // Seven days of everything, bought once. It sits above the monthly plans
    // because it is how most people meet the studio, and it is deliberately
    // not a membership that renews — nobody should discover they joined.
    name: NEW_HERE_NAME,
    tierGroup: "ALL_ACCESS",
    monthlyPriceCents: 5900,
    includedSessionsPerMonth: null,
    allowedCategories: ALL_ACCESS_CATEGORIES,
    guestPassesPerMonth: 0,
    priorityBookingDays: 0,
    trainingDiscountCents: 0,
    trainingDiscountPercent: 0,
    maxMembers: null,
    rateHeldMonths: null,
    termDays: NEW_HERE_DAYS,
    introOnly: true,
    notes: "Seven days, everything. One week to find your slot. First visit only.",
    sortOrder: 0
  },
  {
    name: "Flow 4",
    tierGroup: "FLOW",
    monthlyPriceCents: 9900,
    includedSessionsPerMonth: 4,
    allowedCategories: FLOW_CATEGORIES,
    guestPassesPerMonth: 0,
    priorityBookingDays: 10,
    trainingDiscountCents: 0,
    trainingDiscountPercent: 10,
    maxMembers: null,
    rateHeldMonths: null,
    notes: "4 yoga classes a month.",
    sortOrder: 1
  },
  {
    name: "Flow 8",
    tierGroup: "FLOW",
    monthlyPriceCents: 13900,
    includedSessionsPerMonth: 8,
    allowedCategories: FLOW_CATEGORIES,
    guestPassesPerMonth: 1,
    priorityBookingDays: 10,
    trainingDiscountCents: 0,
    trainingDiscountPercent: 10,
    maxMembers: null,
    rateHeldMonths: null,
    notes: "8 yoga classes a month. 1 guest pass a month.",
    sortOrder: 2
  },
  {
    name: "Flow Unlimited",
    tierGroup: "FLOW",
    monthlyPriceCents: 16900,
    includedSessionsPerMonth: null,
    allowedCategories: FLOW_CATEGORIES,
    guestPassesPerMonth: 2,
    priorityBookingDays: 10,
    trainingDiscountCents: 50000,
    trainingDiscountPercent: 0,
    maxMembers: null,
    rateHeldMonths: null,
    notes: "Unlimited yoga. 2 guest passes. $500 off the 200-hour after 6 months.",
    sortOrder: 3
  },
  {
    name: "Experience 4",
    tierGroup: "EXPERIENCE",
    monthlyPriceCents: 12900,
    includedSessionsPerMonth: 4,
    allowedCategories: EXPERIENCE_CATEGORIES,
    guestPassesPerMonth: 0,
    priorityBookingDays: 10,
    trainingDiscountCents: 0,
    trainingDiscountPercent: 10,
    maxMembers: null,
    rateHeldMonths: null,
    notes: "4 experience sessions a month. Yoga at $28, meditation free.",
    sortOrder: 4
  },
  {
    name: "Experience 8",
    tierGroup: "EXPERIENCE",
    monthlyPriceCents: 19900,
    includedSessionsPerMonth: 8,
    allowedCategories: EXPERIENCE_CATEGORIES,
    guestPassesPerMonth: 0,
    priorityBookingDays: 14,
    trainingDiscountCents: 0,
    trainingDiscountPercent: 10,
    maxMembers: null,
    rateHeldMonths: null,
    notes: "8 experience sessions a month. Priority booking. Yoga at $28, meditation free.",
    sortOrder: 5
  },
  {
    name: "Dharma All-Access",
    tierGroup: "ALL_ACCESS",
    monthlyPriceCents: 23900,
    includedSessionsPerMonth: null,
    allowedCategories: ALL_ACCESS_CATEGORIES,
    guestPassesPerMonth: 2,
    priorityBookingDays: 14,
    trainingDiscountCents: 71700,
    trainingDiscountPercent: 0,
    maxMembers: null,
    rateHeldMonths: null,
    notes:
      "Everything, uncapped. 2 guest passes. 1 ceremony + 1 workshop per quarter. 3 months of fees credited against the 200-hour.",
    sortOrder: 6
  },
  {
    name: FOUNDING_FIFTY_NAME,
    tierGroup: "ALL_ACCESS",
    monthlyPriceCents: 19900,
    includedSessionsPerMonth: null,
    allowedCategories: ALL_ACCESS_CATEGORIES,
    guestPassesPerMonth: 2,
    priorityBookingDays: 14,
    trainingDiscountCents: 71700,
    trainingDiscountPercent: 0,
    maxMembers: FOUNDING_FIFTY_CAP,
    rateHeldMonths: 12,
    notes: "All-Access at $199. First 50 members only. Rate held 12 months.",
    sortOrder: 7
  }
];

export function formatCents(cents: number): string {
  return `SGD ${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}

/** Does this tier's allowance cover the given category? */
export function tierCoversCategory(
  allowedCategories: string,
  category: string
): boolean {
  const normalized = category.trim().toUpperCase();
  if (normalized === FREE_CATEGORY) return true;
  return allowedCategories
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
    .includes(normalized);
}

/** Meditation never draws down an included session. */
export function consumesIncludedSession(category: string): boolean {
  return category.trim().toUpperCase() !== FREE_CATEGORY;
}
