export type WellnessLevel = {
  emoji: string;
  title: string;
  description: string;
  level: number;
};

export function getWellnessLevel(attendancePct: number): WellnessLevel {
  if (attendancePct <= 20) {
    return {
      emoji: "🦥",
      title: "Zen Sloth",
      description: "You signed up for inner peace… and immediately needed a nap.",
      level: 1
    };
  }
  if (attendancePct <= 40) {
    return {
      emoji: "🐼",
      title: "Calm Panda",
      description: "Soft, friendly, and trying their best.",
      level: 2
    };
  }
  if (attendancePct <= 60) {
    return {
      emoji: "🦦",
      title: "Balanced Otter",
      description: "Your nervous system is officially loading stability.",
      level: 3
    };
  }
  if (attendancePct <= 75) {
    return {
      emoji: "🐺",
      title: "Mindful Wolf",
      description: "Disciplined, focused, and slightly intimidating in plank holds.",
      level: 4
    };
  }
  if (attendancePct <= 90) {
    return {
      emoji: "🦅",
      title: "Elevated Eagle",
      description: "Peak clarity. Peak posture. Peak calendar discipline.",
      level: 5
    };
  }
  return {
    emoji: "🐉",
    title: "Corporate Dragon",
    description: "Legendary wellness creature. Possibly enlightened.",
    level: 6
  };
}

export function nextLevelThreshold(attendancePct: number): number | null {
  const thresholds = [21, 41, 61, 76, 91, 100];
  for (const t of thresholds) {
    if (attendancePct < t) return t;
  }
  return null;
}
