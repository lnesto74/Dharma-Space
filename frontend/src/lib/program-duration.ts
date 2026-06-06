export const EVENT_WORKSHOP_DURATIONS = [
  "30 minutes",
  "45 minutes",
  "1 hour",
  "1.5 hours",
  "2 hours",
  "2.5 hours",
  "3 hours",
  "4 hours (half day)",
  "6 hours",
  "8 hours (full day)"
] as const;

export const TRAINING_DURATIONS = [
  "4 weeks",
  "6 weeks",
  "8 weeks",
  "10 weeks",
  "12 weeks",
  "16 weeks",
  "Mon & Wed · 2 hours/week",
  "Tue & Thu · 3 hours/week",
  "Fri · 2 hours · Sat & Sun · 4 hours",
  "Sat & Sun · 6 hours/week",
  "Weekends only · 8 hours/week",
  "Mon, Wed & Fri · 6 hours/week",
  "30 hours (4 weeks)",
  "50 hours (6 weeks)",
  "100 hours (8 weeks)",
  "200 hours (12 weeks)",
  "300 hours (16 weeks)"
] as const;

const DURATION_BY_CATEGORY: Record<string, readonly string[]> = {
  EVENT: EVENT_WORKSHOP_DURATIONS,
  WORKSHOP: EVENT_WORKSHOP_DURATIONS,
  FLAGSHIP: TRAINING_DURATIONS,
  CERTIFICATION: TRAINING_DURATIONS
};

export function durationPresetsForCategory(category: string): string[] {
  return [...(DURATION_BY_CATEGORY[category] ?? EVENT_WORKSHOP_DURATIONS)];
}

export function defaultDurationForCategory(category: string): string {
  if (category === "FLAGSHIP" || category === "CERTIFICATION") return "8 weeks";
  return "1 hour";
}

export function durationFieldHint(category: string): string | undefined {
  if (category === "FLAGSHIP" || category === "CERTIFICATION") {
    return "Use total length (weeks) and weekly hours. Add day-by-day times in Schedule.";
  }
  if (category === "EVENT" || category === "WORKSHOP") {
    return "How long the session runs (e.g. 1 hour, 2 hours).";
  }
  return undefined;
}

export function isTrainingCategory(category: string): boolean {
  return category === "FLAGSHIP" || category === "CERTIFICATION";
}
