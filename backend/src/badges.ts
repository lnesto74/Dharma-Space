import type { PrismaClient } from "@prisma/client";
import { getWellnessLevel } from "./wellness-level.js";

export type UserWellnessStats = {
  byCategory: Record<string, number>;
  totalSteps: number;
  bookingsInSameWeek: number;
  morningSessionCount: number;
  advanceBookingCount: number;
  attendancePct: number;
};

export async function getUserWellnessStats(userId: string, prisma: PrismaClient): Promise<UserWellnessStats> {
  const [attendances, bookings, user] = await Promise.all([
    prisma.wellnessAttendance.findMany({
      where: { userId },
      include: { event: { include: { category: true } } }
    }),
    prisma.wellnessBooking.findMany({
      where: { userId, cancelled: false },
      include: { event: true }
    }),
    prisma.user.findUnique({ where: { id: userId } })
  ]);

  const byCategory: Record<string, number> = {};
  for (const row of attendances) {
    const name = row.event.category.name;
    byCategory[name] = (byCategory[name] || 0) + 1;
  }

  const weekCounts = new Map<string, number>();
  for (const booking of bookings) {
    const d = booking.event.dateTime;
    const weekKey = `${d.getUTCFullYear()}-W${Math.ceil((d.getUTCDate() + 6 - d.getUTCDay()) / 7)}`;
    weekCounts.set(weekKey, (weekCounts.get(weekKey) || 0) + 1);
  }
  const bookingsInSameWeek = Math.max(0, ...weekCounts.values(), 0);

  let morningSessionCount = 0;
  let advanceBookingCount = 0;
  for (const booking of bookings) {
    if (booking.event.dateTime.getHours() < 9) morningSessionCount += 1;
    const daysAhead = (booking.event.dateTime.getTime() - booking.bookedAt.getTime()) / 86400000;
    if (daysAhead >= 7) advanceBookingCount += 1;
  }

  const attendedEventIds = new Set(attendances.map((a) => a.eventId));
  const pastBookings = bookings.filter((b) => b.event.dateTime < new Date());
  const attendancePct =
    pastBookings.length === 0
      ? 0
      : Math.round((pastBookings.filter((b) => attendedEventIds.has(b.eventId)).length / pastBookings.length) * 100);

  return {
    byCategory,
    totalSteps: user?.totalSteps || 0,
    bookingsInSameWeek,
    morningSessionCount,
    advanceBookingCount,
    attendancePct
  };
}

export async function checkAndUnlockBadges(userId: string, prisma: PrismaClient) {
  const stats = await getUserWellnessStats(userId, prisma);
  const level = getWellnessLevel(stats.attendancePct);

  const rules: Array<{ name: string; condition: () => boolean }> = [
    { name: "Breathwork Survivor", condition: () => (stats.byCategory["Breathwork"] || 0) >= 1 },
    { name: "Chair Yoga Warrior", condition: () => (stats.byCategory["Yoga Class"] || 0) >= 3 },
    { name: "Hydration Deity", condition: () => stats.totalSteps >= 5 },
    { name: "Silent Savasana Champion", condition: () => (stats.byCategory["Meditation Class"] || 0) >= 5 },
    {
      name: "Spreadsheet Monk",
      condition: () =>
        (stats.byCategory["Leadership Talk"] || 0) >= 1 &&
        (stats.byCategory["Wellness Talk & Workshop"] || 0) >= 1
    },
    { name: "Slack Notification Yogi", condition: () => stats.bookingsInSameWeek >= 3 },
    { name: "Caffeine Recovery Specialist", condition: () => stats.morningSessionCount >= 1 },
    { name: "CEO of Deep Breathing", condition: () => stats.attendancePct >= 76 },
    { name: "Sound Healer Initiate", condition: () => (stats.byCategory["Sound Healing Session"] || 0) >= 1 },
    { name: "Team Player", condition: () => (stats.byCategory["Team Building Activity"] || 0) >= 2 },
    { name: "Early Bird", condition: () => stats.advanceBookingCount >= 1 },
    { name: "Corporate Dragon Tamer", condition: () => level.level >= 6 }
  ];

  for (const rule of rules) {
    if (!rule.condition()) continue;
    const badge = await prisma.badge.findFirst({ where: { name: rule.name, category: "CWP" } });
    if (!badge) continue;
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
      create: { userId, badgeId: badge.id },
      update: {}
    });
  }
}
