import { Lock } from "lucide-react";
import { CwpCard } from "../CwpCard";
import { CwpSectionTitle } from "../CwpSectionTitle";
import { WellnessBadgeImage } from "./WellnessBadgeImage";
import { achievementBadgeImage } from "./wellness-badge-images";

type BadgeItem = { name: string; emoji: string; description: string };

type Props = {
  allBadges: BadgeItem[];
  unlockedNames: Set<string>;
};

export function BadgeGrid({ allBadges, unlockedNames }: Props) {
  return (
    <CwpCard>
      <CwpSectionTitle title="Badges" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {allBadges.map((badge) => {
          const unlocked = unlockedNames.has(badge.name);
          const imageSrc = achievementBadgeImage(badge.name);
          return (
            <div
              key={badge.name}
              className={`rounded-4xl border border-sand bg-white/70 p-3 text-center ${unlocked ? "" : "cwp-badge-locked"}`}
              title={badge.description}
            >
              <div className="mx-auto">
                {unlocked && imageSrc ? (
                  <WellnessBadgeImage src={imageSrc} alt={badge.name} size="sm" />
                ) : (
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sage/20">
                    <Lock size={20} strokeWidth={1.75} className="text-stone" />
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs font-semibold leading-tight text-navy">{badge.name}</p>
            </div>
          );
        })}
      </div>
    </CwpCard>
  );
}

export const CWP_BADGE_DEFINITIONS: BadgeItem[] = [
  { name: "Breathwork Survivor", emoji: "🌬️", description: "First breathwork session" },
  { name: "Chair Yoga Warrior", emoji: "🧘", description: "Three yoga classes" },
  { name: "Hydration Deity", emoji: "💧", description: "Five step log days" },
  { name: "Silent Savasana Champion", emoji: "🕯️", description: "Five meditation classes" },
  { name: "Spreadsheet Monk", emoji: "📊", description: "Leadership + wellness workshop" },
  { name: "Slack Notification Yogi", emoji: "📱", description: "Three bookings in one week" },
  { name: "Caffeine Recovery Specialist", emoji: "☕", description: "Morning session before 9am" },
  { name: "CEO of Deep Breathing", emoji: "🫁", description: "76%+ attendance" },
  { name: "Sound Healer Initiate", emoji: "🎵", description: "First sound healing" },
  { name: "Team Player", emoji: "🤝", description: "Two team building activities" },
  { name: "Early Bird", emoji: "🐦", description: "Booked 7+ days ahead" },
  { name: "Corporate Dragon Tamer", emoji: "🐉", description: "Corporate Dragon level" }
];
