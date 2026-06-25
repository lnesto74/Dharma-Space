export type SiteMember = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MemberBooking = {
  id: string;
  reference: string;
  siteProgramId?: string | null;
  siteClassId?: string | null;
  offeringType: string;
  offeringTitle: string;
  category: string;
  scheduledLabel: string;
  time: string;
  location: string;
  facilitator: string;
  price: string;
  guests: number;
  notes?: string | null;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  stripeCheckoutUrl?: string | null;
  paidAt?: string | null;
  createdAt: string;
};

export type BookableOffering = {
  id: string;
  title: string;
  offeringType: "PROGRAM" | "CLASS";
  category?: string;
  classType?: string;
  dates?: string;
  day?: string;
  time?: string;
  location?: string;
  facilitator?: string;
  instructor?: string;
  price?: string;
  bookable?: boolean;
  comingSoon?: boolean;
  soldOut?: boolean;
  stripeLink?: string | null;
  usePayNow?: boolean;
};

const API = "";

async function memberFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {})
    }
  });
  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    const msg = typeof data.message === "string" ? data.message : "";
    if (msg) throw new Error(msg);
    if (res.status === 409) throw new Error("You already have a booking for this session.");
    throw new Error(`Request failed (${res.status})`);
  }
  return data as T;
}

export async function memberRegister(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}) {
  const res = await fetch(`${API}/api/member/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Could not create account");
  return data as { token: string; member: SiteMember };
}

export async function memberGoogleLogin(idToken: string) {
  const res = await fetch(`${API}/api/member/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Google sign-in failed");
  return data as { token: string; member: SiteMember };
}

export async function memberLogin(email: string, password: string) {
  const res = await fetch(`${API}/api/member/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Invalid email or password");
  return data as { token: string; member: SiteMember };
}

export async function fetchMemberMe(token: string) {
  return memberFetch<{ member: SiteMember }>("/api/member/me", token);
}

export async function updateMemberProfile(token: string, input: { name?: string; phone?: string | null }) {
  return memberFetch<{ member: SiteMember }>("/api/member/me", token, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function fetchMemberBookings(token: string) {
  return memberFetch<{ bookings: MemberBooking[] }>("/api/member/bookings", token);
}

export function memberHasActiveBooking(
  bookings: MemberBooking[],
  offering: { siteProgramId?: string | null; siteClassId?: string | null; offeringTitle?: string }
) {
  const active = new Set(["AWAITING_PAYMENT", "PAID"]);
  return bookings.some((b) => {
    if (!active.has(b.status)) return false;
    if (offering.siteProgramId && b.siteProgramId === offering.siteProgramId) return true;
    if (offering.siteClassId && b.siteClassId === offering.siteClassId) return true;
    if (offering.offeringTitle && b.offeringTitle === offering.offeringTitle && !offering.siteProgramId && !offering.siteClassId) {
      return true;
    }
    return false;
  });
}

export async function fetchBookableOfferings() {
  const res = await fetch(`${API}/api/member/offerings`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Could not load offerings");
  return data as { programs: BookableOffering[]; classes: BookableOffering[] };
}

export async function createMemberBooking(
  token: string,
  input: {
    siteProgramId?: string;
    siteClassId?: string;
    guests?: number;
    notes?: string;
    paymentMethod?: "STRIPE" | "PAYNOW";
  }
) {
  return memberFetch<{
    booking: MemberBooking;
    checkoutUrl?: string | null;
    payNowAmount?: string | null;
  }>("/api/member/bookings", token, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function confirmMemberBookingReturn(token: string, reference: string, sessionId?: string) {
  return memberFetch<{ booking: MemberBooking; alreadyPaid?: boolean }>(
    "/api/member/bookings/confirm-return",
    token,
    { method: "POST", body: JSON.stringify({ reference, sessionId }) }
  );
}
