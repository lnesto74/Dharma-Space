import type { Express, NextFunction, Request, Response } from "express";
import type { PrismaClient, User } from "@prisma/client";
import { z } from "zod";
import { notifyAdminPendingUser } from "./pending-user-notifications.js";
import {
  ONBOARDING_ROLES,
  USER_PROFILE_INCLUDE,
  pendingAccountMessage,
  sanitizeUser
} from "./user-auth.js";

type AuthedRequest = Request & { user?: User };

export function registerOnboardingRoutes(
  app: Express,
  prisma: PrismaClient,
  auth: (req: AuthedRequest, res: Response, next: NextFunction) => void
) {
  app.get("/api/companies/search", auth, async (req: AuthedRequest, res, next) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      if (q.length < 1) {
        return res.json({ companies: [] });
      }
      const companies = await prisma.company.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        select: { id: true, name: true, industry: true },
        orderBy: { name: "asc" },
        take: 12
      });
      res.json({ companies });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/companies/:id/departments", auth, async (req, res, next) => {
    try {
      const departments = await prisma.department.findMany({
        where: { companyId: req.params.id },
        select: { id: true, name: true },
        orderBy: { name: "asc" }
      });
      res.json({ departments });
    } catch (error) {
      next(error);
    }
  });

  const onboardingSchema = z.object({
    name: z.string().min(2),
    companyId: z.string().min(1),
    departmentId: z.string().min(1),
    role: z.enum(ONBOARDING_ROLES),
    position: z.string().min(1)
  });

  app.post("/api/auth/onboarding", auth, async (req: AuthedRequest, res, next) => {
    try {
      const body = onboardingSchema.parse(req.body);
      const user = req.user!;

      if (user.onboardingCompleted) {
        return res.status(400).json({ message: "Onboarding already completed." });
      }

      const company = await prisma.company.findUnique({ where: { id: body.companyId } });
      if (!company) return res.status(400).json({ message: "Company not found." });

      const department = await prisma.department.findFirst({
        where: { id: body.departmentId, companyId: body.companyId }
      });
      if (!department) return res.status(400).json({ message: "Department not found for this company." });

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: body.name.trim(),
          companyId: body.companyId,
          departmentId: body.departmentId,
          role: body.role,
          position: body.position.trim(),
          onboardingCompleted: true,
          accountStatus: "PENDING"
        },
        include: USER_PROFILE_INCLUDE
      });

      await notifyAdminPendingUser({
        name: updated.name,
        email: updated.email,
        method: "email",
        role: updated.role,
        position: updated.position,
        company: updated.company?.name,
        companyId: updated.companyId,
        department: updated.department?.name
      });

      res.json({
        user: sanitizeUser(updated),
        pending: true,
        message: pendingAccountMessage()
      });
    } catch (error) {
      next(error);
    }
  });
}
