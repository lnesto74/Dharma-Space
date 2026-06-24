import { useState } from "react";
import { Swords, X } from "lucide-react";
import { useChallenges } from "../challenge-store";
import { DuelCard } from "./DuelCard";

export function ChallengeWidget() {
  const { duels, actionable } = useChallenges();
  const [open, setOpen] = useState(false);
  const count = actionable.length;

  // Show duels needing action first, then the rest for context.
  const others = duels.filter((d) => !actionable.some((a) => a.id === d.id));

  return (
    <div className="fixed bottom-[5.75rem] right-5 z-[60] flex flex-col items-end">
      {open && (
        <div className="mb-3 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-[var(--cwp-border)] bg-[var(--cwp-surface)] shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-[var(--cwp-border)] bg-[color-mix(in_srgb,var(--cwp-terracotta)_18%,white)] px-3 py-3">
            <Swords size={18} className="ml-1 text-[var(--cwp-terracotta)]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--cwp-charcoal)]">Buddy Challenges</p>
              <p className="truncate text-[11px] text-[var(--cwp-text-muted)]">
                {count > 0 ? `${count} need${count === 1 ? "s" : ""} your action` : "You're all caught up"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-full text-[var(--cwp-text-muted)] hover:bg-white/50"
              aria-label="Close challenges"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-[var(--cwp-bg)] p-3">
            {duels.length === 0 && (
              <p className="px-2 py-10 text-center text-sm text-[var(--cwp-text-muted)]">
                No challenges yet. Head to the Buddy Challenge page to start one.
              </p>
            )}

            {actionable.length > 0 && (
              <>
                <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--cwp-terracotta)]">
                  Needs your action
                </p>
                {actionable.map((duel) => (
                  <DuelCard key={duel.id} duel={duel} />
                ))}
              </>
            )}

            {others.length > 0 && (
              <>
                <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--cwp-text-muted)]">
                  Recent duels
                </p>
                {others.map((duel) => (
                  <DuelCard key={duel.id} duel={duel} />
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-14 w-14 place-items-center rounded-full bg-[var(--cwp-terracotta)] text-white shadow-xl transition-transform hover:scale-105"
        aria-label="Buddy challenges"
      >
        {open ? <X size={22} /> : <Swords size={22} />}
        {!open && count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--cwp-error)] px-1.5 text-[10px] font-semibold text-white ring-2 ring-[var(--cwp-surface)]">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
    </div>
  );
}
