import { WellnessBadgeImage } from "./WellnessBadgeImage";
import { wellnessLevelImage } from "./wellness-badge-images";
import { wellnessLevelMeta } from "./wellness-level-meta";
import type { WellnessStats } from "../../../types/wellness";

type Props = {
  stats: WellnessStats;
};

export function EmployeeJourneyHero({ stats }: Props) {
  const level = stats.wellnessLevel;
  const meta = wellnessLevelMeta(level.title);
  const imageSrc = wellnessLevelImage(level.title);
  const attendance = level.percentage;

  return (
    <div className={`cwp-archetype-card overflow-hidden rounded-[2rem] p-5 md:p-6 ${meta.tone}`}>
      <div className="grid gap-6 lg:grid-cols-[minmax(180px,220px)_1fr] lg:items-start">
        <div className="flex min-h-[160px] items-start justify-start rounded-[1.75rem] bg-white/75 p-4 shadow-inner">
          {imageSrc ? (
            <WellnessBadgeImage src={imageSrc} alt={level.title} size="lg" className="!mx-0 origin-top-left object-left-top md:scale-110" />
          ) : (
            <span className="text-6xl">{level.emoji}</span>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone">Corporate Wellness Journey</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-4xl font-light tracking-tight text-navy md:text-5xl">{level.title}</h2>
            <div className="rounded-full bg-white/80 px-5 py-3 shadow-sm">
              <span className="text-2xl font-semibold text-navy">{attendance}%</span>
              <span className="ml-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone">attendance</span>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-base leading-7 text-stone md:text-lg">{level.description}</p>
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-[0.18em] text-stone">
              <span>0%</span>
              <span>Journey progress</span>
              <span>100%</span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-white/55">
              <div className="h-full rounded-full bg-[var(--cwp-olive)]" style={{ width: `${Math.min(100, attendance)}%` }} />
            </div>
            {level.nextLevelAt != null && (
              <p className="mt-2 text-xs text-stone">Next level at {level.nextLevelAt}% attendance</p>
            )}
          </div>
          {meta.traits.length > 0 && (
            <div className="mt-5 rounded-[1.5rem] bg-white/55 p-5">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-stone">Traits</p>
              <div className="flex flex-wrap gap-2">
                {meta.traits.map((trait) => (
                  <p key={trait} className="rounded-full bg-white/75 px-4 py-2 text-sm font-medium text-navy">
                    {trait}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
