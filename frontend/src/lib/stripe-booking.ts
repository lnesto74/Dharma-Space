export type PendingStripeBooking = {
  name: string;
  email: string;
  title: string;
  date?: string;
  time?: string;
  location?: string;
  facilitator?: string;
  price?: string;
  reference: string;
  siteProgramId?: string;
  siteClassId?: string;
  programCategory?: string;
  phone?: string;
  notes?: string;
  guests?: string;
};

const STORAGE_KEY = "dharma_pending_stripe_booking";

export function stripeBookingReturnUrl(origin = typeof window !== "undefined" ? window.location.origin : ""): string {
  const base = origin || "https://dharma-space.com";
  return `${base}/booking/success`;
}

export function savePendingStripeBooking(booking: PendingStripeBooking) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(booking));
}

export function readPendingStripeBooking(): PendingStripeBooking | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingStripeBooking;
    if (!parsed?.title || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingStripeBooking() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function isStripeBookingReturn(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.pathname === "/booking/success") return true;
  return new URLSearchParams(window.location.search).get("booking") === "success";
}

export function stripeCheckoutUrl(base: string, email: string, reference: string): string {
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}prefilled_email=${encodeURIComponent(email)}&client_reference_id=${encodeURIComponent(reference)}`;
}
