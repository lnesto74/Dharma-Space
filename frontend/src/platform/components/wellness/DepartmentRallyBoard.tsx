import { Flag, TrendingUp, Users } from "lucide-react";
import type { DepartmentLeaderboardEntry } from "../../../types/wellness";

type Props = {
  departments: DepartmentLeaderboardEntry[];
  userDepartmentRank?: { rank: number | null; totalDepts: number };
};

const laneAccent = ["var(--cwp-terracotta)", "var(--cwp-periwinkle)", "var(--cwp-seafoam)", "var(--cwp-yellow)", "var(--cwp-slate)", "var(--cwp-peach)"];

export function DepartmentRallyBoard({ departments, userDepartmentRank }: Props) {
  const maxAttendance = Math.max(1, ...departments.map((d) => d.avgAttendancePct));

  return (
    <section className="cwp-dept-rally overflow-hidden rounded-[2rem] p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[var(--cwp-olive)]">
            <Users size={18} strokeWidth={1.75} />
            <p className="text-xs font-semibold uppercase tracking-[0.22em]">Team rally</p>
          </div>
          <h2 className="text-2xl font-light text-navy md:text-3xl">Department showdown</h2>
          <p className="mt-1 text-sm text-stone">See how your team stacks up — attendance, streaks, and momentum.</p>
        </div>
        {userDepartmentRank?.rank != null && (
          <div className="rounded-2xl border border-[var(--cwp-border)] bg-white/60 px-4 py-3 text-sm">
            <span className="text-stone">Your department</span>
            <p className="font-semibold text-navy">
              #{userDepartmentRank.rank} of {userDepartmentRank.totalDepts}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {departments.map((dept, index) => {
          const width = (dept.avgAttendancePct / maxAttendance) * 100;
          const accent = laneAccent[index % laneAccent.length];
          return (
            <div
              key={dept.id}
              className="cwp-dept-rally-lane grid gap-3 rounded-2xl border border-white/50 bg-white/45 p-4 md:grid-cols-[auto_1fr_auto] md:items-center"
            >
              <div className="flex items-center gap-3">
                <span
                  className="grid h-11 w-11 place-items-center rounded-2xl text-sm font-bold text-white"
                  style={{ background: accent }}
                >
                  #{dept.rank}
                </span>
                <div>
                  <p className="font-semibold text-navy">{dept.name}</p>
                  {dept.mostImproved && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--cwp-terracotta)]">
                      <TrendingUp size={13} strokeWidth={1.75} />
                      Momentum leader
                    </span>
                  )}
                </div>
              </div>

              <div className="min-w-0">
                <div className="mb-1 flex justify-between text-xs font-medium text-stone">
                  <span>Avg attendance</span>
                  <span>{dept.avgAttendancePct}%</span>
                </div>
                <div className="cwp-dept-rally-track h-3 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${width}%`, background: `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 65%, white))` }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 md:justify-end">
                <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-navy">
                  <Flag size={12} className="mr-1 inline" strokeWidth={1.75} />
                  {dept.totalEventsAttended} events
                </span>
                <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-navy">
                  {dept.weekStreak}w streak
                </span>
              </div>
            </div>
          );
        })}
        {departments.length === 0 && (
          <p className="text-sm text-stone">Department rankings will appear once teams start booking sessions.</p>
        )}
      </div>
    </section>
  );
}
