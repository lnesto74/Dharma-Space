import type { Express, NextFunction, Request, Response } from "express";
import type { PrismaClient, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";

type AuthedRequest = Request & { user?: User };

const COMPANY_SUMMARY_INCLUDE = {
  users: { select: { role: true, totalWellnessScore: true } },
  departments: { select: { id: true } },
  wellnessEvents: { select: { status: true, dateTime: true } },
  scheduleRequests: { select: { status: true } },
  invoices: { select: { amount: true } }
} as const;

const PLATFORM_ROLES = ["EMPLOYEE", "HR_ADMIN", "TRAINER", "CORPORATE_ADMIN", "SUPER_ADMIN"] as const;

function companySummary(
  company: {
    id: string;
    name: string;
    industry: string;
    plan: string;
    seats: number;
    createdAt: Date;
    users: Array<{ role: string; totalWellnessScore: number }>;
    departments: Array<{ id: string }>;
    wellnessEvents: Array<{ status: string; dateTime: Date }>;
    scheduleRequests: Array<{ status: string }>;
    invoices: Array<{ amount: number }>;
  }
) {
  const employees = company.users.filter((u) => u.role === "EMPLOYEE");
  const upcomingEvents = company.wellnessEvents.filter(
    (e) => e.status !== "cancelled" && e.status !== "completed" && e.dateTime >= new Date()
  );
  return {
    id: company.id,
    name: company.name,
    industry: company.industry,
    plan: company.plan,
    seats: company.seats,
    createdAt: company.createdAt,
    userCount: company.users.length,
    employeeCount: employees.length,
    departmentCount: company.departments.length,
    seatsUsed: company.users.length,
    upcomingEventCount: upcomingEvents.length,
    totalEventCount: company.wellnessEvents.length,
    pendingScheduleRequests: company.scheduleRequests.filter((r) => r.status === "pending").length,
    totalWellnessScore: employees.reduce((sum, u) => sum + u.totalWellnessScore, 0),
    revenue: company.invoices.reduce((sum, inv) => sum + inv.amount, 0)
  };
}

export function registerAdminCwpRoutes(
  app: Express,
  prisma: PrismaClient,
  auth: (req: AuthedRequest, res: Response, next: NextFunction) => void,
  requireRole: (...roles: string[]) => (req: AuthedRequest, res: Response, next: NextFunction) => void,
  sanitizeUser: (user: User) => Record<string, unknown>
) {
  const superAdmin = requireRole("SUPER_ADMIN");

  app.get("/api/admin/cwp/overview", auth, superAdmin, async (_req, res, next) => {
    try {
      const now = new Date();
      const [
        companies,
        employees,
        wellnessEvents,
        upcomingEvents,
        bookings,
        attendances,
        pendingScheduleRequests,
        cwpInquiries,
        pendingUsers
      ] = await Promise.all([
        prisma.company.count(),
        prisma.user.count({ where: { role: "EMPLOYEE" } }),
        prisma.wellnessEvent.count(),
        prisma.wellnessEvent.count({
          where: { dateTime: { gte: now }, status: { in: ["scheduled", "draft"] } }
        }),
        prisma.wellnessBooking.count({ where: { cancelled: false } }),
        prisma.wellnessAttendance.count(),
        prisma.scheduleRequest.count({ where: { status: "pending" } }),
        prisma.formSubmission.count({ where: { type: "CWP_DEMO" } }),
        prisma.user.count({ where: { accountStatus: "PENDING" } })
      ]);

      const recentCompanies = await prisma.company.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          users: { select: { role: true, totalWellnessScore: true } },
          departments: { select: { id: true } },
          wellnessEvents: { select: { status: true, dateTime: true } },
          scheduleRequests: { select: { status: true } },
          invoices: { select: { amount: true } }
        }
      });

      res.json({
        kpis: {
          companies,
          employees,
          wellnessEvents,
          upcomingEvents,
          activeBookings: bookings,
          totalAttendances: attendances,
          pendingScheduleRequests,
          cwpInquiries,
          pendingUsers
        },
        recentCompanies: recentCompanies.map(companySummary)
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/cwp/companies", auth, superAdmin, async (_req, res, next) => {
    try {
      const companies = await prisma.company.findMany({
        orderBy: { name: "asc" },
        include: {
          users: { select: { role: true, totalWellnessScore: true } },
          departments: { select: { id: true } },
          wellnessEvents: { select: { status: true, dateTime: true } },
          scheduleRequests: { select: { status: true } },
          invoices: { select: { amount: true } }
        }
      });
      res.json({ companies: companies.map(companySummary) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/cwp/companies/:id", auth, superAdmin, async (req, res, next) => {
    try {
      const company = await prisma.company.findUnique({
        where: { id: req.params.id },
        include: {
          departments: { include: { users: { select: { id: true, name: true, role: true, email: true } } } },
          users: { include: { department: true } },
          wellnessEvents: {
            include: {
              category: true,
              trainer: { select: { id: true, name: true } },
              bookings: { where: { cancelled: false } },
              attendances: true
            },
            orderBy: { dateTime: "desc" },
            take: 20
          },
          scheduleRequests: {
            include: { submittedBy: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: "desc" }
          },
          challenges: { include: { participations: true } },
          invoices: { orderBy: { issuedAt: "desc" } }
        }
      });
      if (!company) return res.status(404).json({ message: "Company not found" });

      res.json({
        company: {
          ...companySummary(company),
          departments: company.departments.map((d) => ({
            id: d.id,
            name: d.name,
            userCount: d.users.length,
            employees: d.users.filter((u) => u.role === "EMPLOYEE").length
          })),
          users: company.users.map((u) => sanitizeUser(u)),
          events: company.wellnessEvents.map((e) => ({
            id: e.id,
            title: e.title,
            dateTime: e.dateTime,
            status: e.status,
            category: e.category.name,
            trainer: e.trainer?.name || null,
            bookedCount: e.bookings.length,
            attendedCount: e.attendances.length,
            maxSpots: e.maxSpots
          })),
          scheduleRequests: company.scheduleRequests,
          challenges: company.challenges,
          invoices: company.invoices
        }
      });
    } catch (error) {
      next(error);
    }
  });

  const companyPatchSchema = z.object({
    name: z.string().min(1).optional(),
    industry: z.string().min(1).optional(),
    plan: z.string().min(1).optional(),
    seats: z.number().int().positive().optional()
  });

  app.patch("/api/admin/cwp/companies/:id", auth, superAdmin, async (req, res, next) => {
    try {
      const body = companyPatchSchema.parse(req.body);
      const company = await prisma.company.update({
        where: { id: req.params.id },
        data: body,
        include: {
          users: { select: { role: true, totalWellnessScore: true } },
          departments: { select: { id: true } },
          wellnessEvents: { select: { status: true, dateTime: true } },
          scheduleRequests: { select: { status: true } },
          invoices: { select: { amount: true } }
        }
      });
      res.json({ company: companySummary(company) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/cwp/events", auth, superAdmin, async (req, res, next) => {
    try {
      const companyId = typeof req.query.companyId === "string" ? req.query.companyId : undefined;
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const upcoming = req.query.upcoming === "true";

      const events = await prisma.wellnessEvent.findMany({
        where: {
          ...(companyId ? { companyId } : {}),
          ...(status ? { status } : {}),
          ...(upcoming ? { dateTime: { gte: new Date() }, status: { in: ["scheduled", "draft"] } } : {})
        },
        include: {
          company: { select: { id: true, name: true } },
          category: true,
          trainer: { select: { id: true, name: true } },
          bookings: { where: { cancelled: false } },
          attendances: true
        },
        orderBy: { dateTime: "desc" },
        take: Math.min(Number(req.query.limit) || 100, 200)
      });

      res.json({
        events: events.map((e) => ({
          id: e.id,
          title: e.title,
          dateTime: e.dateTime,
          status: e.status,
          locationType: e.locationType,
          company: e.company,
          category: e.category.name,
          trainer: e.trainer?.name || null,
          bookedCount: e.bookings.length,
          attendedCount: e.attendances.length,
          maxSpots: e.maxSpots
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/cwp/schedule-requests", auth, superAdmin, async (req, res, next) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const requests = await prisma.scheduleRequest.findMany({
        where: status ? { status } : {},
        include: {
          company: { select: { id: true, name: true, plan: true } },
          submittedBy: { select: { id: true, name: true, email: true } }
        },
        orderBy: { createdAt: "desc" }
      });
      res.json({ requests });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/cwp/users", auth, superAdmin, async (req, res, next) => {
    try {
      const companyId = typeof req.query.companyId === "string" ? req.query.companyId : undefined;
      const role = typeof req.query.role === "string" ? req.query.role : undefined;
      const accountStatus = typeof req.query.accountStatus === "string" ? req.query.accountStatus : undefined;
      const users = await prisma.user.findMany({
        where: {
          ...(companyId ? { companyId } : {}),
          ...(role ? { role } : {}),
          ...(accountStatus ? { accountStatus } : {})
        },
        include: { company: true, department: true },
        orderBy: { name: "asc" }
      });
      res.json({ users: users.map(sanitizeUser) });
    } catch (error) {
      next(error);
    }
  });

  // ---- Companies: create / archive -------------------------------------------------
  const companyCreateSchema = z.object({
    name: z.string().min(1),
    industry: z.string().min(1).default("General"),
    plan: z.string().min(1).default("Starter"),
    seats: z.number().int().positive().default(50)
  });

  app.post("/api/admin/cwp/companies", auth, superAdmin, async (req, res, next) => {
    try {
      const body = companyCreateSchema.parse(req.body);
      const created = await prisma.company.create({ data: body });
      const company = await prisma.company.findUniqueOrThrow({
        where: { id: created.id },
        include: COMPANY_SUMMARY_INCLUDE
      });
      res.status(201).json({ company: companySummary(company) });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/cwp/companies/:id", auth, superAdmin, async (req, res, next) => {
    try {
      const [userCount, eventCount] = await Promise.all([
        prisma.user.count({ where: { companyId: req.params.id } }),
        prisma.wellnessEvent.count({ where: { companyId: req.params.id } })
      ]);
      if (userCount > 0 || eventCount > 0) {
        return res.status(409).json({
          message: `Cannot delete: company still has ${userCount} user(s) and ${eventCount} event(s). Reassign or remove them first.`
        });
      }
      await prisma.department.deleteMany({ where: { companyId: req.params.id } });
      await prisma.company.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // ---- Departments: create / rename / delete ---------------------------------------
  const departmentSchema = z.object({ name: z.string().min(1) });

  app.post("/api/admin/cwp/companies/:id/departments", auth, superAdmin, async (req, res, next) => {
    try {
      const body = departmentSchema.parse(req.body);
      const department = await prisma.department.create({
        data: { name: body.name, companyId: req.params.id }
      });
      res.status(201).json({ department });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/cwp/departments/:id", auth, superAdmin, async (req, res, next) => {
    try {
      const body = departmentSchema.parse(req.body);
      const department = await prisma.department.update({
        where: { id: req.params.id },
        data: { name: body.name }
      });
      res.json({ department });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/cwp/departments/:id", auth, superAdmin, async (req, res, next) => {
    try {
      await prisma.user.updateMany({
        where: { departmentId: req.params.id },
        data: { departmentId: null }
      });
      await prisma.department.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // ---- Users: create / edit / delete -----------------------------------------------
  const userCreateSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(PLATFORM_ROLES),
    companyId: z.string().nullable().optional(),
    departmentId: z.string().nullable().optional()
  });

  app.post("/api/admin/cwp/users", auth, superAdmin, async (req, res, next) => {
    try {
      const body = userCreateSchema.parse(req.body);
      const existing = await prisma.user.findUnique({ where: { email: body.email } });
      if (existing) return res.status(409).json({ message: "A user with that email already exists." });
      const user = await prisma.user.create({
        data: {
          name: body.name,
          email: body.email,
          passwordHash: await bcrypt.hash(body.password, 12),
          role: body.role,
          accountStatus: "APPROVED",
          companyId: body.companyId ?? null,
          departmentId: body.departmentId ?? null
        }
      });
      res.status(201).json({ user: sanitizeUser(user) });
    } catch (error) {
      next(error);
    }
  });

  const userPatchSchema = z.object({
    name: z.string().min(1).optional(),
    role: z.enum(PLATFORM_ROLES).optional(),
    companyId: z.string().nullable().optional(),
    departmentId: z.string().nullable().optional(),
    password: z.string().min(6).optional(),
    accountStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional()
  });

  app.patch("/api/admin/cwp/users/:id", auth, superAdmin, async (req, res, next) => {
    try {
      const body = userPatchSchema.parse(req.body);
      const data: Record<string, unknown> = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.role !== undefined) data.role = body.role;
      if (body.companyId !== undefined) data.companyId = body.companyId;
      if (body.departmentId !== undefined) data.departmentId = body.departmentId;
      if (body.accountStatus !== undefined) data.accountStatus = body.accountStatus;
      if (body.password) data.passwordHash = await bcrypt.hash(body.password, 12);
      const user = await prisma.user.update({ where: { id: req.params.id }, data });
      res.json({ user: sanitizeUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/cwp/users/:id", auth, superAdmin, async (req: AuthedRequest, res, next) => {
    try {
      if (req.params.id === req.user!.id) {
        return res.status(409).json({ message: "You cannot delete your own account." });
      }
      const [createdEvents, trainerEvents] = await Promise.all([
        prisma.wellnessEvent.count({ where: { createdById: req.params.id } }),
        prisma.wellnessEvent.count({ where: { trainerId: req.params.id } })
      ]);
      if (createdEvents > 0 || trainerEvents > 0) {
        return res.status(409).json({
          message: "This user owns or coaches wellness events. Reassign those events before deleting."
        });
      }
      await prisma.$transaction([
        prisma.wellnessBooking.deleteMany({ where: { userId: req.params.id } }),
        prisma.wellnessAttendance.deleteMany({ where: { userId: req.params.id } }),
        prisma.userBadge.deleteMany({ where: { userId: req.params.id } }),
        prisma.user.delete({ where: { id: req.params.id } })
      ]);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // ---- Events: create / edit / delete ----------------------------------------------
  const eventCreateSchema = z.object({
    companyId: z.string().min(1),
    categoryId: z.string().min(1),
    title: z.string().min(1),
    dateTime: z.string().min(1),
    trainerId: z.string().nullable().optional(),
    durationMinutes: z.number().int().positive().optional(),
    locationType: z.string().min(1).default("online"),
    locationDetail: z.string().nullable().optional(),
    maxSpots: z.number().int().positive().optional(),
    status: z.string().optional()
  });

  app.post("/api/admin/cwp/events", auth, superAdmin, async (req: AuthedRequest, res, next) => {
    try {
      const body = eventCreateSchema.parse(req.body);
      const event = await prisma.wellnessEvent.create({
        data: {
          companyId: body.companyId,
          categoryId: body.categoryId,
          title: body.title,
          dateTime: new Date(body.dateTime),
          trainerId: body.trainerId ?? null,
          durationMinutes: body.durationMinutes ?? 60,
          locationType: body.locationType,
          locationDetail: body.locationDetail ?? null,
          maxSpots: body.maxSpots ?? 30,
          status: body.status ?? "scheduled",
          createdById: req.user!.id
        }
      });
      res.status(201).json({ event });
    } catch (error) {
      next(error);
    }
  });

  const eventPatchSchema = z.object({
    title: z.string().min(1).optional(),
    categoryId: z.string().min(1).optional(),
    dateTime: z.string().min(1).optional(),
    trainerId: z.string().nullable().optional(),
    durationMinutes: z.number().int().positive().optional(),
    locationType: z.string().min(1).optional(),
    locationDetail: z.string().nullable().optional(),
    maxSpots: z.number().int().positive().optional(),
    status: z.string().optional()
  });

  app.patch("/api/admin/cwp/events/:id", auth, superAdmin, async (req, res, next) => {
    try {
      const body = eventPatchSchema.parse(req.body);
      const data: Record<string, unknown> = { ...body };
      if (body.dateTime) data.dateTime = new Date(body.dateTime);
      const event = await prisma.wellnessEvent.update({ where: { id: req.params.id }, data });
      res.json({ event });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/cwp/events/:id", auth, superAdmin, async (req, res, next) => {
    try {
      await prisma.wellnessEvent.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // ---- Form options (dropdowns) + cross-company analytics --------------------------
  app.get("/api/admin/cwp/form-options", auth, superAdmin, async (_req, res, next) => {
    try {
      const [companies, categories, trainers] = await Promise.all([
        prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
        prisma.wellnessEventCategory.findMany({ select: { id: true, name: true, scoreValue: true }, orderBy: { name: "asc" } }),
        prisma.user.findMany({ where: { role: "TRAINER" }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      ]);
      res.json({ companies, categories, trainers });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/cwp/analytics", auth, superAdmin, async (_req, res, next) => {
    try {
      const [events, attendances, companies, roleGroups] = await Promise.all([
        prisma.wellnessEvent.findMany({
          select: { category: { select: { name: true } }, _count: { select: { attendances: true, bookings: true } } }
        }),
        prisma.wellnessAttendance.findMany({ select: { attendedAt: true } }),
        prisma.company.findMany({
          select: { id: true, name: true, users: { select: { role: true, totalWellnessScore: true } } }
        }),
        prisma.user.groupBy({ by: ["role"], _count: { _all: true } })
      ]);

      const byCategory = new Map<string, { events: number; attendances: number }>();
      for (const e of events) {
        const key = e.category.name;
        const cur = byCategory.get(key) || { events: 0, attendances: 0 };
        cur.events += 1;
        cur.attendances += e._count.attendances;
        byCategory.set(key, cur);
      }

      const months: { key: string; label: string; attendances: number }[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
          label: d.toLocaleString("en-US", { month: "short" }),
          attendances: 0
        });
      }
      const monthIndex = new Map(months.map((m, i) => [m.key, i]));
      for (const a of attendances) {
        const k = `${a.attendedAt.getFullYear()}-${String(a.attendedAt.getMonth() + 1).padStart(2, "0")}`;
        const idx = monthIndex.get(k);
        if (idx !== undefined) months[idx].attendances += 1;
      }

      const companiesByScore = companies
        .map((c) => ({
          id: c.id,
          name: c.name,
          score: c.users.filter((u) => u.role === "EMPLOYEE").reduce((s, u) => s + u.totalWellnessScore, 0),
          employees: c.users.filter((u) => u.role === "EMPLOYEE").length
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

      res.json({
        categories: Array.from(byCategory.entries()).map(([name, v]) => ({ name, ...v })),
        attendanceByMonth: months.map((m) => ({ label: m.label, attendances: m.attendances })),
        companiesByScore,
        roleDistribution: roleGroups.map((g) => ({ role: g.role, count: g._count._all }))
      });
    } catch (error) {
      next(error);
    }
  });
}
