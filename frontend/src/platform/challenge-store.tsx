import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ME_ID, ME_NAME, buddyChallengeTypeMap, pointsForTarget } from "./challenge-types";
import { playSwordsSound } from "./sounds";

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
  // Timed exercises only: when the shared countdown ends, and whether it finished.
  timerEndsAt: number | null;
  timerDone: boolean;
  // Hidden from the lists once the user clears a finished duel (points still count).
  dismissed: boolean;
  createdAt: number;
};

export type CreateDuelInput = {
  opponentId: string;
  opponentName: string;
  typeId: string;
  target: number;
  witnesses: { id: string; name: string }[];
};

const noVotes = (): WitnessVotes => ({ challenger: "pending", opponent: "pending" });

const seedDuels: Duel[] = [
  {
    // Incoming invite to me: I decide accept/reject, then start the timed plank.
    id: "duel-invite",
    challengerId: "u-theo",
    challengerName: "Theo Malik",
    opponentId: ME_ID,
    opponentName: ME_NAME,
    typeId: "plank",
    target: 90,
    status: "invited",
    witnesses: [
      { id: "u-ava", name: "Ava Morgan", response: "accepted", votes: noVotes() },
      { id: "u-noah", name: "Noah Kim", response: "accepted", votes: noVotes() },
      { id: "u-iris", name: "Iris Wong", response: "accepted", votes: noVotes() }
    ],
    timerEndsAt: null,
    timerDone: false,
    dismissed: false,
    createdAt: Date.now() - 60000
  },
  {
    // I'm the deciding 3rd witness — the others already pressed Done.
    id: "duel-witness",
    challengerId: "u-ava",
    challengerName: "Ava Morgan",
    opponentId: "u-priya",
    opponentName: "Priya Shah",
    typeId: "squats",
    target: 25,
    status: "active",
    witnesses: [
      { id: ME_ID, name: ME_NAME, response: "accepted", votes: noVotes() },
      { id: "u-noah", name: "Noah Kim", response: "accepted", votes: { challenger: "done", opponent: "done" } },
      { id: "u-felix", name: "Felix Grant", response: "accepted", votes: { challenger: "done", opponent: "done" } }
    ],
    timerEndsAt: null,
    timerDone: false,
    dismissed: false,
    createdAt: Date.now() - 120000
  },
  {
    // Completed: all witnesses confirmed me (Done → +points); opponent had a Failed vote.
    id: "duel-done",
    challengerId: ME_ID,
    challengerName: ME_NAME,
    opponentId: "u-lina",
    opponentName: "Lina Cortez",
    typeId: "pullups",
    target: 8,
    status: "active",
    witnesses: [
      { id: "u-rowan", name: "Rowan Diaz", response: "accepted", votes: { challenger: "done", opponent: "done" } },
      { id: "u-iris", name: "Iris Wong", response: "accepted", votes: { challenger: "done", opponent: "failed" } },
      { id: "u-felix", name: "Felix Grant", response: "accepted", votes: { challenger: "done", opponent: "done" } }
    ],
    timerEndsAt: null,
    timerDone: true,
    dismissed: false,
    createdAt: Date.now() - 300000
  }
];

export type MyRole = "challenger" | "opponent" | "witness" | null;

export function myRole(duel: Duel): MyRole {
  if (duel.challengerId === ME_ID) return "challenger";
  if (duel.opponentId === ME_ID) return "opponent";
  if (duel.witnesses.some((w) => w.id === ME_ID)) return "witness";
  return null;
}

export function myWitness(duel: Duel): DuelWitness | undefined {
  return duel.witnesses.find((w) => w.id === ME_ID);
}

export function acceptedWitnesses(duel: Duel): DuelWitness[] {
  return duel.witnesses.filter((w) => w.response === "accepted");
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

function myPointsForDuel(duel: Duel): number {
  let pts = 0;
  if (duel.challengerId === ME_ID) pts += participantEarned(duel, "challenger");
  if (duel.opponentId === ME_ID) pts += participantEarned(duel, "opponent");
  return pts;
}

/** Whether the current user has an outstanding action on this duel. */
export function duelNeedsMyAction(duel: Duel): boolean {
  if (duel.dismissed) return false;
  const role = myRole(duel);
  if (role === "opponent" && duel.status === "invited") return true;
  if (duel.status !== "active" || duelComplete(duel)) return false;

  if (role === "challenger" || role === "opponent") {
    // Timed duel still needs to be started by a participant.
    if (isTimed(duel) && !duel.timerEndsAt) return true;
    // Otherwise the participant collects their witnesses' calls.
    if (readyToJudge(duel)) return true;
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
  createDuel: (input: CreateDuelInput) => void;
  respondInvite: (id: string, accept: boolean) => void;
  witnessRespond: (id: string, accept: boolean) => void;
  startTimer: (id: string) => void;
  finishTimer: (id: string) => void;
  castVote: (id: string, witnessId: string, who: ParticipantKey, vote: "done" | "failed") => void;
  dismissDuel: (id: string) => void;
  actionable: Duel[];
};

const ChallengeContext = createContext<Ctx | null>(null);

export function ChallengeProvider({ children }: { children: ReactNode }) {
  const [duels, setDuels] = useState<Duel[]>(seedDuels);

  // Points are fully derived from witness votes — you earn only when all witnesses said Done.
  const points = useMemo(() => duels.reduce((sum, d) => sum + myPointsForDuel(d), 0), [duels]);

  const createDuel = useCallback((input: CreateDuelInput) => {
    const duel: Duel = {
      id: `duel-${Date.now()}`,
      challengerId: ME_ID,
      challengerName: ME_NAME,
      opponentId: input.opponentId,
      opponentName: input.opponentName,
      typeId: input.typeId,
      target: input.target,
      // Demo: opponent auto-accepts and chosen witnesses are on board so the duel is playable.
      status: "active",
      witnesses: input.witnesses.map((w) => ({ id: w.id, name: w.name, response: "accepted", votes: noVotes() })),
      timerEndsAt: null,
      timerDone: false,
      dismissed: false,
      createdAt: Date.now()
    };
    setDuels((prev) => [duel, ...prev]);
  }, []);

  const dismissDuel = useCallback((id: string) => {
    setDuels((prev) => prev.map((d) => (d.id === id ? { ...d, dismissed: true } : d)));
  }, []);

  const startTimer = useCallback((id: string) => {
    setDuels((prev) =>
      prev.map((d) => {
        if (d.id !== id || d.status !== "active" || d.timerEndsAt) return d;
        return { ...d, timerEndsAt: Date.now() + d.target * 1000, timerDone: false };
      })
    );
  }, []);

  const finishTimer = useCallback((id: string) => {
    setDuels((prev) => prev.map((d) => (d.id === id && !d.timerDone ? { ...d, timerDone: true } : d)));
  }, []);

  const respondInvite = useCallback((id: string, accept: boolean) => {
    setDuels((prev) => prev.map((d) => (d.id === id ? { ...d, status: accept ? "active" : "rejected" } : d)));
  }, []);

  const witnessRespond = useCallback((id: string, accept: boolean) => {
    setDuels((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, witnesses: d.witnesses.map((w) => (w.id === ME_ID ? { ...w, response: accept ? "accepted" : "busy" } : w)) }
          : d
      )
    );
  }, []);

  const castVote = useCallback((id: string, witnessId: string, who: ParticipantKey, vote: "done" | "failed") => {
    setDuels((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              witnesses: d.witnesses.map((w) =>
                w.id === witnessId && w.response === "accepted"
                  ? { ...w, votes: { ...w.votes, [who]: w.votes[who] === vote ? "pending" : vote } }
                  : w
              )
            }
          : d
      )
    );
  }, []);

  const actionable = useMemo(() => duels.filter(duelNeedsMyAction), [duels]);
  const visibleDuels = useMemo(() => duels.filter((d) => !d.dismissed), [duels]);

  // Clang the swords when a new challenge needs your attention (after first render).
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
      createDuel,
      respondInvite,
      witnessRespond,
      startTimer,
      finishTimer,
      castVote,
      dismissDuel,
      actionable
    }),
    [visibleDuels, points, createDuel, respondInvite, witnessRespond, startTimer, finishTimer, castVote, dismissDuel, actionable]
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
      createDuel: () => {},
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
