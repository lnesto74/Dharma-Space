/**
 * Week 1 of the published timetable: 1–7 October 2026.
 *
 * Transcribed from the studio's printed schedule. The week runs Thursday 1 Oct
 * to Wednesday 7 Oct but is laid out Monday-first, exactly as the poster does,
 * so the columns are not in chronological order.
 *
 * This loads once into an empty week and then leaves the data alone — the studio
 * publishes later weeks from the admin schedule editor.
 */

import type { PrismaClient } from "@prisma/client";
import {
  dayIndexFromClassDate,
  indexToDay,
  parseTimeToMinutes,
  formatMinutesToTime
} from "../class-schedule.js";
import { defaultCapacityFor } from "./capacity.js";
import { defaultDropInPrice } from "./pricing.js";

export const WEEK_ONE_START = "2026-10-01";
export const WEEK_ONE_END = "2026-10-07";

type Entry = {
  date: string;
  start: string;
  end: string;
  title: string;
  teacher: string;
  room: "Room 1" | "Room 2";
  category: "YOGA" | "AERIAL" | "SOUND" | "DANCE" | "MEDITATION";
  entryType?: "CLASS" | "TRAINING" | "WORKSHOP_WINDOW";
};

// Dates: Thu 1, Fri 2, Sat 3, Sun 4, Mon 5, Tue 6, Wed 7 October 2026.
const ENTRIES: Entry[] = [
  // ── Monday 5 Oct ──
  { date: "2026-10-05", start: "7:30 AM", end: "8:30 AM", title: "Power Vinyasa", teacher: "Vera", room: "Room 1", category: "YOGA" },
  { date: "2026-10-05", start: "9:30 AM", end: "10:30 AM", title: "Hatha Flow", teacher: "Claudia", room: "Room 1", category: "YOGA" },
  { date: "2026-10-05", start: "6:15 PM", end: "7:15 PM", title: "Hip Opening Yoga", teacher: "Vera", room: "Room 1", category: "YOGA" },
  { date: "2026-10-05", start: "6:45 PM", end: "7:45 PM", title: "Hatha Yoga", teacher: "Gabriella", room: "Room 2", category: "YOGA" },
  { date: "2026-10-05", start: "8:00 PM", end: "9:00 PM", title: "Sound Healing", teacher: "Anastasia & Gosha", room: "Room 2", category: "SOUND" },

  // ── Tuesday 6 Oct ──
  { date: "2026-10-06", start: "7:00 AM", end: "8:00 AM", title: "Community Meditation", teacher: "Kasi", room: "Room 2", category: "MEDITATION" },
  { date: "2026-10-06", start: "8:00 AM", end: "9:00 AM", title: "Hatha Flow", teacher: "Divya", room: "Room 2", category: "YOGA" },
  { date: "2026-10-06", start: "8:15 AM", end: "9:15 AM", title: "Aerial Yoga Level 1", teacher: "Vera", room: "Room 1", category: "AERIAL" },
  { date: "2026-10-06", start: "6:15 PM", end: "7:15 PM", title: "Hatha Vinyasa Flow", teacher: "Ethan", room: "Room 1", category: "YOGA" },
  { date: "2026-10-06", start: "6:15 PM", end: "7:15 PM", title: "Restorative Yin", teacher: "Claudia", room: "Room 2", category: "YOGA" },
  { date: "2026-10-06", start: "7:30 PM", end: "8:30 PM", title: "Back & Spine Mobility", teacher: "Ethan", room: "Room 1", category: "YOGA" },

  // ── Wednesday 7 Oct ──
  { date: "2026-10-07", start: "7:30 AM", end: "8:30 AM", title: "Ashtanga Vinyasa", teacher: "Vera", room: "Room 1", category: "YOGA" },
  { date: "2026-10-07", start: "8:45 AM", end: "9:45 AM", title: "Smart Feet Yoga", teacher: "Vera", room: "Room 1", category: "YOGA" },
  { date: "2026-10-07", start: "6:15 PM", end: "7:15 PM", title: "Vinyasa", teacher: "Claudia", room: "Room 1", category: "YOGA" },
  { date: "2026-10-07", start: "7:30 PM", end: "8:30 PM", title: "Hatha", teacher: "Claudia", room: "Room 1", category: "YOGA" },
  { date: "2026-10-07", start: "7:30 PM", end: "8:45 PM", title: "Yin & Sound Journey", teacher: "Vera", room: "Room 2", category: "SOUND" },

  // ── Thursday 1 Oct ──
  { date: "2026-10-01", start: "7:00 AM", end: "8:00 AM", title: "Community Meditation", teacher: "Kasi", room: "Room 2", category: "MEDITATION" },
  { date: "2026-10-01", start: "8:00 AM", end: "9:00 AM", title: "Vinyasa Flow", teacher: "Divya", room: "Room 2", category: "YOGA" },
  { date: "2026-10-01", start: "8:15 AM", end: "9:15 AM", title: "Arm Balancing", teacher: "Vera", room: "Room 1", category: "YOGA" },
  { date: "2026-10-01", start: "9:30 AM", end: "10:30 AM", title: "Aerial Yoga Level 2", teacher: "Vera", room: "Room 1", category: "AERIAL" },
  { date: "2026-10-01", start: "6:15 PM", end: "7:15 PM", title: "Hatha Flow", teacher: "Claudia", room: "Room 1", category: "YOGA" },
  { date: "2026-10-01", start: "7:30 PM", end: "8:30 PM", title: "Aerial Yoga Level 1", teacher: "Vera", room: "Room 1", category: "AERIAL" },

  // ── Friday 2 Oct ──
  { date: "2026-10-02", start: "8:00 AM", end: "9:00 AM", title: "Morning Hatha", teacher: "Claudia", room: "Room 1", category: "YOGA" },
  { date: "2026-10-02", start: "12:15 PM", end: "1:15 PM", title: "Lunchtime Flow", teacher: "Claudia", room: "Room 1", category: "YOGA" },
  { date: "2026-10-02", start: "6:30 PM", end: "7:30 PM", title: "Embodiment Dance", teacher: "Vera", room: "Room 2", category: "DANCE" },
  { date: "2026-10-02", start: "6:00 PM", end: "9:00 PM", title: "200-hr Teacher Training", teacher: "", room: "Room 1", category: "YOGA", entryType: "TRAINING" },

  // ── Saturday 3 Oct ──
  { date: "2026-10-03", start: "9:00 AM", end: "10:00 AM", title: "Aerial Yoga Level 1", teacher: "Vera", room: "Room 1", category: "AERIAL" },
  { date: "2026-10-03", start: "9:15 AM", end: "10:15 AM", title: "Stretch & Myofascial Release", teacher: "Ethan", room: "Room 2", category: "YOGA" },
  { date: "2026-10-03", start: "10:30 AM", end: "11:30 AM", title: "Vinyasa Flow", teacher: "Divya", room: "Room 1", category: "YOGA" },
  { date: "2026-10-03", start: "1:00 PM", end: "2:30 PM", title: "Workshop window", teacher: "", room: "Room 2", category: "YOGA", entryType: "WORKSHOP_WINDOW" },
  { date: "2026-10-03", start: "3:00 PM", end: "9:30 PM", title: "200-hr Teacher Training", teacher: "", room: "Room 1", category: "YOGA", entryType: "TRAINING" },

  // ── Sunday 4 Oct ──
  { date: "2026-10-04", start: "9:00 AM", end: "10:00 AM", title: "Vinyasa Flow", teacher: "Claudia", room: "Room 1", category: "YOGA" },
  { date: "2026-10-04", start: "10:15 AM", end: "11:15 AM", title: "Aerial Yoga Level 1", teacher: "Vera", room: "Room 1", category: "AERIAL" },
  { date: "2026-10-04", start: "10:15 AM", end: "11:15 AM", title: "Hatha Flow", teacher: "Claudia", room: "Room 2", category: "YOGA" },
  { date: "2026-10-04", start: "11:45 AM", end: "1:15 PM", title: "Workshop window", teacher: "", room: "Room 2", category: "YOGA", entryType: "WORKSHOP_WINDOW" },
  { date: "2026-10-04", start: "3:00 PM", end: "9:30 PM", title: "200-hr Teacher Training", teacher: "", room: "Room 1", category: "YOGA", entryType: "TRAINING" }
];


/**
 * Inserts Week 1 if that week has no classes yet. Guarded so it never fights
 * edits made in the admin schedule editor, and never runs twice.
 */
export async function ensureWeekOneSchedule(prisma: PrismaClient) {
  const existing = await prisma.siteClass.count({
    where: { classDate: { gte: WEEK_ONE_START, lte: WEEK_ONE_END } }
  });
  if (existing > 0) return;

  // The original seed shipped placeholder classes in rooms this studio doesn't
  // have. They'd otherwise sit alongside the real timetable, so clear them as
  // the real schedule goes in. Runs once, guarded by the check above.
  const removed = await prisma.siteClass.deleteMany({
    where: { location: { in: ["Studio A", "Studio B", "Aerial Room"] } }
  });
  if (removed.count > 0) {
    console.log(`[startup] Removed ${removed.count} placeholder class(es) before publishing Week 1.`);
  }

  const rows = ENTRIES.map((entry, index) => {
    const startMinutes = parseTimeToMinutes(entry.start) ?? 7 * 60;
    const endMinutes = parseTimeToMinutes(entry.end) ?? startMinutes + 60;
    const isClass = (entry.entryType ?? "CLASS") === "CLASS";
    const dayIndex = dayIndexFromClassDate(entry.date);
    return {
      classDate: entry.date,
      dayIndex,
      day: indexToDay(dayIndex),
      time: formatMinutesToTime(startMinutes),
      startMinutes,
      durationMinutes: Math.max(30, endMinutes - startMinutes),
      classType: entry.title,
      category: entry.category,
      entryType: entry.entryType ?? "CLASS",
      capacity: defaultCapacityFor({
        category: entry.category,
        location: entry.room,
        entryType: entry.entryType ?? "CLASS"
      }),
      instructor: entry.teacher,
      level: "All Levels",
      location: entry.room,
      price: isClass ? defaultDropInPrice(entry.category) : "",
      published: true,
      comingSoon: false,
      sortOrder: index
    };
  });

  await prisma.siteClass.createMany({ data: rows });

  console.log(`[startup] Published Week 1 schedule — ${rows.length} entries.`);
}
