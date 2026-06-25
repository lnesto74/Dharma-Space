import type { Duel, ParticipantKey } from "../platform/challenge-store";

export type Colleague = { id: string; name: string; department: string };

async function challengeFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
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

export function fetchChallenges(token: string) {
  return challengeFetch<{ duels: Duel[]; points: number }>("/api/challenges", token);
}

export function fetchColleagues(token: string) {
  return challengeFetch<{ colleagues: Colleague[] }>("/api/challenges/colleagues", token);
}

export function createChallenge(
  token: string,
  body: { opponentId: string; typeId: string; target: number; witnessIds: string[] }
) {
  return challengeFetch<{ duel: Duel }>("/api/challenges", token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function respondChallenge(token: string, id: string, accept: boolean) {
  return challengeFetch<{ duel: Duel }>(`/api/challenges/${id}/respond`, token, {
    method: "POST",
    body: JSON.stringify({ accept })
  });
}

export function witnessRespondChallenge(token: string, id: string, accept: boolean) {
  return challengeFetch<{ duel: Duel }>(`/api/challenges/${id}/witness`, token, {
    method: "POST",
    body: JSON.stringify({ accept })
  });
}

export function startChallenge(token: string, id: string) {
  return challengeFetch<{ duel: Duel }>(`/api/challenges/${id}/start`, token, { method: "POST" });
}

export function finishChallenge(token: string, id: string) {
  return challengeFetch<{ duel: Duel }>(`/api/challenges/${id}/finish`, token, { method: "POST" });
}

export function voteChallenge(token: string, id: string, who: ParticipantKey, vote: "done" | "failed") {
  return challengeFetch<{ duel: Duel }>(`/api/challenges/${id}/vote`, token, {
    method: "POST",
    body: JSON.stringify({ who, vote })
  });
}

export function dismissChallenge(token: string, id: string) {
  return challengeFetch<{ duel: Duel }>(`/api/challenges/${id}/dismiss`, token, { method: "POST" });
}
