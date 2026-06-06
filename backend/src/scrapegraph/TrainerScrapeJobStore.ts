import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { cacheTrainerMedia } from "../trainer-media-cache.js";
import {
  buildSourceList,
  crawlTrainerWebsite,
  extractTrainerFromUrl,
  fetchAllCrawlPages,
  mergeTrainerProfiles,
  pickTopGalleryUrls,
  pickTopMediaLinks,
  profilesFromCrawlPages,
  ScrapedTrainerProfile,
  SourceKind,
  waitForCrawl
} from "./ScrapeGraphTrainerService.js";

const JOB_TTL_MS = 60 * 60 * 1000;

export type TrainerScrapeJobPublic = {
  id: string;
  status: string;
  trainerId: string;
  mode: string;
  progress: { finished: number; total: number; message: string };
  preview: ScrapedTrainerProfile | null;
  sourcesTried: string[];
  warnings: string[];
  error: string | null;
  createdAt: number;
  updatedAt: number;
};

type Job = TrainerScrapeJobPublic & {
  abortController: AbortController;
  applyFields?: string[];
};

function parseJsonField<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function serializeTrainer(trainer: any) {
  return {
    ...trainer,
    galleryUrls: parseJsonField<string[]>(trainer.galleryUrls, []),
    mediaLinks: parseJsonField(trainer.mediaLinks, []),
    scrapeSources: parseJsonField(trainer.scrapeSources, {}),
    scrapeMeta: parseJsonField(trainer.scrapeMeta, {})
  };
}

export class TrainerScrapeJobStore {
  private jobs = new Map<string, Job>();

  constructor(private prisma: PrismaClient) {}

  createJob(params: {
    trainerId: string;
    websiteUrl?: string | null;
    instagramUrl?: string | null;
    linkedinUrl?: string | null;
    mode?: "extract" | "crawl";
    maxPages?: number;
    stealth?: boolean;
  }) {
    const jobId = randomUUID();
    const job: Job = {
      id: jobId,
      status: "queued",
      trainerId: params.trainerId,
      mode: params.mode || "extract",
      progress: { finished: 0, total: 0, message: "Queued…" },
      preview: null,
      sourcesTried: [],
      warnings: [],
      error: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      abortController: new AbortController()
    };

    this.jobs.set(jobId, job);
    this.runJob(job, params).catch((err) => {
      job.status = "failed";
      job.error = err instanceof Error ? err.message : String(err);
      job.updatedAt = Date.now();
      console.error(`[TrainerScrape] Job ${jobId.slice(0, 8)} failed:`, job.error);
    });

    this.cleanupOldJobs();
    return jobId;
  }

  getJob(jobId: string): TrainerScrapeJobPublic | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    return this.publicView(job);
  }

  cancelJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    job.abortController.abort();
    job.status = "cancelled";
    job.error = "Cancelled by user";
    job.updatedAt = Date.now();
    return true;
  }

  async applyJob(jobId: string, fields: string[]) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error("Scrape job not found");
    if (job.status !== "completed" || !job.preview) {
      throw new Error("Job is not ready to apply");
    }

    const trainer = await this.prisma.siteTrainer.findUnique({ where: { id: job.trainerId } });
    if (!trainer) throw new Error("Trainer not found");

    const preview = job.preview;
    const data: Record<string, unknown> = {};

    const fieldMap: Record<string, () => void> = {
      name: () => { if (preview.name) data.name = preview.name; },
      role: () => { if (preview.role) data.role = preview.role; },
      description: () => { if (preview.description) data.description = preview.description; },
      credentials: () => { if (preview.credentials) data.credentials = preview.credentials; },
      imageUrl: () => { if (preview.imageUrl) data.imageUrl = preview.imageUrl; },
      websiteUrl: () => { if (preview.websiteUrl) data.websiteUrl = preview.websiteUrl; },
      instagramUrl: () => { if (preview.instagramUrl) data.instagramUrl = preview.instagramUrl; },
      linkedinUrl: () => { if (preview.linkedinUrl) data.linkedinUrl = preview.linkedinUrl; },
      galleryUrls: () => {
        const picked = pickTopGalleryUrls(preview.galleryUrls, preview.imageUrl, 6);
        if (picked.length) data.galleryUrls = JSON.stringify(picked);
      },
      mediaLinks: () => {
        const picked = pickTopMediaLinks(preview.mediaLinks, 3);
        if (picked.length) data.mediaLinks = JSON.stringify(picked);
      }
    };

    for (const field of fields) {
      fieldMap[field]?.();
    }

    const cacheInput: {
      imageUrl?: string | null;
      galleryUrls?: string[];
      mediaLinks?: Array<{ type: string; url: string; caption?: string; thumbnailUrl?: string }>;
    } = {};

    if (typeof data.imageUrl === "string") cacheInput.imageUrl = data.imageUrl;
    if (typeof data.galleryUrls === "string") {
      try {
        cacheInput.galleryUrls = JSON.parse(data.galleryUrls);
      } catch {
        cacheInput.galleryUrls = [];
      }
    }
    if (typeof data.mediaLinks === "string") {
      try {
        cacheInput.mediaLinks = JSON.parse(data.mediaLinks);
      } catch {
        cacheInput.mediaLinks = [];
      }
    }

    if (cacheInput.imageUrl || cacheInput.galleryUrls?.length || cacheInput.mediaLinks?.length) {
      job.progress.message = "Caching images locally…";
      const cached = await cacheTrainerMedia(job.trainerId, cacheInput);
      if (cached.imageUrl) data.imageUrl = cached.imageUrl;
      if (cached.galleryUrls) data.galleryUrls = JSON.stringify(cached.galleryUrls);
      if (cached.mediaLinks) data.mediaLinks = JSON.stringify(cached.mediaLinks);
    }

    data.scrapeSources = JSON.stringify({
      websiteUrl: preview.websiteUrl || null,
      instagramUrl: preview.instagramUrl || null,
      linkedinUrl: preview.linkedinUrl || null,
      sourcesTried: job.sourcesTried
    });

    data.scrapeMeta = JSON.stringify({
      lastScrapedAt: new Date().toISOString(),
      jobId: job.id,
      mode: job.mode,
      warnings: job.warnings
    });

    const updated = await this.prisma.siteTrainer.update({
      where: { id: job.trainerId },
      data
    });

    return serializeTrainer(updated);
  }

  private publicView(job: Job): TrainerScrapeJobPublic {
    const preview = job.preview
      ? JSON.parse(JSON.stringify(job.preview, (_k, v) =>
          typeof v === "string" ? v.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ").replace(/\s+/g, " ").trim() : v
        ))
      : null;
    return {
      id: job.id,
      status: job.status,
      trainerId: job.trainerId,
      mode: job.mode,
      progress: job.progress,
      preview,
      sourcesTried: job.sourcesTried,
      warnings: job.warnings,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    };
  }

  private async runJob(
    job: Job,
    params: {
      trainerId: string;
      websiteUrl?: string | null;
      instagramUrl?: string | null;
      linkedinUrl?: string | null;
      mode?: "extract" | "crawl";
      maxPages?: number;
      stealth?: boolean;
    }
  ) {
    job.status = "running";
    job.progress.message = "Connecting to ScrapeGraphAI…";
    job.updatedAt = Date.now();

    const signal = job.abortController.signal;
    const stealth = params.stealth !== false;

    const trainer = await this.prisma.siteTrainer.findUnique({ where: { id: params.trainerId } });
    if (!trainer) throw new Error("Trainer not found");

    const sources = buildSourceList({
      websiteUrl: params.websiteUrl ?? trainer.websiteUrl,
      instagramUrl: params.instagramUrl ?? trainer.instagramUrl,
      linkedinUrl: params.linkedinUrl ?? trainer.linkedinUrl
    });

    if (!sources.length) {
      throw new Error("Add at least one source URL: website, Instagram, or LinkedIn");
    }

    job.progress.total = sources.length;
    const collected: ScrapedTrainerProfile[] = [];

    for (let i = 0; i < sources.length; i++) {
      if (signal.aborted) throw new Error("Scrape cancelled");

      const { kind, url } = sources[i];
      job.progress.finished = i;
      job.progress.message = `Extracting from ${kind}…`;
      job.updatedAt = Date.now();

      try {
        if (kind === "website" && params.mode === "crawl") {
          job.progress.message = `Crawling website…`;
          const { crawlId, total } = await crawlTrainerWebsite(url, {
            maxPages: params.maxPages ?? 5,
            stealth
          });
          job.progress.total = Math.max(job.progress.total, total);

          await waitForCrawl(crawlId, {
            signal,
            onProgress: (p) => {
              job.progress.message = `Crawling website (${p.finished}/${p.total})…`;
              job.updatedAt = Date.now();
            }
          });

          const pages = await fetchAllCrawlPages(crawlId);
          const fromPages = profilesFromCrawlPages(pages, url);
          if (fromPages.length) {
            collected.push(mergeTrainerProfiles(fromPages));
          } else {
            job.warnings.push(`Website crawl returned no trainer data from ${url}`);
          }
        } else {
          const profile = await extractTrainerFromUrl(url, kind as SourceKind, { stealth });
          collected.push(profile);
        }
        job.sourcesTried.push(`${kind}:${url}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        job.warnings.push(`${kind} failed: ${msg}`);
      }
    }

    job.progress.finished = sources.length;
    job.progress.message = "Merging results…";
    job.updatedAt = Date.now();

    const merged = mergeTrainerProfiles(collected);
    if (!merged.name && !merged.description && !merged.imageUrl) {
      throw new Error(
        job.warnings.length
          ? `Could not extract trainer data. ${job.warnings.join(" ")}`
          : "Could not extract trainer data from any source"
      );
    }

    job.preview = merged;
    job.warnings.push(...(merged.warnings || []));
    job.status = "completed";
    job.progress.message = "Done";
    job.updatedAt = Date.now();
  }

  private cleanupOldJobs() {
    const cutoff = Date.now() - JOB_TTL_MS;
    for (const [id, job] of this.jobs) {
      if (job.createdAt < cutoff) this.jobs.delete(id);
    }
  }
}

let sharedStore: TrainerScrapeJobStore | null = null;

export function getTrainerScrapeJobStore(prisma: PrismaClient) {
  if (!sharedStore) sharedStore = new TrainerScrapeJobStore(prisma);
  return sharedStore;
}
