import { CwpCard } from "../CwpCard";
import { UserAvatar } from "../UserAvatar";
import { MedalRank } from "./MedalRank";
import { TrophyIcon } from "./wellness-icons";
import type { LeaderboardEntry } from "../../../types/wellness";

type Props = {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  onRowClick?: (entry: LeaderboardEntry) => void;
  limit?: number;
};

export function LeaderboardTable({ entries, currentUserId, onRowClick, limit }: Props) {
  const visible = limit ? entries.slice(0, limit) : entries;
  return (
    <CwpCard className="overflow-hidden p-0">
      <div className="border-b border-sand px-6 py-4">
        <div className="flex items-center gap-2">
          <TrophyIcon className="text-navy" />
          <h2 className="text-2xl font-light text-navy">Winners board</h2>
        </div>
      </div>
      <ul className="divide-y divide-sand">
        {visible.map((entry) => {
          const top = entry.rank <= 3;
          const rowClass = [
            "flex items-center gap-4 px-6 py-3 text-sm",
            entry.id === currentUserId ? "cwp-leaderboard-row-current" : "",
            entry.rank === 1 ? "cwp-leaderboard-rank-1" : "",
            entry.rank === 2 ? "cwp-leaderboard-rank-2" : "",
            entry.rank === 3 ? "cwp-leaderboard-rank-3" : "",
            onRowClick ? "cursor-pointer hover:bg-ivory" : ""
          ].filter(Boolean).join(" ");
          return (
            <li key={entry.id}>
              <button type="button" className={`${rowClass} w-full text-left`} onClick={() => onRowClick?.(entry)}>
                <span className="grid w-10 shrink-0 place-items-center">
                  {top ? <MedalRank rank={entry.rank} size="sm" /> : entry.rank}
                </span>
                <UserAvatar name={entry.fullName} avatar={entry.avatarUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-navy">{entry.fullName}</span>
                  <span className="block truncate text-xs text-stone">{entry.department}</span>
                </span>
                <span className="font-semibold tabular-nums text-navy">{entry.totalWellnessScore.toLocaleString()} pts</span>
              </button>
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="px-6 py-8 text-center text-sm text-stone">No scores yet — book your first session.</li>
        )}
      </ul>
    </CwpCard>
  );
}
