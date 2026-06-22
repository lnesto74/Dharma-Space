import type { PrismaClient } from "@prisma/client";
import { formatMinutesToTime } from "./class-schedule.js";
import { normalizeProgramCategory } from "./education.js";

export function isSessionProgram(category: string): boolean {
  const normalized = normalizeProgramCategory(category);
  return normalized === "WORKSHOP" || normalized === "EVENT";
}

export function isTrainingProgram(category: string): boolean {
  const normalized = normalizeProgramCategory(category);
  return normalized === "FLAGSHIP" || normalized === "CERTIFICATION";
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

  const category = normalizeProgramCategory(program.category || "CERTIFICATION");
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
  if (program.comingSoon) return false;
  const end = programEndDateTime(program);
  if (!end) return false;
  return now.getTime() > end.getTime();
}

export function programScheduleStatus(program: ProgramScheduleFields): ProgramScheduleStatus {
  if (program.comingSoon) return "COMING_SOON";
  if (isProgramFinished(program)) return "FINISHED";
  return "SCHEDULED";
}

export type ProgramScheduleInput = ProgramScheduleFields & {
  time?: string;
};

export function normalizeProgramSchedule(input: ProgramScheduleInput): ProgramScheduleInput {
  const next: ProgramScheduleInput = { ...input };
  const category = normalizeProgramCategory(next.category || "CERTIFICATION");

  if (next.comingSoon) {
    next.dates = "Coming Soon";
    next.scheduledDate = "";
    if (isSessionProgram(category)) {
      next.startMinutes = 0;
    }
    return next;
  }

  if (isSessionProgram(category)) {
    if (!next.scheduledDate?.trim()) {
      throw new Error("Date is required when not marked as Coming soon");
    }
    next.scheduledDate = next.scheduledDate.trim();
    next.dates = formatProgramDateLabel(next.scheduledDate);
    if (next.startMinutes) {
      next.time = formatMinutesToTime(next.startMinutes);
    }
    return next;
  }

  if (isTrainingProgram(category)) {
    const dates = next.dates?.trim();
    if (next.scheduledDate?.trim() && (!dates || dates === "Coming Soon")) {
      next.dates = formatProgramDateLabel(next.scheduledDate.trim());
    } else if (dates) {
      next.dates = dates;
    } else {
      throw new Error("Intake dates are required when not marked as Coming soon");
    }
  }

  return next;
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

export async function migrateProgramScheduleFields(prisma: PrismaClient) {
  const rows = await prisma.siteProgram.findMany();
  for (const row of rows) {
    const comingSoon = row.dates === "Coming Soon" || !row.dates?.trim();
    const needsUpdate = row.comingSoon !== comingSoon;

    if (needsUpdate) {
      await prisma.siteProgram.update({
        where: { id: row.id },
        data: { comingSoon }
      });
    }
  }
}
