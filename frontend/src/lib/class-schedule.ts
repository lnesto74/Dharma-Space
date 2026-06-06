export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export const DEFAULT_DURATION_MINUTES = 60;
export const CALENDAR_START_MINUTES = 6 * 60;
export const CALENDAR_END_MINUTES = 22 * 60;
export const SLOT_MINUTES = 30;

export function indexToDay(index: number) {
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

export function formatClassDateLabel(classDate: string): string {
  const parsed = new Date(`${classDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return classDate;
  return parsed.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function formatMinutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, minutes));
  const hours24 = Math.floor(clamped / 60);
  const mins = clamped % 60;
  const meridiem = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(mins).padStart(2, "0")} ${meridiem}`;
}

export function isDateInWeek(classDate: string, weekStart: Date): boolean {
  const start = isoDateLocal(weekStart);
  const end = isoDateLocal(addDays(weekStart, 6));
  return classDate >= start && classDate <= end;
}
