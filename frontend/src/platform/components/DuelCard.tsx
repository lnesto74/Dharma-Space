import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, Clock, Play, X, XCircle } from "lucide-react";
import { ME_ID, buddyChallengeTypeMap, targetLabel } from "../challenge-types";
import { playFinishSound, playStartSound } from "../sounds";
import {
  acceptedWitnesses,
  bothSucceeded,
  duelComplete,
  isTimed,
  myRole,
  myWitness,
  participantEarned,
  participantResult,
  readyToJudge,
  useChallenges,
  type Duel,
  type DuelWitness,
  type ParticipantKey,
  type ParticipantResult
} from "../challenge-store";

function clockLabel(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function matchupLine(duel: Duel, role: ReturnType<typeof myRole>) {
  if (role === "challenger") return `You challenged ${duel.opponentName}`;
  if (role === "opponent") return `${duel.challengerName} challenged you`;
  return `${duel.challengerName} vs ${duel.opponentName}`;
}

function ResultChip({ result, points, doubled }: { result: ParticipantResult; points: number; doubled?: boolean }) {
  if (result === "done")
    return (
      <span className="flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--cwp-seafoam)_34%,white)] px-2.5 py-1 text-[11px] font-semibold text-navy">
        <CheckCircle2 size={12} /> Done <span className="text-[var(--cwp-olive)]">+{points}</span>
        {doubled && <span className="rounded-full bg-[var(--cwp-olive)] px-1.5 text-[9px] font-bold text-white">×2</span>}
      </span>
    );
  if (result === "failed")
    return (
      <span className="flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--cwp-terracotta)_26%,white)] px-2.5 py-1 text-[11px] font-semibold text-navy">
        <XCircle size={12} /> Failed <span className="text-stone">+0</span>
      </span>
    );
  return (
    <span className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-stone">
      <Clock size={12} /> Pending
    </span>
  );
}

export function DuelCard({ duel }: { duel: Duel }) {
  const { respondInvite, witnessRespond, startTimer, finishTimer, castVote, dismissDuel } = useChallenges();
  const t = buddyChallengeTypeMap[duel.typeId];
  const role = myRole(duel);
  const witness = myWitness(duel);

  const timed = isTimed(duel);
  const timerRunning = Boolean(duel.timerEndsAt) && !duel.timerDone;
  const ready = readyToJudge(duel);
  const complete = duelComplete(duel);
  const accepted = acceptedWitnesses(duel);
  const isParticipant = role === "challenger" || role === "opponent";

  // Live countdown tick while a timed duel is running.
  const [now, setNow] = useState(() => Date.now());
  const finishFiredRef = useRef(false);
  useEffect(() => {
    if (!timerRunning || !duel.timerEndsAt) return;
    finishFiredRef.current = false;
    const tick = () => {
      const t2 = Date.now();
      setNow(t2);
      if (duel.timerEndsAt && t2 >= duel.timerEndsAt) {
        if (!finishFiredRef.current) {
          finishFiredRef.current = true;
          playFinishSound();
        }
        finishTimer(duel.id);
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [timerRunning, duel.timerEndsAt, duel.id, finishTimer]);

  const remaining = duel.timerEndsAt ? Math.ceil((duel.timerEndsAt - now) / 1000) : 0;

  // I can log a witness's call if it's my own, or (demo) I'm a duelist collecting confirmations.
  const canVote = (w: DuelWitness) =>
    duel.status === "active" && ready && w.response === "accepted" && (w.id === ME_ID || isParticipant);

  const statusBadge = () => {
    if (duel.status === "rejected")
      return <span className="rounded-full bg-[color-mix(in_srgb,var(--cwp-terracotta)_24%,white)] px-3 py-1 text-[11px] font-semibold text-navy">Declined</span>;
    if (duel.status === "invited")
      return <span className="rounded-full bg-[color-mix(in_srgb,var(--cwp-yellow)_34%,white)] px-3 py-1 text-[11px] font-semibold text-navy">Invite pending</span>;
    if (complete)
      return (
        <button
          type="button"
          onClick={() => dismissDuel(duel.id)}
          title="Clear this duel"
          className="flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--cwp-seafoam)_30%,white)] px-3 py-1 text-[11px] font-semibold text-navy transition-colors hover:bg-[color-mix(in_srgb,var(--cwp-seafoam)_48%,white)]"
        >
          Completed <X size={12} />
        </button>
      );
    return <span className="rounded-full bg-[color-mix(in_srgb,var(--cwp-yellow)_34%,white)] px-3 py-1 text-[11px] font-semibold text-navy">In progress</span>;
  };

  const participants: { key: ParticipantKey; name: string }[] = [
    { key: "challenger", name: duel.challengerName },
    { key: "opponent", name: duel.opponentName }
  ];

  const showRows = (duel.status === "active") && !(role === "witness" && witness?.response !== "accepted");

  return (
    <div className="rounded-4xl bg-white/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src={t.icon} alt="" className="h-10 w-10 shrink-0 object-contain" />
          <div>
            <p className="font-semibold text-navy">{matchupLine(duel, role)}</p>
            <p className="text-sm text-stone">{targetLabel(duel.typeId, duel.target)} · {t.label}</p>
          </div>
        </div>
        {statusBadge()}
      </div>

      {/* Opponent invite: accept / reject */}
      {role === "opponent" && duel.status === "invited" && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => respondInvite(duel.id, true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--cwp-olive)] px-4 py-2 text-sm font-semibold text-white"
          >
            <Check size={15} /> Accept
          </button>
          <button
            type="button"
            onClick={() => respondInvite(duel.id, false)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-[color-mix(in_srgb,var(--cwp-terracotta)_12%,white)]"
          >
            <X size={15} /> Reject
          </button>
        </div>
      )}

      {/* Witness: accept / I'm busy */}
      {role === "witness" && duel.status === "active" && witness?.response === "pending" && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-stone">You were chosen as a witness.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => witnessRespond(duel.id, true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--cwp-olive)] px-4 py-2 text-sm font-semibold text-white"
            >
              <Check size={15} /> Accept
            </button>
            <button
              type="button"
              onClick={() => witnessRespond(duel.id, false)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-[color-mix(in_srgb,var(--cwp-sand)_40%,white)]"
            >
              I&apos;m busy
            </button>
          </div>
        </div>
      )}

      {role === "witness" && witness?.response === "busy" && (
        <p className="mt-3 text-xs text-stone">You declined to witness this duel.</p>
      )}

      {/* Participants: start/countdown, score, and per-witness verification */}
      {showRows && (
        <div className="mt-3 grid gap-2">
          {timed && (
            <p className="px-1 text-[11px] text-stone">
              {!duel.timerEndsAt
                ? `Hold for ${targetLabel(duel.typeId, duel.target)} — press Start when both are ready.`
                : timerRunning
                  ? "Timer running on both sides…"
                  : "Time's up! Each witness logs Done or Failed — all must say Done to score."}
            </p>
          )}
          {complete && bothSucceeded(duel) && (
            <p className="rounded-3xl bg-[color-mix(in_srgb,var(--cwp-seafoam)_30%,white)] px-3 py-2 text-[11px] font-semibold text-navy">
              🎉 Team bonus! You both finished — points doubled.
            </p>
          )}
          {participants.map(({ key, name }) => {
            const showStart = timed && !duel.timerEndsAt;
            const showCountdown = timed && timerRunning;
            const agg = participantResult(duel, key);
            return (
              <div key={key} className="rounded-3xl bg-white/80 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-navy">{name}</span>
                  {showStart ? (
                    isParticipant ? (
                      <button
                        type="button"
                        onClick={() => {
                          playStartSound();
                          startTimer(duel.id);
                        }}
                        className="flex items-center gap-1 rounded-full bg-[var(--cwp-terracotta)] px-3.5 py-1 text-[11px] font-semibold text-white shadow-sm"
                      >
                        <Play size={12} /> Start
                      </button>
                    ) : (
                      <span className="text-[11px] text-stone">Waiting to start…</span>
                    )
                  ) : showCountdown ? (
                    <span className="flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--cwp-terracotta)_22%,white)] px-3 py-1 text-[11px] font-bold tabular-nums text-[var(--cwp-terracotta)]">
                      <Clock size={12} /> {clockLabel(remaining)}
                    </span>
                  ) : (
                    <ResultChip result={agg} points={participantEarned(duel, key)} doubled={bothSucceeded(duel)} />
                  )}
                </div>

                {/* Per-witness Done/Failed calls for this participant */}
                {ready && !showCountdown && accepted.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-stone">Witnesses</span>
                    {accepted.map((w) => {
                      const v = w.votes[key];
                      const editable = canVote(w);
                      if (editable) {
                        return (
                          <span key={w.id} className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] shadow-sm">
                            <span className={w.id === ME_ID ? "font-semibold text-navy" : "text-stone"}>
                              {w.name.split(" ")[0]}{w.id === ME_ID ? " (you)" : ""}
                            </span>
                            <button
                              type="button"
                              onClick={() => castVote(duel.id, w.id, key, "done")}
                              aria-label={`${w.name}: Done`}
                              className={`grid h-5 w-5 place-items-center rounded-full ${
                                v === "done" ? "bg-[var(--cwp-olive)] text-white" : "bg-[var(--cwp-bg)] text-stone hover:text-[var(--cwp-olive)]"
                              }`}
                            >
                              <Check size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => castVote(duel.id, w.id, key, "failed")}
                              aria-label={`${w.name}: Failed`}
                              className={`grid h-5 w-5 place-items-center rounded-full ${
                                v === "failed" ? "bg-[var(--cwp-terracotta)] text-white" : "bg-[var(--cwp-bg)] text-stone hover:text-[var(--cwp-terracotta)]"
                              }`}
                            >
                              <X size={11} />
                            </button>
                          </span>
                        );
                      }
                      return (
                        <span
                          key={w.id}
                          className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ${
                            v === "done"
                              ? "bg-[color-mix(in_srgb,var(--cwp-seafoam)_30%,white)] text-navy"
                              : v === "failed"
                                ? "bg-[color-mix(in_srgb,var(--cwp-terracotta)_22%,white)] text-navy"
                                : "bg-white text-stone"
                          }`}
                        >
                          {w.name.split(" ")[0]}
                          {v === "done" ? <Check size={11} /> : v === "failed" ? <X size={11} /> : <Clock size={11} />}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Witness response roster (who's in / busy) */}
      {duel.witnesses.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.14em] text-stone">Roster</span>
          {duel.witnesses.map((w) => (
            <span
              key={w.id}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                w.response === "accepted"
                  ? "bg-[color-mix(in_srgb,var(--cwp-seafoam)_30%,white)] text-navy"
                  : w.response === "busy"
                    ? "bg-[color-mix(in_srgb,var(--cwp-sand)_45%,white)] text-stone"
                    : "bg-white text-stone"
              }`}
            >
              {w.name.split(" ")[0]}
              {w.response === "accepted" ? " ✓" : w.response === "busy" ? " · busy" : " · pending"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
