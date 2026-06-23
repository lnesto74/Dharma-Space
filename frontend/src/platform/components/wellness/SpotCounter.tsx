type Props = {
  spots: number;
  max: number;
};

export function SpotCounter({ spots, max }: Props) {
  const left = Math.max(0, max - spots);
  const pct = max ? Math.min(100, (spots / max) * 100) : 0;
  return (
    <div>
      <p className="mb-1 text-xs text-[var(--cwp-text-muted)]">
        {left} / {max} spots left
      </p>
      <div className="cwp-progress">
        <div className="cwp-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
