export const WELLNESS_LEVEL_IMAGES: Record<string, string> = {
  "Zen Sloth": "/cwp/badges/zen-sloth.png",
  "Calm Panda": "/cwp/badges/calm-panda.png",
  "Balanced Otter": "/cwp/badges/balanced-otter.png",
  "Mindful Wolf": "/cwp/badges/mindful-wolf.png",
  "Elevated Eagle": "/cwp/badges/elevated-eagle.png",
  "Corporate Dragon": "/cwp/badges/corporate-dragon.png"
};

/** Achievement badges reuse the six wellness mascot artworks. */
export const ACHIEVEMENT_BADGE_IMAGES: Record<string, string> = {
  "Breathwork Survivor": WELLNESS_LEVEL_IMAGES["Zen Sloth"],
  "Chair Yoga Warrior": WELLNESS_LEVEL_IMAGES["Calm Panda"],
  "Hydration Deity": WELLNESS_LEVEL_IMAGES["Calm Panda"],
  "Silent Savasana Champion": WELLNESS_LEVEL_IMAGES["Zen Sloth"],
  "Spreadsheet Monk": WELLNESS_LEVEL_IMAGES["Elevated Eagle"],
  "Slack Notification Yogi": WELLNESS_LEVEL_IMAGES["Balanced Otter"],
  "Caffeine Recovery Specialist": WELLNESS_LEVEL_IMAGES["Corporate Dragon"],
  "CEO of Deep Breathing": WELLNESS_LEVEL_IMAGES["Mindful Wolf"],
  "Sound Healer Initiate": WELLNESS_LEVEL_IMAGES["Balanced Otter"],
  "Team Player": WELLNESS_LEVEL_IMAGES["Calm Panda"],
  "Early Bird": WELLNESS_LEVEL_IMAGES["Elevated Eagle"],
  "Corporate Dragon Tamer": WELLNESS_LEVEL_IMAGES["Corporate Dragon"]
};

export function wellnessLevelImage(title: string) {
  return WELLNESS_LEVEL_IMAGES[title] ?? null;
}

export function achievementBadgeImage(name: string) {
  return ACHIEVEMENT_BADGE_IMAGES[name] ?? null;
}
