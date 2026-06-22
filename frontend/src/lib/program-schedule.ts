import { formatMinutesToTime } from "./class-schedule";

export function isSessionProgram(category: string): boolean {
  const normalized = category.toUpperCase();
  return normalized === "WORKSHOP" || normalized === "EVENT";
}

export function isTrainingProgram(category: string): boolean {
  const normalized = category.toUpperCase();
  return normalized === "FLAGSHIP" || normalized === "CERTIFICATION" || normalized === "YTT" || normalized === "COURSE";
}

export function formatProgramDateLabel(scheduledDate: string): string {
  const parsed = new Date(`${scheduledDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return scheduledDate;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export type ProgramScheduleStatus = "COMING_SOON" | "SCHEDULED" | "FINISHED";

export type ProgramScheduleFields = {
  category?: string;
  comingSoon?: boolean;
  scheduledDate?: string;
  startMinutes?: number;
  dates?: string;
  duration?: string;
  finished?: boolean;
  status?: ProgramScheduleStatus;
};

function parseDurationToMinutes(duration: string): number | null {
  const normalized = duration.toLowerCase().trim();
  const hourMatch = normalized.match(/(\d+(?:\.\d+)?)\s*hours?/);
  if (hourMatch) return Math.round(parseFloat(hourMatch[1]) * 60);
  const minuteMatch = normalized.match(/(\d+)\s*minutes?/);
  if (minuteMatch) return Number.parseInt(minuteMatch[1], 10);
  return null;
}

function parseDurationToDays(duration: string): number | null {
  const normalized = duration.toLowerCase().trim();
  const weekMatch = normalized.match(/(\d+)\s*weeks?/);
  if (weekMatch) return Number.parseInt(weekMatch[1], 10) * 7;
  return null;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function parseDatesFieldEnd(dates: string): Date | null {
  const trimmed = dates.trim();
  if (!trimmed || trimmed === "Coming Soon") return null;

  const rangeParts = trimmed.split(/\s*[–—-]\s*/).map((part) => part.trim()).filter(Boolean);
  if (rangeParts.length >= 2) {
    const endPart = rangeParts[rangeParts.length - 1];
    const yearMatch = trimmed.match(/\b(20\d{2})\b/);
    const toParse = yearMatch && !/\d{4}/.test(endPart) ? `${endPart}, ${yearMatch[1]}` : endPart;
    const parsed = new Date(toParse);
    if (!Number.isNaN(parsed.getTime())) return endOfDay(parsed);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T23:59:59`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return endOfDay(parsed);
  return null;
}

export function programEndDateTime(program: ProgramScheduleFields): Date | null {
  if (program.comingSoon) return null;

  const category = (program.category || "CERTIFICATION").toUpperCase();
  const datesEnd = program.dates ? parseDatesFieldEnd(program.dates) : null;

  if (isSessionProgram(category)) {
    if (program.scheduledDate?.trim()) {
      const start = new Date(`${program.scheduledDate.trim()}T00:00:00`);
      if (Number.isNaN(start.getTime())) return datesEnd;
      start.setMinutes(start.getMinutes() + (program.startMinutes || 0));
      const durationMinutes = parseDurationToMinutes(program.duration || "") ?? 60;
      return new Date(start.getTime() + durationMinutes * 60 * 1000);
    }
    return datesEnd;
  }

  if (isTrainingProgram(category)) {
    if (datesEnd) return datesEnd;
    if (program.scheduledDate?.trim()) {
      const start = new Date(`${program.scheduledDate.trim()}T23:59:59`);
      if (Number.isNaN(start.getTime())) return null;
      const durationDays = parseDurationToDays(program.duration || "") ?? 56;
      start.setDate(start.getDate() + durationDays);
      return start;
    }
  }

  return datesEnd;
}

export function isProgramFinished(program: ProgramScheduleFields, now = new Date()): boolean {
  if (program.finished != null) return program.finished;
  if (program.status === "FINISHED") return true;
  if (program.comingSoon || program.status === "COMING_SOON") return false;
  const end = programEndDateTime(program);
  if (!end) return false;
  return now.getTime() > end.getTime();
}

export function programScheduleStatus(program: ProgramScheduleFields): ProgramScheduleStatus {
  if (program.status) return program.status;
  if (program.comingSoon) return "COMING_SOON";
  if (isProgramFinished(program)) return "FINISHED";
  return "SCHEDULED";
}

export function programDisplayDate(program: {
  comingSoon?: boolean;
  dates?: string;
  scheduledDate?: string;
}): string {
  if (program.comingSoon) return "Coming Soon";
  if (program.dates && program.dates !== "Coming Soon") return program.dates;
  if (program.scheduledDate) return formatProgramDateLabel(program.scheduledDate);
  return "Coming Soon";
}

export function programDisplayTime(program: {
  comingSoon?: boolean;
  time?: string;
  startMinutes?: number;
}): string {
  if (program.comingSoon) return "";
  if (program.time?.trim()) return program.time;
  if (program.startMinutes) return formatMinutesToTime(program.startMinutes);
  return "";
}

export function minutesToInputTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function inputTimeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function defaultComingSoonForCategory(category: string): boolean {
  return isSessionProgram(category) || isTrainingProgram(category);
}

export function sortProgramsForDisplay<T extends ProgramScheduleFields & { sortOrder?: number }>(programs: T[]): T[] {
  return [...programs].sort((a, b) => {
    const aFinished = Boolean(a.finished);
    const bFinished = Boolean(b.finished);
    if (aFinished !== bFinished) return aFinished ? 1 : -1;

    const aScheduled = !a.comingSoon && Boolean(a.scheduledDate?.trim());
    const bScheduled = !b.comingSoon && Boolean(b.scheduledDate?.trim());
    if (aScheduled !== bScheduled) return aScheduled ? -1 : 1;

    if (aScheduled && bScheduled) {
      const byDate = (a.scheduledDate || "").localeCompare(b.scheduledDate || "");
      if (byDate !== 0) return byDate;
    }

    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
}

export function sortClassesForDisplay<T extends { comingSoon?: boolean; classDate?: string; dayIndex?: number; startMinutes?: number; sortOrder?: number; time?: string }>(
  classes: T[]
): T[] {
  return [...classes].sort((a, b) => {
    if (Boolean(a.comingSoon) !== Boolean(b.comingSoon)) return a.comingSoon ? 1 : -1;
    const aDate = a.classDate || "";
    const bDate = b.classDate || "";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    const aDay = a.dayIndex ?? 0;
    const bDay = b.dayIndex ?? 0;
    if (aDay !== bDay) return aDay - bDay;
    const aStart = a.startMinutes ?? 0;
    const bStart = b.startMinutes ?? 0;
    if (aStart !== bStart) return aStart - bStart;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
}
