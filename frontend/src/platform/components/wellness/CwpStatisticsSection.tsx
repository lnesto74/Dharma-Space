import { ReactNode } from "react";
import { BarChart3 } from "lucide-react";

type Props = {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
};

export function CwpStatisticsSection({ title = "My statistics", eyebrow = "Personal snapshot", children }: Props) {
  return (
    <section className="cwp-stats-section">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--cwp-stat-deep)]/70">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-light text-[var(--cwp-stat-deep)]">{title}</h2>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-full bg-[var(--cwp-stat-cream)] text-[var(--cwp-stat-deep)]">
          <BarChart3 size={20} strokeWidth={1.75} />
        </div>
      </div>
      {children}
    </section>
  );
}
