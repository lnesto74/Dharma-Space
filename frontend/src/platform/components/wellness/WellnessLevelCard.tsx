import { CwpCard } from "../CwpCard";
import { WellnessBadgeImage } from "./WellnessBadgeImage";
import { wellnessLevelImage } from "./wellness-badge-images";

type Props = {
  emoji: string;
  title: string;
  description: string;
  percentage: number;
  nextLevelAt?: number | null;
};

export function WellnessLevelCard({ title, description, percentage, nextLevelAt }: Props) {
  const imageSrc = wellnessLevelImage(title);

  return (
    <CwpCard className="text-center">
      {imageSrc ? (
        <WellnessBadgeImage src={imageSrc} alt={title} size="lg" className="mb-4" />
      ) : null}
      <h3 className="text-2xl font-light text-navy">{title}</h3>
      <p className="mt-2 text-sm text-stone">{description}</p>
      <div className="cwp-progress mt-5">
        <div className="cwp-progress-fill" style={{ width: `${Math.min(100, percentage)}%` }} />
      </div>
      <p className="mt-2 text-xs text-stone">
        {nextLevelAt != null ? `Next level at ${nextLevelAt}%` : "Maximum level reached"}
      </p>
    </CwpCard>
  );
}
