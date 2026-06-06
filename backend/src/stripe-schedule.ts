export function normalizeStripeLink(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

export function isValidStripeLink(url: string): boolean {
  return /^https:\/\/(buy\.)?stripe\.com\//i.test(url);
}

export type ProgramStripeInput = {
  comingSoon?: boolean;
  usePayNow?: boolean;
  stripeLink?: string | null;
};

export type ClassStripeInput = {
  comingSoon?: boolean;
  stripeLink?: string | null;
};

/** Coming soon → no Stripe link. Scheduled → Stripe required (PayNow programs exempt). */
export function applyProgramStripeRules<T extends ProgramStripeInput>(input: T): T {
  const next = { ...input };
  if (next.comingSoon) {
    next.stripeLink = null;
    return next;
  }
  if (next.usePayNow) {
    next.stripeLink = normalizeStripeLink(next.stripeLink);
    return next;
  }
  const link = normalizeStripeLink(next.stripeLink);
  if (!link || !isValidStripeLink(link)) {
    throw new Error("Stripe payment link is required when a date is scheduled (unless using PayNow).");
  }
  next.stripeLink = link;
  return next;
}

/** Coming soon → no Stripe link. Scheduled class → Stripe required. */
export function applyClassStripeRules<T extends ClassStripeInput>(input: T): T {
  const next = { ...input };
  if (next.comingSoon) {
    next.stripeLink = null;
    return next;
  }
  const link = normalizeStripeLink(next.stripeLink);
  if (!link || !isValidStripeLink(link)) {
    throw new Error("Stripe booking link is required when the class is scheduled.");
  }
  next.stripeLink = link;
  return next;
}
