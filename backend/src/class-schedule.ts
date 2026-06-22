import type { PrismaClient, SiteClass } from "@prisma/client";

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const DEFAULT_DURATION_MINUTES = 60;
export const CALENDAR_START_MINUTES = 6 * 60;
export const CALENDAR_END_MINUTES = 22 * 60;
export const SLOT_MINUTES = 30;

export function dayToIndex(day: string): number {
  const idx = WEEKDAYS.findIndex((d) => d.toLowerCase() === day.trim().toLowerCase());
  return idx >= 0 ? idx : 0;
}

export function indexToDay(index: number): Weekday {
  const normalized = ((index % 7) + 7) % 7;
  return WEEKDAYS[normalized];
}

export function isoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfWeekMonday(date: Date): Date {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function classDateFromDayIndex(weekStart: Date, dayIndex: number): string {
  return isoDateLocal(addDays(weekStart, dayIndex));
}

export function dayIndexFromClassDate(classDate: string): number {
  const parsed = new Date(`${classDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return 0;
  const day = parsed.getDay();
  return day === 0 ? 6 : day - 1;
}

export function nextClassDateForDayIndex(dayIndex: number, from = new Date()): string {
  const today = new Date(from);
  today.setHours(0, 0, 0, 0);
  const weekStart = startOfWeekMonday(today);
  for (let week = 0; week < 52; week += 1) {
    const candidate = addDays(weekStart, week * 7 + dayIndex);
    candidate.setHours(0, 0, 0, 0);
    if (candidate >= today) return isoDateLocal(candidate);
  }
  return isoDateLocal(addDays(weekStart, dayIndex));
}

export function parseTimeToMinutes(time: string): number | null {
  const trimmed = time.trim();
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatMinutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, minutes));
  const hours24 = Math.floor(clamped / 60);
  const mins = clamped % 60;
  const meridiem = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(mins).padStart(2, "0")} ${meridiem}`;
}

export function snapMinutes(minutes: number, step = SLOT_MINUTES): number {
  return Math.round(minutes / step) * step;
}

export function serializeClass(row: SiteClass) {
  return {
    id: row.id,
    classDate: row.classDate,
    day: row.day,
    dayIndex: row.dayIndex,
    time: row.time,
    startMinutes: row.startMinutes,
    durationMinutes: row.durationMinutes,
    classType: row.classType,
    instructor: row.instructor,
    level: row.level,
    location: row.location,
    price: row.price,
    stripeLink: row.stripeLink,
    published: row.published,
    comingSoon: row.comingSoon,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export type ClassScheduleInput = {
  classDate?: string;
  day?: string;
  dayIndex?: number;
  time?: string;
  startMinutes?: number;
  durationMinutes?: number;
  classType?: string;
  instructor?: string;
  level?: string;
  location?: string;
  price?: string;
  stripeLink?: string | null;
  published?: boolean;
  comingSoon?: boolean;
  sortOrder?: number;
};

export function normalizeClassSchedule(input: ClassScheduleInput): ClassScheduleInput {
  const next: ClassScheduleInput = { ...input };

  if (next.classDate?.trim()) {
    next.classDate = next.classDate.trim();
    next.dayIndex = dayIndexFromClassDate(next.classDate);
    next.day = indexToDay(next.dayIndex);
  } else if (next.day) {
    next.dayIndex = dayToIndex(next.day);
    next.day = indexToDay(next.dayIndex);
  } else if (next.dayIndex != null) {
    next.day = indexToDay(next.dayIndex);
  }

  if (next.startMinutes != null) {
    next.startMinutes = snapMinutes(next.startMinutes);
    next.time = formatMinutesToTime(next.startMinutes);
  } else if (next.time) {
    const parsed = parseTimeToMinutes(next.time);
    if (parsed != null) {
      next.startMinutes = snapMinutes(parsed);
      next.time = formatMinutesToTime(next.startMinutes);
    }
  }

  if (next.durationMinutes != null) {
    next.durationMinutes = Math.max(SLOT_MINUTES, snapMinutes(next.durationMinutes, SLOT_MINUTES));
  }

  return next;
}

export async function migrateClassScheduleFields(prisma: PrismaClient) {
  const rows = await prisma.siteClass.findMany();
  for (const row of rows) {
    const parsed = parseTimeToMinutes(row.time);
    const startMinutes = parsed != null ? snapMinutes(parsed) : row.startMinutes || 420;
    const dayIndex = dayToIndex(row.day);
    const classDate = row.classDate?.trim() || nextClassDateForDayIndex(dayIndex);
    const needsUpdate =
      row.startMinutes !== startMinutes ||
      row.dayIndex !== dayIndex ||
      row.time !== formatMinutesToTime(startMinutes) ||
      !row.durationMinutes ||
      row.classDate !== classDate;

    if (needsUpdate) {
      await prisma.siteClass.update({
        where: { id: row.id },
        data: {
          classDate,
          dayIndex,
          day: indexToDay(dayIndex),
          startMinutes,
          durationMinutes: row.durationMinutes || DEFAULT_DURATION_MINUTES,
          time: formatMinutesToTime(startMinutes)
        }
      });
    }
  }
}

export function sortClasses<T extends { classDate?: string | null; dayIndex: number; startMinutes: number; sortOrder: number; comingSoon?: boolean }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (Boolean(a.comingSoon) !== Boolean(b.comingSoon)) return a.comingSoon ? 1 : -1;
    return (
      (a.classDate || "").localeCompare(b.classDate || "") ||
      a.dayIndex - b.dayIndex ||
      a.startMinutes - b.startMinutes ||
      a.sortOrder - b.sortOrder
    );
  });
}
