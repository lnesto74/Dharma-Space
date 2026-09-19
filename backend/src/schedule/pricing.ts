/**
 * Single-class prices, from the studio price list.
 *
 * Two columns, matching the printed card:
 *  - WALK_UP  — no membership.
 *  - MEMBER   — has a membership, but this category isn't included in their
 *               tier. A Flow member booking aerial pays the member rate; an
 *               Experience member booking yoga pays $28.
 *
 * When a category *is* included in the tier, neither applies — the booking is
 * covered and draws an included session instead. See memberships/tiers.ts.
 */

/** Used when a category has no entry below. */
export const DEFAULT_WALK_UP_CENTS = 3800;

const WALK_UP_CENTS: Record<string, number> = {
  YOGA: 3800,
  AERIAL: 5500,
  // Dance isn't on the printed card; priced with aerial as a movement session.
  DANCE: 5500,
  SOUND: 7900,
  CEREMONY: 8800,
  MEDITATION: 1500
};

const MEMBER_CENTS: Record<string, number> = {
  YOGA: 2800,
  AERIAL: 3500,
  DANCE: 3500,
  SOUND: 5500,
  CEREMONY: 7000,
  MEDITATION: 0
};

function normalize(category: string): string {
  return category.trim().toUpperCase();
}

export function walkUpCents(category: string): number {
  return WALK_UP_CENTS[normalize(category)] ?? DEFAULT_WALK_UP_CENTS;
}

/** Falls back to the walk-up rate for categories with no member price. */
export function memberCents(category: string): number {
  const key = normalize(category);
  return MEMBER_CENTS[key] ?? walkUpCents(key);
}

/** Price for a single booking, given whether the person holds a membership. */
export function singleClassCents(category: string, hasMembership: boolean): number {
  return hasMembership ? memberCents(category) : walkUpCents(category);
}

/** Formatted to match the "SGD 38" style stored on class and program records. */
export function formatPrice(cents: number): string {
  return `SGD ${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}

/** The price shown on the public schedule, which is always the walk-up rate. */
export function defaultDropInPrice(category: string): string {
  return formatPrice(walkUpCents(category));
}
