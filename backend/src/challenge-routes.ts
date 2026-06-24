import type { Express, NextFunction, Request, Response } from "express";
import type { PrismaClient, User } from "@prisma/client";
import { z } from "zod";

type AuthedRequest = Request & { user?: User };

// Exercise catalog mirrored from the frontend (challenge-types.ts). Points scale
// with effort: rate = points / defaultTarget, so the default target is worth the
// listed base points and harder targets are worth proportionally more.
type ExerciseDef = { unit: "reps" | "seconds"; defaultTarget: number; points: number };
const EXERCISES: Record<string, ExerciseDef> = {
  squats: { unit: "reps", defaultTarget: 20, points: 50 },
  pushups: { unit: "reps", defaultTarget: 15, points: 60 },
  pullups: { unit: "reps", defaultTarget: 8, points: 80 },
  plank: { unit: "seconds", defaultTarget: 60, points: 50 },
  "squat-hold": { unit: "seconds", defaultTarget: 45, points: 50 },
  "reverse-plank": { unit: "seconds", defaultTarget: 45, points: 60 },
  "pullup-hold": { unit: "seconds", defaultTarget: 20, points: 70 }
};

function pointsForTarget(typeId: string, target: number): number {
  const t = EXERCISES[typeId];
  if (!t) return 0;
  const rate = t.points / t.defaultTarget;
  return Math.max(1, Math.round(rate * target));
}

function isTimed(typeId: string): boolean {
  return EXERCISES[typeId]?.unit === "seconds";
}

type WitnessRow = { userId: string; response: string; challengerVote: string; opponentVote: string };
type DuelRow = {
  id: string;
  typeId: string;
  target: number;
  status: string;
  timerDone: boolean;
  witnesses: WitnessRow[];
};

type ParticipantKey = "challenger" | "opponent";
type VoteField = "challengerVote" | "opponentVote";
const voteField = (key: ParticipantKey): VoteField => (key === "challenger" ? "challengerVote" : "opponentVote");

function acceptedWitnesses(d: DuelRow): WitnessRow[] {
  return d.witnesses.filter((w) => w.response === "accepted");
}

function readyToJudge(d: DuelRow): boolean {
  return !isTimed(d.typeId) || d.timerDone;
}

// A participant scores only if EVERY accepted witness called "Done"; any "Failed"
// → failed; otherwise still pending. Rejected/unstarted duels never score.
function participantResult(d: DuelRow, key: ParticipantKey): "pending" | "done" | "failed" {
  if (d.status !== "active" || !readyToJudge(d)) return "pending";
  const accepted = acceptedWitnesses(d);
  if (accepted.length === 0) return "pending";
  const field = voteField(key);
  if (accepted.some((w) => w[field] === "failed")) return "failed";
  if (accepted.every((w) => w[field] === "done")) return "done";
  return "pending";
}

function bothDone(d: DuelRow): boolean {
  return participantResult(d, "challenger") === "done" && participantResult(d, "opponent") === "done";
}

function earned(d: DuelRow, key: ParticipantKey): number {
  if (participantResult(d, key) !== "done") return 0;
  const base = pointsForTarget(d.typeId, d.target);
  return bothDone(d) ? base * 2 : base;
}

const DUEL_INCLUDE = {
  challenger: { select: { name: true } },
  opponent: { select: { name: true } },
  witnesses: { include: { user: { select: { name: true } } } }
} as const;

const createSchema = z.object({
  opponentId: z.string().min(1),
  typeId: z.string().refine((v) => v in EXERCISES, "Unknown exercise"),
  target: z.number().int().positive().max(6000),
  witnessIds: z.array(z.string().min(1)).min(1).max(5)
});
const respondSchema = z.object({ accept: z.boolean() });
const voteSchema = z.object({
  who: z.enum(["challenger", "opponent"]),
  vote: z.enum(["done", "failed"])
});

export function registerChallengeRoutes(
  app: Express,
  prisma: PrismaClient,
  auth: (req: AuthedRequest, res: Response, next: NextFunction) => void
) {
  function serialize(d: any, meId: string) {
    return {
      id: d.id,
      challengerId: d.challengerId,
      challengerName: d.challenger.name,
      opponentId: d.opponentId,
      opponentName: d.opponent.name,
      typeId: d.typeId,
      target: d.target,
      status: d.status,
      timerEndsAt: d.timerEndsAt ? new Date(d.timerEndsAt).getTime() : null,
      timerDone: d.timerDone,
      dismissed: Array.isArray(d.dismissedBy) ? d.dismissedBy.includes(meId) : false,
      createdAt: new Date(d.createdAt).getTime(),
      witnesses: d.witnesses.map((w: any) => ({
        id: w.userId,
        name: w.user.name,
        response: w.response,
        votes: { challenger: w.challengerVote, opponent: w.opponentVote }
      }))
    };
  }

  function isMember(d: { challengerId: string; opponentId: string; witnesses: WitnessRow[] }, meId: string) {
    return d.challengerId === meId || d.opponentId === meId || d.witnesses.some((w) => w.userId === meId);
  }

  // Re-credit each participant's wellness score whenever a duel's outcome changes.
  // We store how much we've already credited so toggling a witness vote cleanly
  // adds or removes the delta (no double counting, refunds on reversal).
  async function reconcile(duelId: string) {
    const d = await prisma.duel.findUnique({ where: { id: duelId }, include: { witnesses: true } });
    if (!d) return;
    const cEarn = earned(d, "challenger");
    const oEarn = earned(d, "opponent");
    const cDelta = cEarn - d.challengerPoints;
    const oDelta = oEarn - d.opponentPoints;
    if (cDelta !== 0) {
      await prisma.user.update({ where: { id: d.challengerId }, data: { totalWellnessScore: { increment: cDelta } } });
    }
    if (oDelta !== 0) {
      await prisma.user.update({ where: { id: d.opponentId }, data: { totalWellnessScore: { increment: oDelta } } });
    }
    if (cDelta !== 0 || oDelta !== 0) {
      await prisma.duel.update({ where: { id: duelId }, data: { challengerPoints: cEarn, opponentPoints: oEarn } });
    }
  }

  async function loadAndRespond(id: string, meId: string, res: Response) {
    const fresh = await prisma.duel.findUnique({ where: { id }, include: DUEL_INCLUDE });
    if (!fresh) return res.status(404).json({ message: "Duel not found." });
    res.json({ duel: serialize(fresh, meId) });
  }

  // All duels the current user is part of (challenger, opponent, or witness),
  // plus the total points already credited to them from challenges.
  app.get("/api/challenges", auth, async (req: AuthedRequest, res, next) => {
    try {
      const me = req.user!.id;
      const duels = await prisma.duel.findMany({
        where: {
          OR: [{ challengerId: me }, { opponentId: me }, { witnesses: { some: { userId: me } } }]
        },
        include: DUEL_INCLUDE,
        orderBy: { createdAt: "desc" }
      });
      let points = 0;
      for (const d of duels) {
        if (d.challengerId === me) points += d.challengerPoints;
        if (d.opponentId === me) points += d.opponentPoints;
      }
      res.json({ duels: duels.map((d) => serialize(d, me)), points });
    } catch (error) {
      next(error);
    }
  });

  // Colleagues the user can challenge / pick as witnesses (employees in their company).
  app.get("/api/challenges/colleagues", auth, async (req: AuthedRequest, res, next) => {
    try {
      const me = req.user!;
      const users = await prisma.user.findMany({
        where: {
          id: { not: me.id },
          role: "EMPLOYEE",
          ...(me.companyId ? { companyId: me.companyId } : {})
        },
        select: { id: true, name: true, department: { select: { name: true } } },
        orderBy: { name: "asc" }
      });
      res.json({
        colleagues: users.map((u) => ({ id: u.id, name: u.name, department: u.department?.name || "" }))
      });
    } catch (error) {
      next(error);
    }
  });

  // Create a duel: invites the opponent and the chosen witnesses.
  app.post("/api/challenges", auth, async (req: AuthedRequest, res, next) => {
    try {
      const me = req.user!;
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Pick a buddy, an exercise, a target, and witnesses." });
      const { opponentId, typeId, target, witnessIds } = parsed.data;
      if (opponentId === me.id) return res.status(400).json({ message: "You can't challenge yourself." });

      const uniqueWitnesses = [...new Set(witnessIds)].filter((id) => id !== me.id && id !== opponentId);
      if (uniqueWitnesses.length === 0) {
        return res.status(400).json({ message: "Choose witnesses other than the two duelists." });
      }

      const opponent = await prisma.user.findUnique({ where: { id: opponentId } });
      if (!opponent) return res.status(404).json({ message: "That buddy could not be found." });

      const duel = await prisma.duel.create({
        data: {
          companyId: me.companyId ?? null,
          challengerId: me.id,
          opponentId,
          typeId,
          target,
          status: "invited",
          witnesses: { create: uniqueWitnesses.map((userId) => ({ userId })) }
        },
        include: DUEL_INCLUDE
      });
      res.status(201).json({ duel: serialize(duel, me.id) });
    } catch (error) {
      next(error);
    }
  });

  // Opponent accepts or rejects the invite.
  app.post("/api/challenges/:id/respond", auth, async (req: AuthedRequest, res, next) => {
    try {
      const me = req.user!.id;
      const parsed = respondSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid response." });
      const duel = await prisma.duel.findUnique({ where: { id: req.params.id }, include: { witnesses: true } });
      if (!duel) return res.status(404).json({ message: "Duel not found." });
      if (duel.opponentId !== me) return res.status(403).json({ message: "Only the challenged buddy can respond." });
      if (duel.status !== "invited") return res.status(409).json({ message: "This invite was already answered." });
      await prisma.duel.update({
        where: { id: duel.id },
        data: { status: parsed.data.accept ? "active" : "rejected" }
      });
      await reconcile(duel.id);
      await loadAndRespond(duel.id, me, res);
    } catch (error) {
      next(error);
    }
  });

  // A witness accepts or declines (busy) the request to verify.
  app.post("/api/challenges/:id/witness", auth, async (req: AuthedRequest, res, next) => {
    try {
      const me = req.user!.id;
      const parsed = respondSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid response." });
      const witness = await prisma.duelWitness.findUnique({
        where: { duelId_userId: { duelId: req.params.id, userId: me } }
      });
      if (!witness) return res.status(403).json({ message: "You are not a witness on this duel." });
      await prisma.duelWitness.update({
        where: { duelId_userId: { duelId: req.params.id, userId: me } },
        data: { response: parsed.data.accept ? "accepted" : "busy" }
      });
      await reconcile(req.params.id);
      await loadAndRespond(req.params.id, me, res);
    } catch (error) {
      next(error);
    }
  });

  // A participant starts the shared countdown for a timed exercise.
  app.post("/api/challenges/:id/start", auth, async (req: AuthedRequest, res, next) => {
    try {
      const me = req.user!.id;
      const duel = await prisma.duel.findUnique({ where: { id: req.params.id }, include: { witnesses: true } });
      if (!duel) return res.status(404).json({ message: "Duel not found." });
      if (duel.challengerId !== me && duel.opponentId !== me) {
        return res.status(403).json({ message: "Only a duelist can start the timer." });
      }
      if (duel.status !== "active") return res.status(409).json({ message: "The duel is not active yet." });
      if (!isTimed(duel.typeId)) return res.status(400).json({ message: "This exercise is not timed." });
      if (duel.timerEndsAt) return res.status(409).json({ message: "The timer is already running." });
      await prisma.duel.update({
        where: { id: duel.id },
        data: { timerEndsAt: new Date(Date.now() + duel.target * 1000), timerDone: false }
      });
      await loadAndRespond(duel.id, me, res);
    } catch (error) {
      next(error);
    }
  });

  // Mark a timed duel finished once the countdown elapses.
  app.post("/api/challenges/:id/finish", auth, async (req: AuthedRequest, res, next) => {
    try {
      const me = req.user!.id;
      const duel = await prisma.duel.findUnique({ where: { id: req.params.id }, include: { witnesses: true } });
      if (!duel) return res.status(404).json({ message: "Duel not found." });
      if (!isMember(duel, me)) return res.status(403).json({ message: "You are not part of this duel." });
      if (duel.timerDone) return loadAndRespond(duel.id, me, res);
      if (!duel.timerEndsAt || Date.now() < new Date(duel.timerEndsAt).getTime() - 1500) {
        return res.status(409).json({ message: "The timer has not finished yet." });
      }
      await prisma.duel.update({ where: { id: duel.id }, data: { timerDone: true } });
      await reconcile(duel.id);
      await loadAndRespond(duel.id, me, res);
    } catch (error) {
      next(error);
    }
  });

  // A witness records their Done/Failed call for a participant (toggle).
  app.post("/api/challenges/:id/vote", auth, async (req: AuthedRequest, res, next) => {
    try {
      const me = req.user!.id;
      const parsed = voteSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid vote." });
      const duel = await prisma.duel.findUnique({ where: { id: req.params.id }, include: { witnesses: true } });
      if (!duel) return res.status(404).json({ message: "Duel not found." });
      const witness = duel.witnesses.find((w) => w.userId === me);
      if (!witness) return res.status(403).json({ message: "Only a witness can vote." });
      if (witness.response !== "accepted") return res.status(409).json({ message: "Accept the witness request first." });
      if (duel.status !== "active") return res.status(409).json({ message: "The duel is not active." });
      if (!readyToJudge(duel)) return res.status(409).json({ message: "Wait for the timer to finish." });

      const field = voteField(parsed.data.who);
      const current = witness[field];
      const next = current === parsed.data.vote ? "pending" : parsed.data.vote;
      await prisma.duelWitness.update({
        where: { duelId_userId: { duelId: duel.id, userId: me } },
        data: { [field]: next }
      });
      await reconcile(duel.id);
      await loadAndRespond(duel.id, me, res);
    } catch (error) {
      next(error);
    }
  });

  // Hide a finished duel from the current user's lists (points are kept).
  app.post("/api/challenges/:id/dismiss", auth, async (req: AuthedRequest, res, next) => {
    try {
      const me = req.user!.id;
      const duel = await prisma.duel.findUnique({ where: { id: req.params.id }, include: { witnesses: true } });
      if (!duel) return res.status(404).json({ message: "Duel not found." });
      if (!isMember(duel, me)) return res.status(403).json({ message: "You are not part of this duel." });
      if (!duel.dismissedBy.includes(me)) {
        await prisma.duel.update({ where: { id: duel.id }, data: { dismissedBy: { push: me } } });
      }
      await loadAndRespond(duel.id, me, res);
    } catch (error) {
      next(error);
    }
  });
}
