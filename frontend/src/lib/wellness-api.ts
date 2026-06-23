import type {
  DepartmentLeaderboardEntry,
  LeaderboardEntry,
  WellnessBooking,
  WellnessCategory,
  WellnessEvent,
  WellnessStats
} from "../types/wellness";

async function wellnessFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {})
    }
  });
  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    throw new Error(typeof data.message === "string" ? data.message : `Request failed (${res.status})`);
  }
  return data as T;
}

export function fetchWellnessCategories(token: string) {
  return wellnessFetch<{ categories: WellnessCategory[] }>("/api/wellness/categories", token);
}

export function fetchWellnessEvents(token: string, params?: { upcoming?: boolean; categoryId?: string }) {
  const qs = new URLSearchParams();
  if (params?.upcoming) qs.set("upcoming", "true");
  if (params?.categoryId) qs.set("categoryId", params.categoryId);
  const suffix = qs.toString() ? `?${qs}` : "";
  return wellnessFetch<{ events: WellnessEvent[] }>(`/api/wellness/events${suffix}`, token);
}

export function fetchWellnessLeaderboard(token: string) {
  return wellnessFetch<{ entries: LeaderboardEntry[] }>("/api/wellness/leaderboard", token);
}

export function fetchWellnessStats(token: string) {
  return wellnessFetch<WellnessStats>("/api/wellness/stats/me", token);
}

export function fetchDepartmentLeaderboard(token: string) {
  return wellnessFetch<{ departments: DepartmentLeaderboardEntry[] }>("/api/wellness/leaderboard/departments", token);
}

export function fetchMyWellnessBookings(token: string) {
  return wellnessFetch<{ bookings: WellnessBooking[] }>("/api/wellness/bookings/me", token);
}

export function bookWellnessEvent(token: string, eventId: string) {
  return wellnessFetch<{ booking: WellnessBooking }>("/api/wellness/bookings", token, {
    method: "POST",
    body: JSON.stringify({ eventId })
  });
}

export function cancelWellnessBooking(token: string, bookingId: string) {
  return wellnessFetch<{ ok: boolean }>(`/api/wellness/bookings/${bookingId}`, token, { method: "DELETE" });
}
