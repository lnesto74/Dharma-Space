import { CwpSectionTitle } from "../CwpSectionTitle";
import { WellnessIcon } from "./wellness-icons";

type CategoryRow = { categoryName: string; icon: string | null; count: number };

type Props = {
  categories: CategoryRow[];
  embedded?: boolean;
};

export function AttendanceBreakdown({ categories, embedded = false }: Props) {
  const max = Math.max(1, ...categories.map((c) => c.count));

  const content = (
    <div className="grid gap-3 sm:grid-cols-2">
      {categories.map((cat, index) => (
        <div key={cat.categoryName} className="cwp-stat-breakdown-row rounded-2xl bg-[var(--cwp-stat-cream)]/80 p-3">
          <div className="mb-2 flex items-center justify-between text-sm text-[var(--cwp-stat-deep)]">
            <span className="inline-flex items-center gap-2 font-medium">
              <WellnessIcon symbol={cat.icon} name={cat.categoryName} size={16} />
              {cat.categoryName}
            </span>
            <span className="font-semibold tabular-nums">{cat.count}</span>
          </div>
          <div className="cwp-progress cwp-stats-progress">
            <div
              className={`cwp-progress-fill cwp-stats-progress-fill cwp-stats-progress-fill--${index % 12}`}
              style={{ width: `${(cat.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      {categories.length === 0 && (
        <p className="text-sm text-[var(--cwp-stat-deep)]/75">Attend sessions to see your breakdown.</p>
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <div className="cwp-stats-section">
      <CwpSectionTitle title="Attendance by category" />
      {content}
    </div>
  );
}
