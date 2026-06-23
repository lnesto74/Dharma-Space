const MEDAL_IMAGES: Record<number, string> = {
  1: "/cwp/medals/medal-gold.png",
  2: "/cwp/medals/medal-silver.png",
  3: "/cwp/medals/medal-bronze.png"
};

type Props = {
  rank: number;
  size?: "sm" | "md";
  className?: string;
};

const sizeClass = {
  sm: "h-8 w-8",
  md: "h-10 w-10"
};

export function MedalRank({ rank, size = "md", className = "" }: Props) {
  const src = MEDAL_IMAGES[rank];
  if (src) {
    return (
      <img
        src={src}
        alt={`${rank === 1 ? "Gold" : rank === 2 ? "Silver" : "Bronze"} medal`}
        className={`object-contain ${sizeClass[size]} ${className}`}
        loading="lazy"
      />
    );
  }
  return <span className={`text-sm font-semibold tabular-nums text-navy ${className}`}>{rank}</span>;
}

export function medalImageForRank(rank: number) {
  return MEDAL_IMAGES[rank] ?? null;
}
