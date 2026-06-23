import { WellnessLevelCard } from "./WellnessLevelCard";
import { BadgeGrid, CWP_BADGE_DEFINITIONS } from "./BadgeGrid";
import { DepartmentLeaderboard } from "./DepartmentLeaderboard";
import type { DepartmentLeaderboardEntry, WellnessStats } from "../../../types/wellness";

type Props = {
  stats: WellnessStats | null;
  departments: DepartmentLeaderboardEntry[];
};

export function WellnessJourney({ stats, departments }: Props) {
  if (!stats) return null;
  const unlocked = new Set(stats.badges.map((b) => b.name));
  return (
    <div className="space-y-6">
      <WellnessLevelCard
        emoji={stats.wellnessLevel.emoji}
        title={stats.wellnessLevel.title}
        description={stats.wellnessLevel.description}
        percentage={stats.wellnessLevel.percentage}
        nextLevelAt={stats.wellnessLevel.nextLevelAt}
      />
      <BadgeGrid allBadges={CWP_BADGE_DEFINITIONS} unlockedNames={unlocked} />
      <DepartmentLeaderboard departments={departments} />
    </div>
  );
}
