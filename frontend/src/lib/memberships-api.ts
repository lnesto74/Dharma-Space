export type MembershipTier = {
  id: string;
  name: string;
  tierGroup: string;
  monthlyPriceCents: number;
  monthlyPrice: string;
  /** null means unlimited — no session counting. */
  includedSessionsPerMonth: number | null;
  allowedCategories: string;
  guestPassesPerMonth: number;
  rateHeldMonths: number | null;
  maxMembers: number | null;
  /** Days a fixed-length pass runs for. null = a monthly plan that renews. */
  termDays: number | null;
  /** Only sellable to someone who has never been a member. */
  introOnly: boolean;
  notes: string;
  placesLeft: number | null;
  soldOut: boolean;
};

export type MyMembership = {
  id: string;
  status: string;
  tierId: string;
  tierName: string;
  priceCents: number;
  price: string;
  currentPeriodEnd: string;
  sessionsRemaining: number | null;
  unlimited: boolean;
  /** False for a fixed-length pass, which ends on its date instead. */
  renews: boolean;
  termDays: number | null;
};

const STORAGE_KEY = "dharma_pending_membership";

async function memberFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {})
    }
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof data.message === "string" ? data.message : `Request failed (${res.status})`);
  }
  return data as T;
}

export async function fetchMembershipTiers() {
  const res = await fetch("/api/site/membership-tiers");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Could not load membership plans");
  return data as { tiers: MembershipTier[]; stripeReady: boolean };
}

export async function fetchMyMembership(token: string) {
  return memberFetch<{ membership: MyMembership | null }>("/api/member/membership", token);
}

export async function startMembershipCheckout(token: string, input: { tierId: string }) {
  return memberFetch<{
    reference: string;
    checkoutUrl: string;
    tier: {
      id: string;
      name: string;
      monthlyPriceCents: number;
      rateHeldMonths: number | null;
      termDays: number | null;
    };
  }>("/api/member/memberships/checkout", token, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function confirmMembershipPurchase(
  token: string,
  input: { sessionId?: string; reference?: string }
) {
  return memberFetch<{
    membershipId: string;
    tierName: string;
    termDays: number | null;
    alreadyStarted: boolean;
  }>(
    "/api/member/memberships/confirm-return",
    token,
    { method: "POST", body: JSON.stringify(input) }
  );
}

/** Kept across the Stripe redirect so the return page knows what was bought. */
export function savePendingMembership(pending: { reference: string; tierName: string }) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
}

export function readPendingMembership(): { reference: string; tierName: string } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPendingMembership() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function isMembershipPurchaseReturn(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.pathname === "/memberships/success";
}

const CATEGORY_LABELS: Record<string, string> = {
  YOGA: "yoga",
  AERIAL: "aerial",
  DANCE: "dance",
  SOUND: "sound healing",
  CEREMONY: "ceremony",
  MEDITATION: "meditation",
  WORKSHOP: "workshops",
  TRAINING: "training"
};

/** "Yoga, aerial and sound healing" — the plan's coverage as a sentence. */
export function categoriesLabel(allowed: string): string {
  const parts = allowed
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => CATEGORY_LABELS[c] ?? c.toLowerCase());
  if (!parts.length) return "Every class on the timetable";
  if (parts.length === 1) return capitalise(parts[0]);
  return capitalise(`${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`);
}

export function sessionsLabel(included: number | null): string {
  return included === null ? "Unlimited classes" : `${included} classes a month`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
