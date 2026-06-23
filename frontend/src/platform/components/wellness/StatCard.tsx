import type { LucideIcon } from "lucide-react";

type Props = {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  trend?: string;
  tone?: number;
};

export function StatCard({ icon: Icon, label, value, trend, tone = 0 }: Props) {
  return (
    <div className={`cwp-stat-metric cwp-stat-metric--${tone % 12}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--cwp-stat-deep)]">{label}</p>
          <p className="mt-2 text-3xl font-light text-[var(--cwp-stat-deep)]">{value}</p>
          {trend && <p className="mt-2 text-sm text-[var(--cwp-stat-deep)]/75">{trend}</p>}
        </div>
        {Icon && (
          <div className="cwp-stat-icon grid h-11 w-11 shrink-0 place-items-center rounded-full">
            <Icon size={20} strokeWidth={1.75} />
          </div>
        )}
      </div>
    </div>
  );
}
