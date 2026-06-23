import type { Express, NextFunction, Request, Response } from "express";
import type { PrismaClient, User } from "@prisma/client";
import { z } from "zod";
import { checkAndUnlockBadges, getUserWellnessStats } from "./badges.js";
import { getWellnessLevel, nextLevelThreshold } from "./wellness-level.js";

type AuthedRequest = Request & { user?: User };

const eventInclude = {
  category: true,
  trainer: { select: { id: true, name: true, avatar: true } },
  bookings: { where: { cancelled: false }, include: { user: { select: { id: true, name: true, avatar: true, department: true } } } },
  attendances: { include: { user: { select: { id: true, name: true, avatar: true, department: true } } } }
} as const;

function serializeEvent(event: {
  id: string;
  companyId: string;
  title: string;
  dateTime: Date;
  durationMinutes: number;
  locationType: string;
  locationDetail: string | null;
  maxSpots: number;
  status: string;
  category: { id: string; name: string; scoreValue: number; icon: string | null };
  trainer: { id: string; name: string; avatar: string | null } | null;
  bookings?: Array<{ cancelled: boolean }>;
  attendances?: unknown[];
}) {
  const booked = event.bookings?.length ?? 0;
  return {
    id: event.id,
    companyId: event.companyId,
    title: event.title,
    dateTime: event.dateTime,
    durationMinutes: event.durationMinutes,
    locationType: event.locationType,
    locationDetail: event.locationDetail,
    maxSpots: event.maxSpots,
    spotsLeft: Math.max(0, event.maxSpots - booked),
    bookedCount: booked,
    status: event.status,
    category: event.category,
    trainer: event.trainer,
    bookings: event.bookings?.filter((b: { cancelled: boolean }) => !b.cancelled),
    attendances: event.attendances
  };
}

function companyScope(user: User) {
  if (user.role === "SUPER_ADMIN") return {};
  return { companyId: user.companyId || "__none__" };
}

function assertEventAccess(user: User, companyId: string) {
  if (user.role === "SUPER_ADMIN") return;
  if (user.companyId !== companyId) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
}

export function registerWellnessRoutes(
  app: Express,
  prisma: PrismaClient,
  auth: (req: AuthedRequest, res: Response, next: NextFunction) => void,
  requireRole: (...roles: string[]) => (req: AuthedRequest, res: Response, next: NextFunction) => void,
  companyEmployeeIds: (user: User) => Promise<string[]>
) {
  const wellnessRoles = ["EMPLOYEE", "HR_ADMIN", "CORPORATE_ADMIN", "TRAINER", "SUPER_ADMIN"];
  const manageRoles = ["TRAINER", "HR_ADMIN", "CORPORATE_ADMIN", "SUPER_ADMIN"];
  const adminRoles = ["HR_ADMIN", "CORPORATE_ADMIN", "SUPER_ADMIN"];

  app.get("/api/wellness/categories", auth, async (_req, res, next) => {
    try {
      const categories = await prisma.wellnessEventCategory.findMany({ orderBy: { name: "asc" } });
      res.json({ categories });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/wellness/events", auth, requireRole(...wellnessRoles), async (req: AuthedRequest, res, next) => {
    try {
      const upcoming = req.query.upcoming === "true";
      const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
      const events = await prisma.wellnessEvent.findMany({
        where: {
          ...companyScope(req.user!),
          ...(categoryId ? { categoryId } : {}),
          ...(upcoming ? { dateTime: { gte: new Date() }, status: { in: ["scheduled", "draft"] } } : {})
        },
        include: eventInclude,
        orderBy: { dateTime: "asc" }
      });
      res.json({ events: events.map(serializeEvent) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/wellness/events/:id", auth, requireRole(...wellnessRoles), async (req: AuthedRequest, res, next) => {
    try {
      const event = await prisma.wellnessEvent.findUnique({ where: { id: req.params.id }, include: eventInclude });
      if (!event) return res.status(404).json({ message: "Event not found" });
      assertEventAccess(req.user!, event.companyId);
      res.json({ event: serializeEvent(event) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/wellness/events", auth, requireRole(...manageRoles), async (req: AuthedRequest, res, next) => {
    try {
      const body = z
        .object({
          title: z.string().min(1),
          categoryId: z.string(),
          dateTime: z.string(),
          durationMinutes: z.number().int().optional(),
          locationType: z.enum(["online", "meeting_room", "dharma_space"]),
          locationDetail: z.string().optional(),
          maxSpots: z.number().int().optional(),
          trainerId: z.string().optional(),
          companyId: z.string().optional()
        })
        .parse(req.body);

      const companyId =
        req.user!.role === "SUPER_ADMIN" ? body.companyId || req.user!.companyId : req.user!.companyId;
      if (!companyId) return res.status(400).json({ message: "Company required" });

      const event = await prisma.wellnessEvent.create({
        data: {
          companyId,
          categoryId: body.categoryId,
          trainerId: body.trainerId || (req.user!.role === "TRAINER" ? req.user!.id : undefined),
          title: body.title,
          dateTime: new Date(body.dateTime),
          durationMinutes: body.durationMinutes ?? 60,
          locationType: body.locationType,
          locationDetail: body.locationDetail,
          maxSpots: body.maxSpots ?? 30,
          createdById: req.user!.id
        },
        include: eventInclude
      });
      res.status(201).json({ event: serializeEvent(event) });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/wellness/events/:id", auth, requireRole(...manageRoles), async (req: AuthedRequest, res, next) => {
    try {
      const existing = await prisma.wellnessEvent.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ message: "Event not found" });
      assertEventAccess(req.user!, existing.companyId);
      if (req.user!.role === "TRAINER" && existing.trainerId !== req.user!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const event = await prisma.wellnessEvent.update({
        where: { id: req.params.id },
        data: {
          title: req.body.title,
          categoryId: req.body.categoryId,
          dateTime: req.body.dateTime ? new Date(req.body.dateTime) : undefined,
          durationMinutes: req.body.durationMinutes,
          locationType: req.body.locationType,
          locationDetail: req.body.locationDetail,
          maxSpots: req.body.maxSpots,
          trainerId: req.body.trainerId,
          status: req.body.status
        },
        include: eventInclude
      });
      res.json({ event: serializeEvent(event) });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/wellness/events/:id", auth, requireRole(...adminRoles), async (req: AuthedRequest, res, next) => {
    try {
      const existing = await prisma.wellnessEvent.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ message: "Event not found" });
      assertEventAccess(req.user!, existing.companyId);
      await prisma.wellnessEvent.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/wellness/events/:id/bookings", auth, requireRole(...manageRoles), async (req: AuthedRequest, res, next) => {
    try {
      const event = await prisma.wellnessEvent.findUnique({ where: { id: req.params.id } });
      if (!event) return res.status(404).json({ message: "Event not found" });
      assertEventAccess(req.user!, event.companyId);
      if (req.user!.role === "TRAINER" && event.trainerId !== req.user!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const bookings = await prisma.wellnessBooking.findMany({
        where: { eventId: event.id, cancelled: false },
        include: { user: { include: { department: true } } }
      });
      res.json({ bookings });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/wellness/bookings/me", auth, requireRole("EMPLOYEE", "HR_ADMIN", "CORPORATE_ADMIN", "SUPER_ADMIN"), async (req: AuthedRequest, res, next) => {
    try {
      const bookings = await prisma.wellnessBooking.findMany({
        where: { userId: req.user!.id },
        include: {
          event: { include: { category: true, trainer: { select: { id: true, name: true, avatar: true } }, attendances: true } }
        },
        orderBy: { bookedAt: "desc" }
      });
      const rows = bookings.map((b) => ({
        ...b,
        attended: b.event.attendances.some((a) => a.userId === req.user!.id)
      }));
      res.json({ bookings: rows });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/wellness/bookings", auth, requireRole("EMPLOYEE", "HR_ADMIN", "CORPORATE_ADMIN", "SUPER_ADMIN"), async (req: AuthedRequest, res, next) => {
    try {
      const { eventId } = z.object({ eventId: z.string() }).parse(req.body);
      const event = await prisma.wellnessEvent.findUnique({
        where: { id: eventId },
        include: { bookings: { where: { cancelled: false } } }
      });
      if (!event) return res.status(404).json({ message: "Event not found" });
      assertEventAccess(req.user!, event.companyId);
      if (event.status === "cancelled") return res.status(400).json({ message: "Event cancelled" });
      if (event.bookings.length >= event.maxSpots) return res.status(409).json({ message: "Event is full" });
      const existing = await prisma.wellnessBooking.findUnique({
        where: { eventId_userId: { eventId, userId: req.user!.id } }
      });
      if (existing && !existing.cancelled) return res.status(409).json({ message: "Already booked" });

      const booking = await prisma.wellnessBooking.upsert({
        where: { eventId_userId: { eventId, userId: req.user!.id } },
        create: { eventId, userId: req.user!.id },
        update: { cancelled: false, bookedAt: new Date() },
        include: { event: { include: { category: true, trainer: true } } }
      });
      res.status(201).json({ booking });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/wellness/bookings/:id", auth, requireRole("EMPLOYEE", "HR_ADMIN", "CORPORATE_ADMIN", "SUPER_ADMIN"), async (req: AuthedRequest, res, next) => {
    try {
      const booking = await prisma.wellnessBooking.findUnique({ where: { id: req.params.id } });
      if (!booking || booking.userId !== req.user!.id) return res.status(404).json({ message: "Booking not found" });
      await prisma.wellnessBooking.update({ where: { id: booking.id }, data: { cancelled: true } });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/wellness/attendance", auth, requireRole(...manageRoles), async (req: AuthedRequest, res, next) => {
    try {
      const body = z.object({ eventId: z.string(), userIds: z.array(z.string()).min(1) }).parse(req.body);
      const event = await prisma.wellnessEvent.findUnique({
        where: { id: body.eventId },
        include: { category: true }
      });
      if (!event) return res.status(404).json({ message: "Event not found" });
      assertEventAccess(req.user!, event.companyId);
      if (req.user!.role === "TRAINER" && event.trainerId !== req.user!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      for (const userId of body.userIds) {
        await prisma.wellnessAttendance.upsert({
          where: { eventId_userId: { eventId: event.id, userId } },
          create: { eventId: event.id, userId, scoreAwarded: event.category.scoreValue },
          update: { scoreAwarded: event.category.scoreValue, attendedAt: new Date() }
        });
        await prisma.user.update({
          where: { id: userId },
          data: { totalWellnessScore: { increment: event.category.scoreValue } }
        });
        await checkAndUnlockBadges(userId, prisma);
      }

      await prisma.wellnessEvent.update({ where: { id: event.id }, data: { status: "completed" } });
      res.json({ ok: true, marked: body.userIds.length });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/wellness/attendance/history", auth, requireRole(...adminRoles), async (req: AuthedRequest, res, next) => {
    try {
      const events = await prisma.wellnessEvent.findMany({
        where: { ...companyScope(req.user!), status: "completed" },
        include: {
          category: true,
          trainer: { select: { id: true, name: true } },
          attendances: { include: { user: { include: { department: true } } } }
        },
        orderBy: { dateTime: "desc" }
      });
      res.json({ history: events });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/wellness/leaderboard", auth, requireRole(...wellnessRoles), async (req: AuthedRequest, res, next) => {
    try {
      const scope = companyScope(req.user!);
      const users = await prisma.user.findMany({
        where: { ...scope, role: "EMPLOYEE" },
        include: { department: true },
        orderBy: { totalWellnessScore: "desc" },
        take: 20
      });
      res.json({
        entries: users.map((u, index) => ({
          rank: index + 1,
          id: u.id,
          fullName: u.name,
          avatarUrl: u.avatar,
          department: u.department?.name || "—",
          totalWellnessScore: u.totalWellnessScore
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/wellness/stats/me", auth, requireRole("EMPLOYEE", "HR_ADMIN", "CORPORATE_ADMIN", "SUPER_ADMIN"), async (req: AuthedRequest, res, next) => {
    try {
      const user = req.user!;
      const stats = await getUserWellnessStats(user.id, prisma);
      const level = getWellnessLevel(stats.attendancePct);
      const attendances = await prisma.wellnessAttendance.findMany({
        where: { userId: user.id },
        include: { event: { include: { category: true } } }
      });
      const byCategoryMap = new Map<string, { categoryName: string; icon: string | null; count: number }>();
      for (const row of attendances) {
        const key = row.event.category.name;
        const existing = byCategoryMap.get(key);
        if (existing) existing.count += 1;
        else byCategoryMap.set(key, { categoryName: key, icon: row.event.category.icon, count: 1 });
      }
      const badges = await prisma.userBadge.findMany({
        where: { userId: user.id },
        include: { badge: true }
      });
      const departments = await prisma.department.findMany({
        where: { companyId: user.companyId || undefined },
        include: { users: { where: { role: "EMPLOYEE" } } }
      });
      const deptScores = departments
        .map((d) => ({
          id: d.id,
          avg: d.users.reduce((sum, u) => sum + u.totalWellnessScore, 0) / Math.max(d.users.length, 1)
        }))
        .sort((a, b) => b.avg - a.avg);
      const myDeptRank = user.departmentId ? deptScores.findIndex((d) => d.id === user.departmentId) + 1 : 0;

      res.json({
        totalWellnessScore: user.totalWellnessScore,
        totalSteps: user.totalSteps,
        attendanceByCategory: [...byCategoryMap.values()],
        attendancePct: stats.attendancePct,
        wellnessLevel: { ...level, percentage: stats.attendancePct, nextLevelAt: nextLevelThreshold(stats.attendancePct) },
        badges: badges.map((b) => ({
          name: b.badge.name,
          emoji: b.badge.icon,
          description: b.badge.description,
          unlockedAt: b.earnedAt
        })),
        departmentRank: { rank: myDeptRank || null, totalDepts: departments.length }
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/wellness/leaderboard/departments", auth, requireRole(...wellnessRoles), async (req: AuthedRequest, res, next) => {
    try {
      const companyId = req.user!.role === "SUPER_ADMIN" ? undefined : req.user!.companyId || undefined;
      const departments = await prisma.department.findMany({
        where: companyId ? { companyId } : {},
        include: {
          users: {
            where: { role: "EMPLOYEE" },
            include: { wellnessAttendances: true, wellnessBookings: { where: { cancelled: false } } }
          }
        }
      });

      const rows = departments.map((dept) => {
        const employees = dept.users;
        const totalBookings = employees.reduce((sum, u) => sum + u.wellnessBookings.length, 0);
        const totalAttended = employees.reduce((sum, u) => sum + u.wellnessAttendances.length, 0);
        const avgAttendancePct = totalBookings ? Math.round((totalAttended / totalBookings) * 100) : 0;
        const totalEventsAttended = totalAttended;
        const totalScore = employees.reduce((sum, u) => sum + u.totalWellnessScore, 0);
        return {
          id: dept.id,
          name: dept.name,
          avgAttendancePct,
          totalEventsAttended,
          totalScore,
          weekStreak: Math.min(totalEventsAttended, 4),
          employeeCount: employees.length
        };
      });

      rows.sort((a, b) => b.avgAttendancePct - a.avgAttendancePct || b.totalScore - a.totalScore);
      const topGain = [...rows].sort((a, b) => b.totalEventsAttended - a.totalEventsAttended)[0]?.id;
      res.json({
        departments: rows.map((row, index) => ({
          ...row,
          rank: index + 1,
          mostImproved: row.id === topGain && index > 0
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/wellness/schedule-requests", auth, requireRole("HR_ADMIN", "CORPORATE_ADMIN"), async (req: AuthedRequest, res, next) => {
    try {
      const body = z.object({ scheduleData: z.array(z.record(z.unknown())).min(1) }).parse(req.body);
      if (!req.user!.companyId) return res.status(400).json({ message: "Company required" });
      const request = await prisma.scheduleRequest.create({
        data: {
          companyId: req.user!.companyId,
          submittedById: req.user!.id,
          scheduleData: body.scheduleData as object
        }
      });
      res.status(201).json({ request });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/wellness/schedule-requests", auth, requireRole("HR_ADMIN", "CORPORATE_ADMIN", "SUPER_ADMIN"), async (req: AuthedRequest, res, next) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const requests = await prisma.scheduleRequest.findMany({
        where: {
          ...(req.user!.role === "SUPER_ADMIN" ? {} : { companyId: req.user!.companyId || "__none__" }),
          ...(status ? { status } : {})
        },
        include: { company: true, submittedBy: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" }
      });
      res.json({ requests });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/wellness/schedule-requests/:id", auth, requireRole("SUPER_ADMIN"), async (req: AuthedRequest, res, next) => {
    try {
      const existing = await prisma.scheduleRequest.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ message: "Request not found" });
      const status = req.body.status as string | undefined;
      const scheduleData = (req.body.scheduleData as Record<string, unknown>[] | undefined) ?? (existing.scheduleData as Record<string, unknown>[]);

      const request = await prisma.scheduleRequest.update({
        where: { id: existing.id },
        data: {
          status: status || existing.status,
          adminNotes: req.body.adminNotes,
          scheduleData: scheduleData as object
        }
      });

      if (status === "approved") {
        for (const item of scheduleData) {
          const categoryId = String(item.categoryId || "");
          const dateTime = String(item.dateTime || "");
          if (!categoryId || !dateTime) continue;
          await prisma.wellnessEvent.create({
            data: {
              companyId: existing.companyId,
              categoryId,
              trainerId: item.trainerId ? String(item.trainerId) : undefined,
              title: String(item.title || "Wellness Session"),
              dateTime: new Date(dateTime),
              durationMinutes: Number(item.durationMinutes || 60),
              locationType: String(item.locationType || "online"),
              locationDetail: item.locationDetail ? String(item.locationDetail) : undefined,
              maxSpots: Number(item.maxSpots || 30),
              createdById: existing.submittedById
            }
          });
        }
      }

      res.json({ request });
    } catch (error) {
      next(error);
    }
  });
}
