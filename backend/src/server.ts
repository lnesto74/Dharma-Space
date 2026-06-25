import { randomBytes } from "node:crypto";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(backendRoot, ".env") });

import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient, User } from "@prisma/client";
import { z } from "zod";
import { inquirySchema, markInquiryPaid, processInquiry, serializeSubmission } from "./inquiries.js";
import { assertProgramHasCapacity } from "./program-bookings.js";
import { mailConfigured, sourceFromInbox, logMailStatus, verifyMailConnection, sendMail, inboxFor, resetMailTransporter, notifyInbox, isMailConfigured } from "./mail.js";
import { registerSiteContentRoutes, migrateProgramCategories } from "./site-content.js";
import { registerSiteBookingRoutes } from "./site-bookings.js";
import { sendBookingConfirmedEmails } from "./booking-emails.js";
import { migrateClassScheduleFields } from "./class-schedule.js";
import { migrateProgramScheduleFields } from "./program-schedule.js";
import { verifyGoogleIdToken, isCorporateRole } from "./google-auth.js";
import { ensureSiteContent } from "../prisma/seed-site.js";
import {
  isAllowedProxyUrl,
  streamProxiedImage,
  TRAINER_MEDIA_DIR
} from "./trainer-media-cache.js";
import { PROGRAM_MEDIA_DIR } from "./program-media-cache.js";
import { TEAM_BUILDING_MEDIA_DIR, AVATAR_MEDIA_DIR } from "./data-root.js";
import { ensureDatabaseSchema, ensurePrismaClientGenerated } from "./ensure-schema.js";
import { applySchemaPatches } from "./schema-patches.js";
import { registerOnboardingRoutes } from "./onboarding-routes.js";
import {
  pendingAccountMessage,
  sanitizeUser,
  createUser,
  withAuthFields,
  USER_PROFILE_INCLUDE,
  type UserWithRelations
} from "./user-auth.js";
import { registerStripeWebhook, stripeStatusPayload } from "./stripe.js";
import { registerWellnessRoutes } from "./wellness-routes.js";
import { registerMessagingRoutes } from "./messaging-routes.js";
import { registerChallengeRoutes } from "./challenge-routes.js";
import { saveUploadedAvatarFile } from "./avatar-media.js";
import { registerAdminCwpRoutes } from "./admin-cwp-routes.js";

let prisma!: PrismaClient;
const app = express();

registerStripeWebhook(app, () => prisma);
const port = Number(process.env.PORT || 7010);
const jwtSecret = process.env.JWT_SECRET || "dev-secret";

app.use(cors({
  origin(origin, callback) {
    const allowed = [
      process.env.FRONTEND_URL || "http://localhost:7011",
      process.env.CORPORATE_URL || "http://localhost:7011"
    ];
    const hostname = origin ? new URL(origin).hostname : "";
    if (
      !origin
      || allowed.includes(origin)
      || /\.dharma-space\.com$/.test(hostname)
      || /\.ondigitalocean\.app$/.test(hostname)
    ) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true
}));
app.use(express.json({ limit: "12mb" }));
app.use(morgan("dev"));

// DigitalOcean App Platform strips the /api path prefix when routing to the backend service.
app.use((req, _res, next) => {
  if (!req.url.startsWith("/api")) {
    req.url = `/api${req.url}`;
  }
  next();
});

app.use("/api/media/trainers", express.static(TRAINER_MEDIA_DIR, { maxAge: "7d" }));
app.use("/api/media/programs", express.static(PROGRAM_MEDIA_DIR, { maxAge: "7d" }));
app.use("/api/media/team-building", express.static(TEAM_BUILDING_MEDIA_DIR, { maxAge: "7d" }));
app.use("/api/media/avatars", express.static(AVATAR_MEDIA_DIR, { maxAge: "7d" }));

app.get("/api/media/proxy", async (req, res, next) => {
  try {
    const url = typeof req.query.url === "string" ? req.query.url : "";
    if (!isAllowedProxyUrl(url)) {
      return res.status(400).json({ message: "Image URL not allowed" });
    }
    await streamProxiedImage(url, res);
  } catch (error) {
    next(error);
  }
});

type AuthedRequest = Request & { user?: User };

function signToken(user: User) {
  return jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: "7d" });
}

function buildAuthResponse(user: UserWithRelations) {
  const u = withAuthFields(user);
  const profile = sanitizeUser(u);
  if (!u.onboardingCompleted) {
    return { token: signToken(u), user: profile, needsOnboarding: true as const };
  }
  if (u.accountStatus === "REJECTED") {
    return {
      rejected: true as const,
      message: "This account was not approved. Contact Dharma Space support if you need help."
    };
  }
  if (u.accountStatus === "PENDING") {
    return { pending: true as const, message: pendingAccountMessage(), user: profile };
  }
  const portalRole = isCorporateRole(u.role) || u.role === "TRAINER";
  if (!portalRole) {
    return {
      message: "No corporate workspace account for this email. Ask your HR admin to invite you."
    };
  }
  return { token: signToken(u), user: profile };
}

async function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Missing token" });
  try {
    const payload = jwt.verify(header.slice(7), jwtSecret) as { sub: string };
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ message: "Invalid token" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

function requireRole(...roles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function courseDto(course: any) {
  return {
    ...course,
    tags: parseJson<string[]>(course.tags, []),
    learningOutcomes: parseJson<string[]>(course.learningOutcomes, []),
    instructor: course.instructor ? sanitizeUser(course.instructor) : null
  };
}

function wellbeingScore(checkin: { mood: number; stress: number; energy: number; sleep: number; focus: number }) {
  return Math.round(((checkin.mood + (6 - checkin.stress) + checkin.energy + checkin.sleep + checkin.focus) / 25) * 100);
}

async function companyUserIds(user: User) {
  const users = await prisma.user.findMany({
    where: { companyId: user.companyId || undefined, role: "EMPLOYEE" },
    select: { id: true }
  });
  return users.map((u) => u.id);
}

app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", mailConfigured: mailConfigured(), stripe: stripeStatusPayload() })
);

app.post("/api/inquiries", async (req, res, next) => {
  try {
    const input = inquirySchema.parse(req.body);
    if (
      input.siteProgramId &&
      input.type === "booking_payment"
    ) {
      const guestsRaw = input.guests || input.context?.guests || "1";
      const guests = guestsRaw === "5+" ? 5 : Math.max(1, Number.parseInt(String(guestsRaw), 10) || 1);
      await assertProgramHasCapacity(prisma, input.siteProgramId, guests);
    }
    const result = await processInquiry(prisma, input);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/inquiries", auth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const { type, status, source, segment, limit = "100" } = req.query;
    let submissions = await prisma.formSubmission.findMany({
      where: {
        ...(type ? { type: String(type).toUpperCase() } : {}),
        ...(status ? { status: String(status).toUpperCase() } : {})
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(limit) || 100, 500)
    });

    const sourceFilter = source === "corporate" || source === "education" || source === "cwp" ? String(source) : null;
    const segmentFilter = typeof segment === "string" && segment !== "ALL" ? segment.toUpperCase() : null;

    let enriched = await Promise.all(submissions.map((s) => serializeSubmission(prisma, s)));

    if (sourceFilter === "cwp") {
      enriched = enriched.filter((s) => s.segment === "CWP" || s.type === "CWP_DEMO");
    } else if (sourceFilter) {
      enriched = enriched.filter((s) => s.source === sourceFilter);
    }

    if (segmentFilter) {
      enriched = enriched.filter((s) => s.segment === segmentFilter);
    }

    res.json({
      submissions: enriched,
      mailConfigured: mailConfigured(),
      counts: {
        total: enriched.length,
        cwp: enriched.filter((s) => s.segment === "CWP").length,
        new: enriched.filter((s) => s.status === "NEW").length
      }
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/inquiries/:id", auth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const status = z.enum(["NEW", "READ", "ARCHIVED"]).parse(req.body.status);
    const submission = await prisma.formSubmission.update({
      where: { id: req.params.id },
      data: { status }
    });
    res.json({ submission: await serializeSubmission(prisma, submission) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/inquiries/:id/mark-paid", auth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const result = await markInquiryPaid(prisma, req.params.id);
    res.json(result);
  } catch (error: any) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    next(error);
  }
});

app.post("/api/admin/test-mail", auth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const body = z
      .object({
        category: z.enum(["corporate", "education", "both"]).optional(),
        customerEmail: z.string().email().optional()
      })
      .parse(req.body ?? {});
    const category = body.category ?? "both";
    const categories = category === "both" ? (["corporate", "education"] as const) : ([category] as const);
    const results: Array<{ category: string; ok: boolean; inbox?: string; error?: string }> = [];

    for (const cat of categories) {
      resetMailTransporter(cat);
      const verify = await verifyMailConnection(cat);
      if (!verify.ok) {
        results.push({ category: cat, ok: false, error: verify.error });
        continue;
      }
      const inbox = inboxFor(cat);
      const sent = await sendMail(cat, {
        to: inbox,
        subject: `Dharma Space test — ${cat} inbox`,
        text: [
          `This is a test email from the Dharma Space website backend.`,
          ``,
          `Category: ${cat}`,
          `Inbox: ${inbox}`,
          `Time: ${new Date().toISOString()}`,
          ``,
          `If you received this, enquiry notifications for ${cat} will work.`
        ].join("\n")
      });
      results.push({
        category: cat,
        ok: sent,
        inbox,
        error: sent ? undefined : "Send failed — check backend logs"
      });
    }

    let customer: { ok: boolean; to: string; error?: string } | undefined;
    const runCustomerTest = category === "education" || category === "both";
    if (runCustomerTest && isMailConfigured("education")) {
      const to = body.customerEmail || notifyInbox();
      const customerSent = await sendBookingConfirmedEmails({
        reference: `DS-TEST-${Date.now()}`,
        offeringTitle: "Yoga Alignments Workshop (test email)",
        scheduledLabel: "September 24, 2026",
        time: "2:00 PM",
        location: "Dharma Space Studio",
        facilitator: "Vera Pleshakova",
        price: "SGD 5",
        guests: 1,
        notes: "This is a test booking confirmation — no action needed.",
        customerName: "Test Guest",
        customerEmail: to,
        customerPhone: null,
        category: "WORKSHOP",
        siteProgramId: null,
        siteClassId: null,
        paymentMethod: "STRIPE"
      });
      customer = {
        ok: customerSent,
        to,
        error: customerSent ? undefined : "Customer confirmation send failed — check backend logs"
      };
    }

    res.json({ results, customer, mailConfigured: mailConfigured() });
  } catch (error) {
    next(error);
  }
});

async function ensureSiteAdmin() {
  const email = "admin@dharma-space.com";
  const pass = process.env.SITE_ADMIN_PASS || "admin";
  const passwordHash = await bcrypt.hash(pass, 12);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { passwordHash, role: "SUPER_ADMIN", accountStatus: "APPROVED", onboardingCompleted: true }
    });
    return;
  }
  await createUser(prisma, {
    name: "Website Admin",
    email,
    passwordHash,
    role: "SUPER_ADMIN",
    accountStatus: "APPROVED",
    onboardingCompleted: true,
    avatar: "AD"
  });
}

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(2).optional(),
      email: z.string().email(),
      password: z.string().min(8)
    }).parse(req.body);
    const email = body.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: "An account with this email already exists." });
    const user = await createUser(prisma, {
      name: body.name?.trim() || email.split("@")[0],
      email,
      passwordHash: await bcrypt.hash(body.password, 12),
      role: "EMPLOYEE",
      accountStatus: "PENDING",
      onboardingCompleted: false
    });
    res.status(201).json(buildAuthResponse(user));
  } catch (error) {
    next(error);
  }
});

function respondAuth(res: Response, result: ReturnType<typeof buildAuthResponse>, created = false) {
  if ("needsOnboarding" in result && result.needsOnboarding) {
    res.status(created ? 201 : 200).json(result);
    return;
  }
  if ("pending" in result && result.pending) {
    res.status(403).json(result);
    return;
  }
  if ("rejected" in result && result.rejected) {
    res.status(403).json(result);
    return;
  }
  if (!("token" in result)) {
    res.status(403).json(result);
    return;
  }
  res.status(created ? 201 : 200).json(result);
}

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const body = z.object({
      email: z.string().optional(),
      username: z.string().optional(),
      password: z.string()
    }).parse(req.body);
    const loginKey = (body.username || body.email || "").trim().toLowerCase();
    if (!loginKey) return res.status(400).json({ message: "Email or username required" });
    const email = loginKey === "admin" ? "admin@dharma-space.com" : loginKey;
    const user = await prisma.user.findUnique({ where: { email }, include: USER_PROFILE_INCLUDE });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    respondAuth(res, buildAuthResponse(user));
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/google/config", (_req, res) => {
  res.json({
    clientId: process.env.GOOGLE_CLIENT_ID || null,
    corporateUrl: process.env.CORPORATE_URL || "https://corporate.dharma-space.com"
  });
});

app.post("/api/auth/google", async (req, res, next) => {
  try {
    const { idToken } = z.object({ idToken: z.string().min(10) }).parse(req.body);
    const profile = await verifyGoogleIdToken(idToken);
    if (!profile.emailVerified) {
      return res.status(401).json({ message: "Google email is not verified" });
    }
    let user: UserWithRelations | null = await prisma.user.findUnique({
      where: { email: profile.email },
      include: USER_PROFILE_INCLUDE
    });
    if (!user) {
      user = await createUser(prisma, {
        name: profile.name,
        email: profile.email,
        passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 12),
        role: "EMPLOYEE",
        accountStatus: "PENDING",
        onboardingCompleted: false
      });
      return res.status(201).json(buildAuthResponse(user));
    }
    if (!withAuthFields(user).onboardingCompleted && user.name !== profile.name) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: profile.name },
        include: USER_PROFILE_INCLUDE
      });
    }
    respondAuth(res, buildAuthResponse(user));
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", auth, async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: USER_PROFILE_INCLUDE
    });
    if (!user) return res.status(401).json({ message: "Invalid token" });
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

const avatarUploadSchema = z.object({
  data: z.string().min(1),
  filename: z.string().min(1)
});

app.post("/api/auth/avatar", auth, async (req: AuthedRequest, res, next) => {
  try {
    const { data, filename } = avatarUploadSchema.parse(req.body);
    const buffer = Buffer.from(data, "base64");
    const url = await saveUploadedAvatarFile(req.user!.id, buffer, filename);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatar: url }
    });
    res.json({ user: sanitizeUser(user), url });
  } catch (error) {
    next(error);
  }
});

app.get("/api/courses", async (req, res, next) => {
  try {
    const { search, category } = req.query;
    const courses = await prisma.course.findMany({
      where: {
        published: true,
        ...(category && category !== "All" ? { category: String(category) } : {}),
        ...(search ? { title: { contains: String(search) } } : {})
      },
      include: { instructor: true, modules: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" }
    });
    res.json({ courses: courses.map(courseDto) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/courses/:id", async (req, res, next) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: { instructor: true, modules: { orderBy: { order: "asc" } }, sessions: true }
    });
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json({ course: courseDto(course) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/courses", auth, requireRole("TRAINER", "SUPER_ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const course = await prisma.course.create({
      data: {
        title: req.body.title,
        description: req.body.description,
        category: req.body.category,
        level: req.body.level || "Beginner",
        duration: req.body.duration || "4 weeks",
        format: req.body.format || "ONLINE",
        price: Number(req.body.price || 0),
        certificationAvailable: Boolean(req.body.certificationAvailable),
        instructorId: req.user!.id,
        image: req.body.image || "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80",
        tags: JSON.stringify(req.body.tags || []),
        learningOutcomes: JSON.stringify(req.body.learningOutcomes || []),
        published: Boolean(req.body.published ?? true)
      }
    });
    res.status(201).json({ course: courseDto(course) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/courses/:id", auth, requireRole("TRAINER", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        price: req.body.price === undefined ? undefined : Number(req.body.price),
        tags: req.body.tags ? JSON.stringify(req.body.tags) : undefined,
        learningOutcomes: req.body.learningOutcomes ? JSON.stringify(req.body.learningOutcomes) : undefined
      }
    });
    res.json({ course: courseDto(course) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/courses/:id", auth, requireRole("TRAINER", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    await prisma.course.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post("/api/enrollments", auth, async (req: AuthedRequest, res, next) => {
  try {
    const enrollment = await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: req.user!.id, courseId: req.body.courseId } },
      create: { userId: req.user!.id, courseId: req.body.courseId, progress: 0 },
      update: {}
    });
    await prisma.course.update({ where: { id: req.body.courseId }, data: { enrolledCount: { increment: 1 } } }).catch(() => null);
    res.status(201).json({ enrollment });
  } catch (error) {
    next(error);
  }
});

app.get("/api/enrollments/me", auth, async (req: AuthedRequest, res, next) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: req.user!.id },
      include: { course: { include: { instructor: true, modules: true } } }
    });
    res.json({ enrollments: enrollments.map((e) => ({ ...e, course: courseDto(e.course) })) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/enrollments/:id/progress", auth, async (req, res, next) => {
  try {
    const progress = Math.max(0, Math.min(100, Number(req.body.progress || 0)));
    const enrollment = await prisma.enrollment.update({
      where: { id: req.params.id },
      data: { progress, status: progress >= 100 ? "COMPLETED" : "ACTIVE", completedAt: progress >= 100 ? new Date() : null }
    });
    res.json({ enrollment });
  } catch (error) {
    next(error);
  }
});

app.post("/api/wellbeing/checkin", auth, async (req: AuthedRequest, res, next) => {
  try {
    const body = z.object({
      mood: z.number().min(1).max(5),
      stress: z.number().min(1).max(5),
      energy: z.number().min(1).max(5),
      sleep: z.number().min(1).max(5),
      focus: z.number().min(1).max(5),
      note: z.string().optional()
    }).parse(req.body);
    const checkin = await prisma.wellbeingCheckin.create({ data: { ...body, userId: req.user!.id } });
    res.status(201).json({
      checkin,
      recommendation: checkin.stress >= 4
        ? "Try the 6-minute nervous system reset and consider Stress Recovery content."
        : "Your pattern supports a steady learning block today. Keep the routine gentle."
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/wellbeing/me", auth, async (req: AuthedRequest, res, next) => {
  try {
    const checkins = await prisma.wellbeingCheckin.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 30
    });
    const scores = checkins.map(wellbeingScore);
    res.json({
      checkins,
      weeklyScore: scores.length ? Math.round(scores.slice(0, 7).reduce((a, b) => a + b, 0) / Math.min(scores.length, 7)) : 0,
      insight: "AI placeholder: recovery nudges are generated from recent mood, stress, sleep, focus, and course momentum."
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/wellbeing/company-aggregate", auth, requireRole("HR_ADMIN", "CORPORATE_ADMIN", "SUPER_ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const ids = req.user!.role === "SUPER_ADMIN"
      ? undefined
      : { in: await companyUserIds(req.user!) };
    const checkins = await prisma.wellbeingCheckin.findMany({ where: { userId: ids }, include: { user: { include: { department: true } } } });
    const avg = (key: "mood" | "stress" | "energy" | "sleep" | "focus") =>
      checkins.length ? Number((checkins.reduce((sum, c) => sum + c[key], 0) / checkins.length).toFixed(1)) : 0;
    const departmentMap = new Map<string, { count: number; score: number }>();
    for (const checkin of checkins) {
      const name = checkin.user.department?.name || "Unassigned";
      const current = departmentMap.get(name) || { count: 0, score: 0 };
      departmentMap.set(name, { count: current.count + 1, score: current.score + wellbeingScore(checkin) });
    }
    res.json({
      sampleSize: checkins.length,
      averages: { mood: avg("mood"), stress: avg("stress"), energy: avg("energy"), sleep: avg("sleep"), focus: avg("focus") },
      departments: [...departmentMap.entries()].map(([name, value]) => ({ name, score: Math.round(value.score / value.count), checkins: value.count })),
      note: "Aggregate and anonymized. Individual notes are intentionally excluded."
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/employee/dashboard", auth, async (req: AuthedRequest, res, next) => {
  try {
    const [enrollments, checkins, badges, certificates, sessions, courses] = await Promise.all([
      prisma.enrollment.findMany({ where: { userId: req.user!.id }, include: { course: true } }),
      prisma.wellbeingCheckin.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" }, take: 7 }),
      prisma.userBadge.findMany({ where: { userId: req.user!.id }, include: { badge: true } }),
      prisma.certificate.findMany({ where: { userId: req.user!.id }, include: { course: true } }),
      prisma.session.findMany({ where: { startTime: { gte: new Date() } }, include: { course: true }, take: 3, orderBy: { startTime: "asc" } }),
      prisma.course.findMany({ where: { published: true }, include: { instructor: true }, take: 4, orderBy: { rating: "desc" } })
    ]);
    const avgProgress = enrollments.length ? Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length) : 0;
    res.json({
      greeting: `Welcome back, ${req.user!.name.split(" ")[0]}`,
      routine: ["3-minute breath reset", "One mindful learning block", "Sleep wind-down reflection"],
      kpis: {
        completion: avgProgress,
        attendance: 92,
        streakDays: checkins.length + 8,
        wellbeingScore: checkins.length ? Math.round(checkins.reduce((sum, c) => sum + wellbeingScore(c), 0) / checkins.length) : 82,
        certificates: certificates.length
      },
      xp: [
        { name: "Wellness", value: 780 },
        { name: "Presence", value: 620 },
        { name: "Recovery", value: 540 },
        { name: "Leadership", value: 460 },
        { name: "Empathy", value: 510 },
        { name: "Focus", value: 700 },
        { name: "Facilitation", value: 390 }
      ],
      enrollments: enrollments.map((e) => ({ ...e, course: courseDto(e.course) })),
      badges: badges.map((b) => b.badge),
      certificates,
      nextSessions: sessions,
      recommended: courses.map(courseDto),
      aiRecommendation: "AI placeholder: prioritize Recovery XP this week based on sleep and stress momentum."
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/hr/dashboard", auth, requireRole("HR_ADMIN", "CORPORATE_ADMIN", "SUPER_ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    // Dharma Admin (SUPER_ADMIN) sees all companies by default, but can scope to
    // a single company via ?companyId= chosen from the platform company switcher.
    const adminCompanyId =
      req.user!.role === "SUPER_ADMIN" && typeof req.query.companyId === "string" && req.query.companyId
        ? req.query.companyId
        : null;
    let ids: { in: string[] } | undefined;
    if (req.user!.role === "SUPER_ADMIN") {
      if (adminCompanyId) {
        const scoped = await prisma.user.findMany({ where: { companyId: adminCompanyId, role: "EMPLOYEE" }, select: { id: true } });
        ids = { in: scoped.map((u) => u.id) };
      } else {
        ids = undefined;
      }
    } else {
      ids = { in: await companyUserIds(req.user!) };
    }
    const challengeWhere =
      req.user!.role === "SUPER_ADMIN"
        ? adminCompanyId
          ? { companyId: adminCompanyId }
          : {}
        : { companyId: req.user!.companyId || "" };
    const [employees, enrollments, attendance, aggregate, certificates, challenges] = await Promise.all([
      prisma.user.count({ where: { id: ids, role: "EMPLOYEE" } }),
      prisma.enrollment.findMany({ where: { userId: ids }, include: { user: { include: { department: true } } } }),
      prisma.attendance.findMany({ where: { userId: ids } }),
      prisma.wellbeingCheckin.findMany({ where: { userId: ids }, include: { user: { include: { department: true } } } }),
      prisma.certificate.count({ where: { userId: ids } }),
      prisma.challenge.findMany({ where: challengeWhere, include: { participations: true, rewardBadge: true } })
    ]);
    const activeLearners = new Set(enrollments.map((e) => e.userId)).size;
    const completion = enrollments.length ? Math.round(enrollments.reduce((s, e) => s + e.progress, 0) / enrollments.length) : 0;
    const attendanceRate = attendance.length ? Math.round((attendance.filter((a) => a.status === "ATTENDED").length / attendance.length) * 100) : 0;
    const dept = new Map<string, { employees: Set<string>; progress: number; enrollments: number }>();
    for (const e of enrollments) {
      const name = e.user.department?.name || "Unassigned";
      const row = dept.get(name) || { employees: new Set<string>(), progress: 0, enrollments: 0 };
      row.employees.add(e.userId);
      row.progress += e.progress;
      row.enrollments += 1;
      dept.set(name, row);
    }
    const wellbeing = aggregate.map(wellbeingScore);
    res.json({
      kpis: {
        totalEmployees: employees,
        activeLearners,
        completionRate: completion,
        attendanceRate,
        wellbeingAdoption: employees ? Math.round((new Set(aggregate.map((c) => c.userId)).size / employees) * 100) : 0,
        certificates
      },
      departmentEngagement: [...dept.entries()].map(([name, row]) => ({
        name,
        active: row.employees.size,
        completion: Math.round(row.progress / row.enrollments)
      })),
      wellbeingTrend: aggregate.slice(-12).map((c, index) => ({ week: `W${index + 1}`, score: wellbeingScore(c), stress: c.stress })),
      burnoutRisk: [
        { label: "Low", value: 68 },
        { label: "Watch", value: 24 },
        { label: "Support", value: 8 }
      ],
      challenges,
      roi: { productivitySignal: 14, retentionSignal: 9, certificationVelocity: certificates },
      aiRecommendation: "AI placeholder: Marketing shows high adoption but lower sleep scores; recommend a Sleep Recovery cohort."
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/hr/departments", auth, requireRole("HR_ADMIN", "CORPORATE_ADMIN", "SUPER_ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const departments = await prisma.department.findMany({ where: req.user!.role === "SUPER_ADMIN" ? {} : { companyId: req.user!.companyId || "" }, include: { users: true } });
    res.json({ departments: departments.map((d) => ({ ...d, employeeCount: d.users.length })) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/hr/analytics", auth, requireRole("HR_ADMIN", "CORPORATE_ADMIN", "SUPER_ADMIN"), (_req, res) => {
  res.json({ recommendations: ["Scale Breathwork Week to Sales", "Launch manager EI certification", "Invite low-adoption departments with opt-in messaging"] });
});

app.get("/api/hr/reports", auth, requireRole("HR_ADMIN", "CORPORATE_ADMIN", "SUPER_ADMIN"), (_req, res) => {
  res.json({ reports: ["Q2 Workforce Transformation", "Anonymous Wellbeing Adoption", "Certification ROI Snapshot"] });
});

app.get("/api/trainer/dashboard", auth, requireRole("TRAINER", "SUPER_ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const courses = await prisma.course.findMany({ where: { instructorId: req.user!.id }, include: { enrollments: true, sessions: true } });
    res.json({
      kpis: {
        courses: courses.length,
        learners: courses.reduce((sum, c) => sum + c.enrollments.length, 0),
        sessions: courses.reduce((sum, c) => sum + c.sessions.length, 0),
        revenue: courses.reduce((sum, c) => sum + c.price * c.enrollments.length, 0)
      },
      courses: courses.map(courseDto),
      feedback: [
        { course: "Breathwork for High-Performance Teams", score: 4.9, note: "Clear, grounded, executive-ready." },
        { course: "Somatic Intelligence for Leaders", score: 4.8, note: "Practical tools for tense meetings." }
      ]
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/trainer/courses", auth, requireRole("TRAINER", "SUPER_ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const courses = await prisma.course.findMany({ where: { instructorId: req.user!.id }, include: { modules: true, enrollments: true } });
    res.json({ courses: courses.map(courseDto) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/trainer/courses", auth, requireRole("TRAINER", "SUPER_ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const course = await prisma.course.create({
      data: {
        title: req.body.title,
        description: req.body.description,
        category: req.body.category,
        level: req.body.level || "Beginner",
        duration: req.body.duration || "4 weeks",
        format: req.body.format || "ONLINE",
        price: Number(req.body.price || 0),
        certificationAvailable: Boolean(req.body.certificationAvailable),
        instructorId: req.user!.id,
        image: req.body.image || "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80",
        tags: JSON.stringify(req.body.tags || []),
        learningOutcomes: JSON.stringify(req.body.learningOutcomes || []),
        published: Boolean(req.body.published ?? true)
      }
    });
    res.status(201).json({ course: courseDto(course) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/trainer/participants", auth, requireRole("TRAINER", "SUPER_ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const participants = await prisma.enrollment.findMany({
      where: { course: { instructorId: req.user!.id } },
      include: { user: true, course: true }
    });
    res.json({ participants: participants.map((p) => ({ ...p, user: sanitizeUser(p.user), course: courseDto(p.course) })) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/challenges", auth, async (req: AuthedRequest, res, next) => {
  try {
    const challenges = await prisma.challenge.findMany({
      where: req.user!.role === "SUPER_ADMIN" ? {} : { companyId: req.user!.companyId || undefined },
      include: { rewardBadge: true, participations: { include: { user: { include: { department: true } } } } }
    });
    res.json({ challenges });
  } catch (error) {
    next(error);
  }
});

app.post("/api/challenges", auth, requireRole("HR_ADMIN", "CORPORATE_ADMIN", "SUPER_ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const challenge = await prisma.challenge.create({
      data: {
        companyId: req.body.companyId || req.user!.companyId,
        title: req.body.title,
        description: req.body.description,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        rewardBadgeId: req.body.rewardBadgeId
      }
    });
    res.status(201).json({ challenge });
  } catch (error) {
    next(error);
  }
});

app.put("/api/challenges/:id", auth, requireRole("HR_ADMIN", "CORPORATE_ADMIN", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    const challenge = await prisma.challenge.update({ where: { id: req.params.id }, data: req.body });
    res.json({ challenge });
  } catch (error) {
    next(error);
  }
});

app.get("/api/certificates/me", auth, async (req: AuthedRequest, res, next) => {
  try {
    const certificates = await prisma.certificate.findMany({ where: { userId: req.user!.id }, include: { course: { include: { instructor: true } }, user: true } });
    res.json({ certificates: certificates.map((c) => ({ ...c, user: sanitizeUser(c.user), course: courseDto(c.course) })) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/certificates/issue", auth, requireRole("TRAINER", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    const certificate = await prisma.certificate.create({
      data: {
        userId: req.body.userId,
        courseId: req.body.courseId,
        certificateNumber: `HSOS-${Date.now()}`
      }
    });
    res.status(201).json({ certificate });
  } catch (error) {
    next(error);
  }
});

app.get("/api/company/dashboard", auth, requireRole("HR_ADMIN", "CORPORATE_ADMIN", "SUPER_ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.user!.companyId || "" },
      include: { users: true, invoices: true, departments: true, challenges: true }
    });
    res.json({
      company,
      seatsUsed: company?.users.length || 0,
      sso: { status: "placeholder", providers: ["SAML", "OIDC"] },
      invitations: ["people.ops@acme.example", "learning.lead@acme.example"]
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/dashboard", auth, requireRole("SUPER_ADMIN"), async (_req, res, next) => {
  try {
    const [companies, users, courses, trainers, invoices] = await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
      prisma.course.count(),
      prisma.user.count({ where: { role: "TRAINER" } }),
      prisma.invoice.findMany()
    ]);
    res.json({
      kpis: {
        companies,
        users,
        courses,
        trainers,
        revenue: invoices.reduce((sum, invoice) => sum + invoice.amount, 0)
      },
      subscriptions: [
        { plan: "Enterprise", count: 2 },
        { plan: "Scale", count: 1 },
        { plan: "Pilot", count: 0 }
      ]
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/companies", auth, requireRole("SUPER_ADMIN"), async (_req, res, next) => {
  try {
    const companies = await prisma.company.findMany({ include: { users: true, invoices: true, departments: true, challenges: true } });
    res.json({
      companies: companies.map((company) => ({
        ...company,
        userCount: company.users.length,
        departmentCount: company.departments.length,
        challengeCount: company.challenges.length,
        revenue: company.invoices.reduce((sum, invoice) => sum + invoice.amount, 0)
      }))
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/users", auth, requireRole("SUPER_ADMIN"), async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({ include: { company: true, department: true } });
    res.json({ users: users.map(sanitizeUser) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/courses", auth, requireRole("SUPER_ADMIN"), async (_req, res, next) => {
  try {
    const courses = await prisma.course.findMany({
      include: { instructor: true, modules: true, enrollments: true },
      orderBy: { createdAt: "desc" }
    });
    res.json({
      courses: courses.map((course) => ({
        ...courseDto(course),
        moduleCount: course.modules.length,
        enrollmentCount: course.enrollments.length
      }))
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/trainers", auth, requireRole("SUPER_ADMIN"), async (_req, res, next) => {
  try {
    const trainers = await prisma.user.findMany({
      where: { role: "TRAINER" },
      include: {
        company: true,
        department: true,
        courses: { include: { enrollments: true } },
        sessions: true
      }
    });
    res.json({
      trainers: trainers.map((trainer) => ({
        ...sanitizeUser(trainer),
        company: trainer.company,
        department: trainer.department,
        courseCount: trainer.courses.length,
        learnerCount: trainer.courses.reduce((sum, course) => sum + course.enrollments.length, 0),
        sessionCount: trainer.sessions.length,
        revenue: trainer.courses.reduce((sum, course) => sum + course.price * course.enrollments.length, 0)
      }))
    });
  } catch (error) {
    next(error);
  }
});

function installErrorHandler() {
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", issues: error.issues });
    if (error.code === "P2002") return res.status(409).json({ message: "Record already exists" });
    console.error(error);
    const message = error instanceof Error ? error.message : "Server error";
    const status =
      typeof error?.status === "number"
        ? error.status
        : typeof error?.statusCode === "number"
          ? error.statusCode
          : 500;
    res.status(status).json({ message });
  });
}

async function startServer() {
  const schemaReady = await ensureDatabaseSchema().catch((error) => {
    console.error("[startup] database schema:", error);
    return false;
  });
  if (!schemaReady) {
    console.warn("[startup] API starting without database tables — redeploy after this deployment succeeds.");
  }
  await applySchemaPatches().catch((error) => console.error("[startup] schema patches:", error));
  ensurePrismaClientGenerated();
  prisma = new PrismaClient();
  registerSiteContentRoutes(app, prisma, auth, requireRole);
  registerSiteBookingRoutes(app, prisma, jwtSecret, auth, requireRole("SUPER_ADMIN"));
  registerWellnessRoutes(app, prisma, auth, requireRole, companyUserIds);
  registerAdminCwpRoutes(app, prisma, auth, requireRole, sanitizeUser);
  registerOnboardingRoutes(app, prisma, auth);
  registerMessagingRoutes(app, prisma, auth);
  registerChallengeRoutes(app, prisma, auth);
  installErrorHandler();
  await ensureSiteAdmin().catch((error) => console.error("[startup] site admin:", error));
  await ensureSiteContent(prisma).catch((error) => console.error("[startup] site content:", error));
  await migrateProgramCategories(prisma).catch((error) => console.error("[startup] program migrate:", error));
  await migrateProgramScheduleFields(prisma).catch((error) => console.error("[startup] program schedule migrate:", error));
  await migrateClassScheduleFields(prisma).catch((error) => console.error("[startup] class migrate:", error));

  app.listen(port, "0.0.0.0", () => {
    logMailStatus();
    console.log(`Dharma Space API running on port ${port}`);
  });
}

startServer();
