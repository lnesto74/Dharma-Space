export type CreditPack = {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  price: string;
  validMonths: number;
  perCreditCents: number;
  perCredit: string;
};

export type CreditWallet = {
  id: string;
  packName: string;
  creditsTotal: number;
  creditsUsed: number;
  creditsLeft: number;
  purchasedAt: string;
  expiresAt: string;
  status: string;
  isOwner: boolean;
  owner: { name: string; email: string };
  sharedWith: { memberId: string; name: string; email: string }[];
  history: { credits: number; reason: string; at: string; memberName: string | null }[];
};

export type CreditSummary = {
  wallets: CreditWallet[];
  creditsLeft: number;
  nextExpiry: string | null;
  /** Credits per class by category — meditation is absent because it's free. */
  costs: Record<string, number>;
};

const STORAGE_KEY = "dharma_pending_credit_purchase";

async function creditFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
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

export async function fetchCreditPacks() {
  const res = await fetch("/api/site/credit-packs");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Could not load credit packs");
  return data as { packs: CreditPack[]; stripeReady: boolean };
}

export async function startCreditPackCheckout(
  token: string,
  input: { packId: string; shareEmails?: string[] }
) {
  return creditFetch<{
    reference: string;
    checkoutUrl: string;
    pack: { id: string; name: string; credits: number; validMonths: number };
    sharedWith: { id: string; name: string; email: string }[];
  }>("/api/member/credits/checkout", token, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function confirmCreditPurchase(token: string, input: { sessionId?: string; reference?: string }) {
  return creditFetch<{
    credits: number;
    packName: string;
    expiresAt: string;
    summary: CreditSummary;
  }>("/api/member/credits/confirm-return", token, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function fetchMemberCredits(token: string) {
  return creditFetch<CreditSummary>("/api/member/credits", token);
}

export async function shareCreditWallet(token: string, walletId: string, email: string) {
  return creditFetch<{ person: { memberId: string; name: string; email: string }; summary: CreditSummary }>(
    `/api/member/credits/${walletId}/share`,
    token,
    { method: "POST", body: JSON.stringify({ email }) }
  );
}

export async function unshareCreditWallet(token: string, walletId: string, memberId: string) {
  return creditFetch<{ summary: CreditSummary }>(
    `/api/member/credits/${walletId}/share/${memberId}`,
    token,
    { method: "DELETE" }
  );
}

/** Kept across the Stripe redirect so the return page knows what was bought. */
export function savePendingCreditPurchase(purchase: { reference: string; packName: string; credits: number }) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(purchase));
}

export function readPendingCreditPurchase(): { reference: string; packName: string; credits: number } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPendingCreditPurchase() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function isCreditPurchaseReturn(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.pathname === "/credits/success";
}

export function creditsExpiryLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

const CATEGORY_LABELS: Record<string, string> = {
  YOGA: "yoga",
  AERIAL: "aerial",
  DANCE: "dance",
  SOUND: "sound healing",
  CEREMONY: "ceremony"
};

/** "10 yoga or 6 aerial" — enough to picture the balance without listing everything. */
export function creditsWorth(credits: number, costs: Record<string, number>): string {
  return Object.entries(costs)
    .filter(([, cost]) => cost > 0)
    .slice(0, 3)
    .map(([category, cost]) => `${Math.floor(credits / cost)} ${CATEGORY_LABELS[category] ?? category.toLowerCase()}`)
    .join(" or ");
}
