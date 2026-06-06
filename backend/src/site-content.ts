import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { getTrainerScrapeJobStore, serializeTrainer } from "./scrapegraph/TrainerScrapeJobStore.js";
import {
  groupProgramsByCategory,
  normalizeProgramCategory,
  parseJsonArray,
  PROGRAM_CATEGORIES,
  serializeProgram
} from "./education.js";
import {
  migrateClassScheduleFields,
  normalizeClassSchedule,
  serializeClass,
  sortClasses
} from "./class-schedule.js";
import { addClassSchedulePreset, readClassSchedulePresets } from "./class-schedule-presets.js";
import { migrateProgramScheduleFields, normalizeProgramSchedule } from "./program-schedule.js";
import { applyClassStripeRules, applyProgramStripeRules } from "./stripe-schedule.js";
import { getProgramBookingStats, normalizeProgramPrice } from "./program-bookings.js";
import { saveUploadedProgramFile } from "./program-media-cache.js";
import { buildSourceList } from "./scrapegraph/ScrapeGraphTrainerService.js";
import {
  displayTrainerMedia,
  recacheTrainerMediaFromDb,
  saveUploadedTrainerFile,
  trainerHasExternalMedia
} from "./trainer-media-cache.js";

const jsonStringArray = z.union([z.array(z.string()), z.string()]).optional().transform((v) => {
  if (v == null) return undefined;
  if (Array.isArray(v)) return JSON.stringify(v);
  return v;
});

const trainerSchema = z.object({
  name: z.string().min(2),
  role: z.string().min(2),
  description: z.string().optional().or(z.literal("")).transform((v) => v || ""),
  credentials: z.string().optional().or(z.literal("")).transform((v) => v || ""),
  imageUrl: z.string().optional().or(z.literal("")).transform((v) => v || ""),
  websiteUrl: z.string().optional().nullable().or(z.literal("")).transform((v) => v || null),
  instagramUrl: z.string().optional().nullable().or(z.literal("")).transform((v) => v || null),
  linkedinUrl: z.string().optional().nullable().or(z.literal("")).transform((v) => v || null),
  galleryUrls: jsonStringArray,
  mediaLinks: z.union([
    z.array(z.object({
      type: z.string(),
      url: z.string(),
      caption: z.string().optional(),
      thumbnailUrl: z.string().optional()
    })),
    z.string()
  ]).optional().transform((v) => {
    if (v == null) return undefined;
    if (Array.isArray(v)) return JSON.stringify(v);
    return v;
  }),
  published: z.boolean().optional(),
  sortOrder: z.number().int().optional()
});

const trainerUploadSchema = z.object({
  data: z.string().min(1),
  filename: z.string().min(1),
  field: z.enum(["profile", "gallery"])
});

const programSchema = z.object({
  category: z.enum(PROGRAM_CATEGORIES),
  title: z.string().min(2),
  description: z.string().optional(),
  comingSoon: z.boolean().optional(),
  scheduledDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional(),
  startMinutes: z.number().int().min(0).max(24 * 60 - 1).optional(),
  dates: z.string().optional(),
  duration: z.string().optional(),
  time: z.string().optional(),
  location: z.string().optional(),
  facilitator: z.string().optional(),
  price: z.string().optional(),
  certificationLabel: z.string().optional(),
  classSize: z.string().optional(),
  curriculumItems: z.union([z.array(z.string()), z.string()]).optional().transform((v) => {
    if (v == null || v === "") return undefined;
    if (Array.isArray(v)) return JSON.stringify(v);
    const lines = String(v).split("\n").map((s) => s.trim()).filter(Boolean);
    return JSON.stringify(lines);
  }),
  badgeTitle: z.string().optional(),
  badgeSubtitle: z.string().optional(),
  imageUrl: z.string().optional(),
  stripeLink: z.string().optional().nullable(),
  usePayNow: z.boolean().optional(),
  code: z.string().optional().nullable(),
  depositAmount: z.string().optional().nullable(),
  singlePerson: z.boolean().optional(),
  published: z.boolean().optional(),
  sortOrder: z.number().int().optional()
});

const classBodySchema = z.object({
  classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  day: z.string().min(2).optional(),
  dayIndex: z.number().int().min(0).max(6).optional(),
  time: z.string().min(2).optional(),
  startMinutes: z.number().int().min(0).max(24 * 60 - 1).optional(),
  durationMinutes: z.number().int().min(30).max(480).optional(),
  classType: z.string().min(2),
  instructor: z.string().min(2),
  level: z.string().min(2),
  location: z.string().min(2),
  price: z.string().optional(),
  stripeLink: z.string().optional().nullable(),
  published: z.boolean().optional(),
  comingSoon: z.boolean().optional(),
  sortOrder: z.number().int().optional()
});

const classMoveSchema = z.object({
  classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dayIndex: z.number().int().min(0).max(6),
  startMinutes: z.number().int().min(0).max(24 * 60 - 1),
  durationMinutes: z.number().int().min(30).max(480).optional()
});

const classPresetSchema = z.object({
  kind: z.enum(["classType", "location"]),
  value: z.string().min(1)
});

const programUploadSchema = z.object({
  data: z.string().min(1),
  filename: z.string().min(1)
});

function parseClassBody(body: unknown, partial = false) {
  const parsed = partial ? classBodySchema.partial().parse(body) : classBodySchema.parse(body);
  const normalized = normalizeClassSchedule(parsed);
  if (!partial && !normalized.classDate && normalized.dayIndex == null) throw new Error("classDate is required");
  if (!partial && normalized.startMinutes == null) throw new Error("time or startMinutes is required");
  return applyClassStripeRules(normalized);
}

function parseProgramBody(body: unknown, partial = false) {
  const parsed = partial ? programSchema.partial().parse(body) : programSchema.parse(body);
  const normalized = normalizeProgramSchedule(parsed) as Record<string, unknown>;
  if (parsed.price != null) normalized.price = normalizeProgramPrice(String(parsed.price));
  return applyProgramStripeRules(normalized as { comingSoon?: boolean; usePayNow?: boolean; stripeLink?: string | null });
}

async function serializeProgramWithStats(prisma: PrismaClient, program: any) {
  const base = serializeProgram(program);
  const stats = await getProgramBookingStats(prisma, base);
  return { ...base, ...stats };
}

const optionalUrl = z.union([z.string(), z.null()]).optional().transform((v) => {
  if (v == null) return null;
  const trimmed = String(v).trim();
  return trimmed || null;
});

const scrapeStartSchema = z.object({
  websiteUrl: optionalUrl,
  instagramUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  mode: z.enum(["extract", "crawl"]).optional(),
  maxPages: z.number().int().min(1).max(15).optional(),
  stealth: z.boolean().optional()
});

const scrapeApplySchema = z.object({
  fields: z.array(z.enum([
    "name", "role", "description", "credentials", "imageUrl",
    "websiteUrl", "instagramUrl", "linkedinUrl", "galleryUrls", "mediaLinks"
  ])).min(1)
});

export async function migrateProgramCategories(prisma: PrismaClient) {
  const rows = await prisma.siteProgram.findMany();
  for (const row of rows) {
    const next = normalizeProgramCategory(row.category);
    if (next !== row.category) {
      await prisma.siteProgram.update({ where: { id: row.id }, data: { category: next } });
    }
  }
}

export async function getPublicSiteContent(prisma: PrismaClient) {
  const [trainers, classes, programs] = await Promise.all([
    prisma.siteTrainer.findMany({ where: { published: true }, orderBy: { sortOrder: "asc" } }),
    prisma.siteClass.findMany({ where: { published: true }, orderBy: [{ dayIndex: "asc" }, { startMinutes: "asc" }] }),
    prisma.siteProgram.findMany({ where: { published: true }, orderBy: { sortOrder: "asc" } })
  ]);
  const enrichedPrograms = await Promise.all(programs.map((program) => serializeProgramWithStats(prisma, program)));
  return {
    trainers: trainers.map(serializeTrainer),
    classes: sortClasses(classes.map(serializeClass)),
    programs: groupProgramsByCategory(enrichedPrograms)
  };
}

export async function getAdminSiteOverview(prisma: PrismaClient) {
  const [trainers, classes, programs, inquiries, newInquiries] = await Promise.all([
    prisma.siteTrainer.count(),
    prisma.siteClass.count(),
    prisma.siteProgram.count(),
    prisma.formSubmission.count(),
    prisma.formSubmission.count({ where: { status: "NEW" } })
  ]);
  return {
    trainers,
    classes,
    programs,
    inquiries,
    newInquiries,
    byCategory: {
      flagship: await prisma.siteProgram.count({ where: { category: { in: ["FLAGSHIP", "YTT"] } } }),
      certifications: await prisma.siteProgram.count({ where: { category: { in: ["CERTIFICATION", "COURSE"] } } }),
      workshops: await prisma.siteProgram.count({ where: { category: "WORKSHOP" } }),
      events: await prisma.siteProgram.count({ where: { category: "EVENT" } })
    }
  };
}

export function registerSiteContentRoutes(app: import("express").Express, prisma: PrismaClient, auth: any, requireRole: any) {
  const scrapeStore = getTrainerScrapeJobStore(prisma);

  app.get("/api/site/content", async (_req, res, next) => {
    try {
      res.json(await getPublicSiteContent(prisma));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/site/education", async (_req, res, next) => {
    try {
      const programs = await prisma.siteProgram.findMany({
        where: {
          published: true,
          category: { in: ["FLAGSHIP", "YTT", "CERTIFICATION", "COURSE", "WORKSHOP"] }
        },
        orderBy: { sortOrder: "asc" }
      });
      const enriched = await Promise.all(programs.map((program) => serializeProgramWithStats(prisma, program)));
      res.json(groupProgramsByCategory(enriched));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/site/overview", auth, requireRole("SUPER_ADMIN"), async (_req, res, next) => {
    try {
      res.json(await getAdminSiteOverview(prisma));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/site/trainers/scrape/:jobId", auth, requireRole("SUPER_ADMIN"), (req, res) => {
    const job = scrapeStore.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ message: "Scrape job not found" });
    if (job.preview) {
      const proxied = displayTrainerMedia({
        id: job.trainerId,
        imageUrl: job.preview.imageUrl || undefined,
        galleryUrls: job.preview.galleryUrls,
        mediaLinks: job.preview.mediaLinks
      });
      job.preview = { ...job.preview, ...proxied };
    }
    res.json(job);
  });

  app.post("/api/admin/site/trainers/scrape/:jobId/apply", auth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
    try {
      const { fields } = scrapeApplySchema.parse(req.body);
      const trainer = await scrapeStore.applyJob(req.params.jobId, fields);
      res.json({ trainer: displayTrainerMedia(serializeTrainer(trainer)) });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/site/trainers/scrape/:jobId", auth, requireRole("SUPER_ADMIN"), (req, res) => {
    const ok = scrapeStore.cancelJob(req.params.jobId);
    if (!ok) return res.status(404).json({ message: "Scrape job not found" });
    res.json({ success: true, status: "cancelled" });
  });

  app.post("/api/admin/site/trainers/:id/scrape", auth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
    try {
      const trainer = await prisma.siteTrainer.findUnique({ where: { id: req.params.id } });
      if (!trainer) return res.status(404).json({ message: "Trainer not found" });
      const body = scrapeStartSchema.parse(req.body);
      const websiteUrl = body.websiteUrl ?? trainer.websiteUrl;
      const instagramUrl = body.instagramUrl ?? trainer.instagramUrl;
      const linkedinUrl = body.linkedinUrl ?? trainer.linkedinUrl;
      const sources = buildSourceList({ websiteUrl, instagramUrl, linkedinUrl });
      if (!sources.length) {
        return res.status(400).json({
          message: "Add a Website, Instagram (e.g. https://www.instagram.com/dharma_space_sg/), or LinkedIn URL first."
        });
      }
      const jobId = scrapeStore.createJob({
        trainerId: trainer.id,
        websiteUrl,
        instagramUrl,
        linkedinUrl,
        mode: body.mode,
        maxPages: body.maxPages,
        stealth: body.stealth
      });
      res.status(202).json({ jobId, status: "queued", sources: sources.map((s) => s.kind) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/site/trainers/:id/recache-media", auth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
    try {
      const updated = await recacheTrainerMediaFromDb(prisma, req.params.id);
      res.json({ trainer: displayTrainerMedia(serializeTrainer(updated)) });
    } catch (error) {
      next(error);
    }
  });

  app.post(
    "/api/admin/site/trainers/:id/upload-image",
    auth,
    requireRole("SUPER_ADMIN"),
    async (req, res, next) => {
      try {
        const { data, filename, field } = trainerUploadSchema.parse(req.body);
        const trainer = await prisma.siteTrainer.findUnique({ where: { id: req.params.id } });
        if (!trainer) return res.status(404).json({ message: "Trainer not found" });

        const buffer = Buffer.from(data, "base64");
        const url = await saveUploadedTrainerFile(req.params.id, buffer, filename);

        const updateData: Record<string, string> = {};
        if (field === "profile") {
          updateData.imageUrl = url;
        } else {
          let gallery: string[] = [];
          try {
            gallery = JSON.parse(trainer.galleryUrls || "[]");
          } catch {
            gallery = [];
          }
          gallery.push(url);
          updateData.galleryUrls = JSON.stringify(gallery.slice(-12));
        }

        const updated = await prisma.siteTrainer.update({
          where: { id: req.params.id },
          data: updateData
        });

        res.json({ url, trainer: displayTrainerMedia(serializeTrainer(updated)) });
      } catch (error) {
        next(error);
      }
    }
  );

  app.get("/api/admin/site/trainers", auth, requireRole("SUPER_ADMIN"), async (_req, res, next) => {
    try {
      const trainers = await prisma.siteTrainer.findMany({ orderBy: { sortOrder: "asc" } });
      for (const trainer of trainers) {
        if (trainerHasExternalMedia(trainer)) {
          recacheTrainerMediaFromDb(prisma, trainer.id).catch((err) => {
            console.warn(`[media-cache] ${trainer.name}:`, err instanceof Error ? err.message : err);
          });
        }
      }
      res.json({
        trainers: trainers.map((t) => displayTrainerMedia(serializeTrainer(t)))
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/site/trainers", auth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
    try {
      const body = trainerSchema.parse(req.body);
      const trainer = await prisma.siteTrainer.create({ data: body });
      res.status(201).json({ trainer: displayTrainerMedia(serializeTrainer(trainer)) });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin/site/trainers/:id", auth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
    try {
      const body = trainerSchema.partial().parse(req.body);
      const trainer = await prisma.siteTrainer.update({ where: { id: req.params.id }, data: body });
      res.json({ trainer: displayTrainerMedia(serializeTrainer(trainer)) });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/site/trainers/:id", auth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
    try {
      await prisma.siteTrainer.delete({ where: { id: req.params.id } });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/site/classes/presets", auth, requireRole("SUPER_ADMIN"), async (_req, res, next) => {
    try {
      res.json(await readClassSchedulePresets());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/site/classes/presets", auth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
    try {
      const body = classPresetSchema.parse(req.body);
      res.json(await addClassSchedulePreset(body.kind, body.value));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/site/classes", auth, requireRole("SUPER_ADMIN"), async (_req, res, next) => {
    try {
      const classes = await prisma.siteClass.findMany({ orderBy: [{ dayIndex: "asc" }, { startMinutes: "asc" }] });
      res.json({ classes: sortClasses(classes.map(serializeClass)) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/site/classes", auth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
    try {
      const body = parseClassBody(req.body);
      const siteClass = await prisma.siteClass.create({ data: body as any });
      res.status(201).json({ class: serializeClass(siteClass) });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin/site/classes/:id", auth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
    try {
      const body = parseClassBody(req.body, true);
      const siteClass = await prisma.siteClass.update({ where: { id: req.params.id }, data: body as any });
      res.json({ class: serializeClass(siteClass) });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/site/classes/:id/move", auth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
    try {
      const body = normalizeClassSchedule(classMoveSchema.parse(req.body));
      const siteClass = await prisma.siteClass.update({
        where: { id: req.params.id },
        data: {
          ...(body.classDate ? { classDate: body.classDate } : {}),
          dayIndex: body.dayIndex!,
          day: body.day!,
          startMinutes: body.startMinutes!,
          time: body.time!,
          ...(body.durationMinutes != null ? { durationMinutes: body.durationMinutes } : {})
        }
      });
      res.json({ class: serializeClass(siteClass) });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/site/classes/:id", auth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
    try {
      await prisma.siteClass.delete({ where: { id: req.params.id } });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/site/programs", auth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
    try {
      const category = req.query.category ? String(req.query.category).toUpperCase() : undefined;
      const programs = await prisma.siteProgram.findMany({
        where: category ? { category: { in: category === "FLAGSHIP" ? ["FLAGSHIP", "YTT"] : category === "CERTIFICATION" ? ["CERTIFICATION", "COURSE"] : [category] } } : undefined,
        orderBy: { sortOrder: "asc" }
      });
      const enriched = await Promise.all(programs.map((program) => serializeProgramWithStats(prisma, program)));
      res.json({ programs: enriched });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/site/programs/:id/upload-image", auth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
    try {
      const { data, filename } = programUploadSchema.parse(req.body);
      const program = await prisma.siteProgram.findUnique({ where: { id: req.params.id } });
      if (!program) return res.status(404).json({ message: "Program not found" });

      const buffer = Buffer.from(data, "base64");
      const url = await saveUploadedProgramFile(program.id, buffer, filename);
      const updated = await prisma.siteProgram.update({
        where: { id: program.id },
        data: { imageUrl: url }
      });
      res.json({ url, program: await serializeProgramWithStats(prisma, updated) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/site/programs/upload-image", auth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
    try {
      const { data, filename } = programUploadSchema.parse(req.body);
      const buffer = Buffer.from(data, "base64");
      const url = await saveUploadedProgramFile("uploads", buffer, filename);
      res.json({ url });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/site/programs", auth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
    try {
      const body = parseProgramBody(req.body);
      const program = await prisma.siteProgram.create({ data: body as any });
      res.status(201).json({ program: await serializeProgramWithStats(prisma, program) });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin/site/programs/:id", auth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
    try {
      const existing = await prisma.siteProgram.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        res.status(404).json({ message: "Program not found" });
        return;
      }
      const body = parseProgramBody({ ...serializeProgram(existing), ...req.body });
      const program = await prisma.siteProgram.update({ where: { id: req.params.id }, data: body as any });
      res.json({ program: await serializeProgramWithStats(prisma, program) });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/site/programs/:id", auth, requireRole("SUPER_ADMIN"), async (req, res, next) => {
    try {
      await prisma.siteProgram.delete({ where: { id: req.params.id } });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });
}

export { parseJsonArray, serializeProgram, PROGRAM_CATEGORIES };
