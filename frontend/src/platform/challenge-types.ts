// Shared data + helpers for the "Challenge a Buddy" gamification feature.
// Used by the Buddy Challenge page and the floating Challenge notifications widget.

export const ME_ID = "me";
export const ME_NAME = "You";

export type BuddyColleague = { id: string; name: string; department: string };

export const buddyColleagues: BuddyColleague[] = [
  { id: "u-ava", name: "Ava Morgan", department: "Product" },
  { id: "u-theo", name: "Theo Malik", department: "Sales" },
  { id: "u-priya", name: "Priya Shah", department: "Leadership" },
  { id: "u-noah", name: "Noah Kim", department: "Engineering" },
  { id: "u-lina", name: "Lina Cortez", department: "People" },
  { id: "u-rowan", name: "Rowan Diaz", department: "Finance" },
  { id: "u-iris", name: "Iris Wong", department: "Operations" },
  { id: "u-felix", name: "Felix Grant", department: "Engineering" }
];

export type BuddyChallengeType = {
  id: string;
  label: string;
  icon: string;
  unit: "reps" | "seconds";
  defaultTarget: number;
  points: number;
};

export const buddyChallengeTypes: BuddyChallengeType[] = [
  { id: "squats", label: "Squats", icon: "/cwp/exercises/squat.png", unit: "reps", defaultTarget: 20, points: 50 },
  { id: "pushups", label: "Push-ups", icon: "/cwp/exercises/pushups.png", unit: "reps", defaultTarget: 15, points: 60 },
  { id: "pullups", label: "Pull-ups", icon: "/cwp/exercises/pullups.png", unit: "reps", defaultTarget: 8, points: 80 },
  { id: "plank", label: "Plank", icon: "/cwp/exercises/plank.png", unit: "seconds", defaultTarget: 60, points: 50 },
  { id: "squat-hold", label: "Squat hold", icon: "/cwp/exercises/squat-hold.png", unit: "seconds", defaultTarget: 45, points: 50 },
  { id: "reverse-plank", label: "Reverse plank", icon: "/cwp/exercises/reverse-plank.png", unit: "seconds", defaultTarget: 45, points: 60 },
  { id: "pullup-hold", label: "Pull-up hold", icon: "/cwp/exercises/pullup-hold.png", unit: "seconds", defaultTarget: 20, points: 70 }
];

export const buddyChallengeTypeMap: Record<string, BuddyChallengeType> = Object.fromEntries(
  buddyChallengeTypes.map((t) => [t.id, t])
);

export function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s}s`;
}

/** Human label for a challenge target, e.g. "20 reps" or "1 min 30s". */
export function targetLabel(typeId: string, target: number): string {
  const t = buddyChallengeTypeMap[typeId];
  if (!t) return String(target);
  return t.unit === "seconds" ? formatSeconds(target) : `${target} reps`;
}

/**
 * Points scale with effort: the harder the target (more reps / longer hold),
 * the more it's worth. Each exercise's base points/defaultTarget sets the rate,
 * so the default target always equals the exercise's base points.
 */
export function pointsForTarget(typeId: string, target: number): number {
  const t = buddyChallengeTypeMap[typeId];
  if (!t) return 0;
  const rate = t.points / t.defaultTarget;
  return Math.max(1, Math.round(rate * target));
}
