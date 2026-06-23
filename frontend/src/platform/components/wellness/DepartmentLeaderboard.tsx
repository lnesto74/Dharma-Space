import { TrendingUp } from "lucide-react";
import { CwpCard } from "../CwpCard";
import { CwpSectionTitle } from "../CwpSectionTitle";
import type { DepartmentLeaderboardEntry } from "../../../types/wellness";

type Props = {
  departments: DepartmentLeaderboardEntry[];
};

export function DepartmentLeaderboard({ departments }: Props) {
  return (
    <CwpCard>
      <CwpSectionTitle title="Department competition" />
      <ul className="space-y-3">
        {departments.map((dept) => (
          <li key={dept.id} className="rounded-4xl border border-sand bg-white/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-navy">
                #{dept.rank} {dept.name}
              </span>
              {dept.mostImproved && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-navy">
                  <TrendingUp size={14} strokeWidth={1.75} />
                  Most improved
                </span>
              )}
            </div>
            <div className="cwp-progress mt-2">
              <div className="cwp-progress-fill" style={{ width: `${dept.avgAttendancePct}%` }} />
            </div>
            <p className="mt-2 text-xs text-stone">
              {dept.avgAttendancePct}% avg attendance · {dept.totalEventsAttended} events · {dept.weekStreak}w streak
            </p>
          </li>
        ))}
      </ul>
    </CwpCard>
  );
}
