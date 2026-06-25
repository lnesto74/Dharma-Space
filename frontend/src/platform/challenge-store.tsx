import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { buddyChallengeTypeMap, getMeId, pointsForTarget, setMe } from "./challenge-types";
import { playSwordsSound } from "./sounds";
import {
  createChallenge,
  dismissChallenge,
  fetchChallenges,
  fetchColleagues,
  finishChallenge,
  respondChallenge,
  startChallenge,
  voteChallenge,
  witnessRespondChallenge,
  type Colleague
} from "../lib/challenge-api";

export type WitnessResponse = "pending" | "accepted" | "busy";
export type ParticipantResult = "pending" | "done" | "failed";
export type DuelStatus = "invited" | "active" | "rejected";
export type ParticipantKey = "challenger" | "opponent";

export type WitnessVotes = Record<ParticipantKey, ParticipantResult>;
export type DuelWitness = { id: string; name: string; response: WitnessResponse; votes: WitnessVotes };

export type Duel = {
  id: string;
  challengerId: string;
  challengerName: string;
  opponentId: string;
  opponentName: string;
  typeId: string;
  target: number;
  status: DuelStatus;
  witnesses: DuelWitness[];
  // Timed exercises only: epoch ms when the shared countdown ends, and whether it finished.
  timerEndsAt: number | null;
  timerDone: boolean;
  // Hidden from the lists once the user clears a finished duel (points still count).
  dismissed: boolean;
  createdAt: number;
};

export type CreateDuelInput = {
  opponentId: string;
  typeId: string;
  target: number;
  witnessIds: string[];
};

export type MyRole = "challenger" | "opponent" | "witness" | null;

export function myRole(duel: Duel): MyRole {
  const me = getMeId();
  if (duel.challengerId === me) return "challenger";
  if (duel.opponentId === me) return "opponent";
  if ((duel.witnesses ?? []).some((w) => w.id === me)) return "witness";
  return null;
}

export function myWitness(duel: Duel): DuelWitness | undefined {
  return (duel.witnesses ?? []).find((w) => w.id === getMeId());
}

export function acceptedWitnesses(duel: Duel): DuelWitness[] {
  return (duel.witnesses ?? []).filter((w) => w.response === "accepted");
}

/** Time-based exercises run a shared countdown before results can be judged. */
export function isTimed(duel: Duel): boolean {
  return buddyChallengeTypeMap[duel.typeId]?.unit === "seconds";
}

/** Whether witnesses can start voting yet (reps: always; timed: after the countdown). */
export function readyToJudge(duel: Duel): boolean {
  return !isTimed(duel) || duel.timerDone;
}

/**
 * A participant scores only if EVERY accepted witness pressed "Done" for them.
 * Any "Failed" vote → failed (0 points). Until all witnesses have voted → pending.
 */
export function participantResult(duel: Duel, key: ParticipantKey): ParticipantResult {
  const accepted = acceptedWitnesses(duel);
  if (accepted.length === 0) return "pending";
  if (accepted.some((w) => w.votes[key] === "failed")) return "failed";
  if (accepted.every((w) => w.votes[key] === "done")) return "done";
  return "pending";
}

export function duelComplete(duel: Duel): boolean {
  return (
    readyToJudge(duel) &&
    participantResult(duel, "challenger") !== "pending" &&
    participantResult(duel, "opponent") !== "pending"
  );
}

/** Both duelists succeeded → a doubled team bonus applies to each of them. */
export function bothSucceeded(duel: Duel): boolean {
  return participantResult(duel, "challenger") === "done" && participantResult(duel, "opponent") === "done";
}

/** Points a participant earns: scaled by effort, doubled when both finish, zero on fail/pending. */
export function participantEarned(duel: Duel, key: ParticipantKey): number {
  if (participantResult(duel, key) !== "done") return 0;
  const base = pointsForTarget(duel.typeId, duel.target);
  return bothSucceeded(duel) ? base * 2 : base;
}

/** Whether the current user has an outstanding action on this duel. */
export function duelNeedsMyAction(duel: Duel): boolean {
  if (duel.dismissed) return false;
  const role = myRole(duel);
  if (role === "opponent" && duel.status === "invited") return true;
  if (duel.status !== "active" || duelComplete(duel)) return false;

  if (role === "challenger" || role === "opponent") {
    // A timed duel still needs to be started by a participant; otherwise they wait on witnesses.
    return isTimed(duel) && !duel.timerEndsAt;
  }
  if (role === "witness") {
    const w = myWitness(duel);
    if (w?.response === "pending") return true;
    if (w?.response === "accepted" && readyToJudge(duel) && (w.votes.challenger === "pending" || w.votes.opponent === "pending"))
      return true;
  }
  return false;
}

type Ctx = {
  duels: Duel[];
  points: number;
  colleagues: Colleague[];
  loading: boolean;
  createDuel: (input: CreateDuelInput) => Promise<void>;
  respondInvite: (id: string, accept: boolean) => void;
  witnessRespond: (id: string, accept: boolean) => void;
  startTimer: (id: string) => void;
  finishTimer: (id: string) => void;
  castVote: (id: string, witnessId: string, who: ParticipantKey, vote: "done" | "failed") => void;
  dismissDuel: (id: string) => void;
  actionable: Duel[];
};

const ChallengeContext = createContext<Ctx | null>(null);

export function ChallengeProvider({
  children,
  token,
  userId,
  userName
}: {
  children: ReactNode;
  token: string | null;
  userId: string | null;
  userName: string | null;
}) {
  const [duels, setDuels] = useState<Duel[]>([]);
  const [points, setPoints] = useState(0);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [loading, setLoading] = useState(true);

  // Make "me" resolvable by the role/result helpers as soon as we know the session.
  useEffect(() => {
    setMe(userId || "", userName || "You");
  }, [userId, userName]);

  const refresh = useCallback(async () => {
    if (!token) {
      setDuels([]);
      setPoints(0);
      setLoading(false);
      return;
    }
    try {
      const data = await fetchChallenges(token);
      setDuels(Array.isArray(data?.duels) ? data.duels : []);
      setPoints(typeof data?.points === "number" ? data.points : 0);
    } catch {
      // Keep the last known state on transient errors.
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Initial load of duels + colleagues, then poll for changes from other people.
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    refresh();
    fetchColleagues(token)
      .then((data) => active && setColleagues(Array.isArray(data?.colleagues) ? data.colleagues : []))
      .catch(() => {});
    const id = window.setInterval(refresh, 6000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [token, refresh]);

  // Wrap a mutating API call so the UI always re-syncs with the server afterward.
  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      if (!token) return;
      try {
        await fn();
      } catch {
        // ignore — refresh below restores authoritative state
      }
      await refresh();
    },
    [token, refresh]
  );

  const createDuel = useCallback(
    async (input: CreateDuelInput) => {
      if (!token) return;
      await run(() =>
        createChallenge(token, {
          opponentId: input.opponentId,
          typeId: input.typeId,
          target: input.target,
          witnessIds: input.witnessIds
        })
      );
    },
    [token, run]
  );

  const respondInvite = useCallback((id: string, accept: boolean) => {
    void run(() => respondChallenge(token!, id, accept));
  }, [token, run]);

  const witnessRespond = useCallback((id: string, accept: boolean) => {
    void run(() => witnessRespondChallenge(token!, id, accept));
  }, [token, run]);

  const startTimer = useCallback((id: string) => {
    void run(() => startChallenge(token!, id));
  }, [token, run]);

  const finishTimer = useCallback((id: string) => {
    void run(() => finishChallenge(token!, id));
  }, [token, run]);

  const castVote = useCallback((id: string, _witnessId: string, who: ParticipantKey, vote: "done" | "failed") => {
    // Only the witness themselves may vote — the backend authorizes against the session.
    void run(() => voteChallenge(token!, id, who, vote));
  }, [token, run]);

  const dismissDuel = useCallback((id: string) => {
    void run(() => dismissChallenge(token!, id));
  }, [token, run]);

  const actionable = useMemo(() => (duels ?? []).filter(duelNeedsMyAction), [duels]);
  const visibleDuels = useMemo(() => (duels ?? []).filter((d) => !d.dismissed), [duels]);

  // Clang the swords when a new challenge needs your attention (after first load).
  const prevActionableRef = useRef<number | null>(null);
  useEffect(() => {
    const count = actionable.length;
    if (prevActionableRef.current !== null && count > prevActionableRef.current) {
      playSwordsSound();
    }
    prevActionableRef.current = count;
  }, [actionable.length]);

  const value = useMemo<Ctx>(
    () => ({
      duels: visibleDuels,
      points,
      colleagues,
      loading,
      createDuel,
      respondInvite,
      witnessRespond,
      startTimer,
      finishTimer,
      castVote,
      dismissDuel,
      actionable
    }),
    [visibleDuels, points, colleagues, loading, createDuel, respondInvite, witnessRespond, startTimer, finishTimer, castVote, dismissDuel, actionable]
  );

  return <ChallengeContext.Provider value={value}>{children}</ChallengeContext.Provider>;
}

export function useChallenges(): Ctx {
  const ctx = useContext(ChallengeContext);
  if (!ctx) {
    // Safe no-op fallback when used outside a provider (e.g. non-employee shells).
    return {
      duels: [],
      points: 0,
      colleagues: [],
      loading: false,
      createDuel: async () => {},
      respondInvite: () => {},
      witnessRespond: () => {},
      startTimer: () => {},
      finishTimer: () => {},
      castVote: () => {},
      dismissDuel: () => {},
      actionable: []
    };
  }
  return ctx;
}
