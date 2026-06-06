/**
 * ScrapeGraphAI trainer profile extraction (v2 REST API).
 * Pattern mirrors Hyperspace ScrapeGraphCatalogService.js
 */

const SGAI_API_BASE = process.env.SGAI_API_URL || "https://v2-api.scrapegraphai.com/api";

export const TRAINER_PROFILE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Full name of the trainer or practitioner" },
    role: { type: "string", description: "Job title, specialty, or headline e.g. Hatha Yoga Instructor" },
    bio: { type: "string", description: "About / biography text" },
    credentials: { type: "string", description: "Certifications and qualifications as one string" },
    certifications: {
      type: "array",
      items: { type: "string" },
      description: "List of certification names"
    },
    profile_image_url: { type: "string", description: "Absolute URL to main profile photo" },
    gallery_image_urls: {
      type: "array",
      items: { type: "string" },
      description: "Additional photo URLs from the page"
    },
    social_links: {
      type: "object",
      properties: {
        instagram: { type: "string" },
        linkedin: { type: "string" },
        website: { type: "string" },
        youtube: { type: "string" },
        tiktok: { type: "string" }
      }
    },
    featured_media: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", description: "reel, video, or post" },
          url: { type: "string" },
          caption: { type: "string" },
          thumbnail_url: { type: "string" }
        }
      }
    },
    location: { type: "string" },
    specialties: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;

const EXTRACT_PROMPT = `Extract this wellness, yoga, or fitness trainer's public profile information.
Include: full name, role/title, bio/about text, certifications and credentials,
profile photo URL, any additional gallery image URLs, social media links (Instagram, LinkedIn, website, YouTube),
and featured media (reels, videos, posts) with URLs and captions if visible.
Use absolute URLs for all images and links. Skip ads and unrelated site content.`;

const INSTAGRAM_EXTRACT_PROMPT = `Extract this Instagram profile's public information for a wellness/yoga business or trainer.
Include: display name, username, bio text, profile photo URL (full-size if available),
the 3 most meaningful recent reels (with thumbnail URLs and post URLs), up to 6 recent post/reel thumbnail URLs for a gallery,
and any website link in the bio. Prioritize reels and high-engagement posts over generic grid tiles.
Use absolute https URLs for all images and links. Ignore suggested accounts and ads.`;

const EMPTY_SENTINELS = new Set(["", "no content available", "n/a", "na", "none", "null", "undefined"]);

export type ScrapedTrainerProfile = {
  name?: string | null;
  role?: string | null;
  description?: string | null;
  credentials?: string | null;
  imageUrl?: string | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  galleryUrls?: string[];
  mediaLinks?: Array<{ type: string; url: string; caption?: string; thumbnailUrl?: string }>;
  location?: string | null;
  specialties?: string[];
  warnings?: string[];
};

export type SourceKind = "website" | "instagram" | "linkedin";

type TrainerMediaLink = NonNullable<ScrapedTrainerProfile["mediaLinks"]>[number];

function mediaLinkScore(type: string | undefined): number {
  const t = (type || "").toLowerCase();
  if (t.includes("reel")) return 3;
  if (t.includes("video")) return 2;
  if (t.includes("post")) return 1;
  return 0;
}

/** Keep the most meaningful reels/videos/posts (default top 3). */
export function pickTopMediaLinks(links: TrainerMediaLink[] | undefined, limit = 3): TrainerMediaLink[] {
  if (!links?.length) return [];
  return [...links]
    .sort((a, b) => {
      const scoreDiff = mediaLinkScore(b.type) - mediaLinkScore(a.type);
      if (scoreDiff !== 0) return scoreDiff;
      if (a.thumbnailUrl && !b.thumbnailUrl) return -1;
      if (b.thumbnailUrl && !a.thumbnailUrl) return 1;
      return 0;
    })
    .slice(0, limit);
}

/** Gallery images excluding the profile photo duplicate (default top 6). */
export function pickTopGalleryUrls(
  urls: string[] | undefined,
  profileUrl?: string | null,
  limit = 6
): string[] {
  if (!urls?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    if (!url?.startsWith("http")) continue;
    if (profileUrl && url === profileUrl) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= limit) break;
  }
  return out;
}

function getApiKey() {
  const key = process.env.SGAI_API_KEY;
  if (!key) {
    throw new Error(
      "SGAI_API_KEY is not configured. Sign up free at https://scrapegraphai.com and add the key to backend/.env"
    );
  }
  return key;
}

async function sgaiFetch(path: string, options: RequestInit = {}) {
  const url = `${SGAI_API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "SGAI-APIKEY": getApiKey(),
      ...(options.headers as Record<string, string>)
    }
  });

  const text = await res.text();
  let body: any;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    const msg = body?.error || body?.message || body?.detail || res.statusText;
    throw new Error(`ScrapeGraphAI ${path} failed (${res.status}): ${msg}`);
  }

  return body;
}

function defaultFetchConfig(
  options: { stealth?: boolean; renderMode?: string; scrolls?: number; wait?: number; timeout?: number } = {}
) {
  return {
    mode: options.renderMode || "js",
    stealth: options.stealth !== false,
    scrolls: options.scrolls ?? 5,
    wait: options.wait ?? 3000,
    timeout: Math.min(options.timeout ?? 60000, 60000)
  };
}

function fetchConfigForSource(kind: SourceKind, options: { stealth?: boolean } = {}) {
  if (kind === "instagram") {
    return defaultFetchConfig({ stealth: options.stealth, scrolls: 8, wait: 5000, timeout: 60000 });
  }
  if (kind === "linkedin") {
    return defaultFetchConfig({ stealth: options.stealth, scrolls: 6, wait: 4000, timeout: 60000 });
  }
  return defaultFetchConfig(options);
}

export function isEmptyScrapedValue(value: unknown) {
  if (value == null) return true;
  const s = String(value).trim().toLowerCase();
  return EMPTY_SENTINELS.has(s);
}

export function cleanScraped(value: unknown): string | null {
  if (isEmptyScrapedValue(value)) return null;
  return String(value)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeInstagramUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (raw.startsWith("http")) {
    try {
      const u = new URL(raw);
      if (u.hostname.includes("instagram.com")) return u.href.split("?")[0].replace(/\/$/, "");
    } catch {
      return null;
    }
  }
  const handle = raw.replace(/^@/, "").replace(/^\//, "");
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(handle)) return null;
  return `https://www.instagram.com/${handle}`;
}

export function normalizeLinkedInUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (!raw.startsWith("http")) {
    if (raw.includes("linkedin.com")) return `https://${raw.replace(/^\/+/, "")}`;
    return null;
  }
  try {
    const u = new URL(raw);
    if (!u.hostname.includes("linkedin.com")) return null;
    return u.href.split("?")[0].replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function normalizeWebsiteUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    return u.href;
  } catch {
    return null;
  }
}

function parsePayloadJson(body: any) {
  const json = body?.json ?? body?.data?.json ?? body;
  if (typeof json === "string") {
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
  return json;
}

export function normalizeTrainerPayload(raw: any, sourceUrl: string, sourceKind: SourceKind): ScrapedTrainerProfile {
  if (!raw || typeof raw !== "object") {
    return { warnings: [`No structured data from ${sourceKind}`] };
  }

  const certs = Array.isArray(raw.certifications)
    ? raw.certifications.map((c: unknown) => cleanScraped(c)).filter(Boolean) as string[]
    : [];

  const credentials =
    cleanScraped(raw.credentials) ||
    (certs.length ? certs.join(" · ") : null);

  const gallery = (Array.isArray(raw.gallery_image_urls) ? raw.gallery_image_urls : [])
    .map((u: unknown) => cleanScraped(u))
    .filter((u: string | null): u is string => !!u && u.startsWith("http"));

  const profileImage = cleanScraped(raw.profile_image_url);
  const social = raw.social_links && typeof raw.social_links === "object" ? raw.social_links : {};

  const mediaLinks = (Array.isArray(raw.featured_media) ? raw.featured_media : [])
    .map((m: any) => {
      const url = cleanScraped(m?.url);
      if (!url || !url.startsWith("http")) return null;
      return {
        type: cleanScraped(m?.type) || "post",
        url,
        caption: cleanScraped(m?.caption) || undefined,
        thumbnailUrl: cleanScraped(m?.thumbnail_url) || undefined
      };
    })
    .filter(Boolean) as ScrapedTrainerProfile["mediaLinks"];

  const specialties = (Array.isArray(raw.specialties) ? raw.specialties : [])
    .map((s: unknown) => cleanScraped(s))
    .filter(Boolean) as string[];

  const role = cleanScraped(raw.role) || specialties[0] || null;

  return {
    name: cleanScraped(raw.name),
    role,
    description: cleanScraped(raw.bio),
    credentials,
    imageUrl: profileImage && profileImage.startsWith("http") ? profileImage : null,
    websiteUrl: normalizeWebsiteUrl(cleanScraped(social.website) || "") || (sourceKind === "website" ? sourceUrl : null),
    instagramUrl: normalizeInstagramUrl(cleanScraped(social.instagram) || "") || (sourceKind === "instagram" ? sourceUrl : null),
    linkedinUrl: normalizeLinkedInUrl(cleanScraped(social.linkedin) || "") || (sourceKind === "linkedin" ? sourceUrl : null),
    galleryUrls: gallery,
    mediaLinks,
    location: cleanScraped(raw.location),
    specialties,
    warnings: []
  };
}

export function mergeTrainerProfiles(profiles: ScrapedTrainerProfile[]): ScrapedTrainerProfile {
  const merged: ScrapedTrainerProfile = {
    galleryUrls: [],
    mediaLinks: [],
    specialties: [],
    warnings: []
  };

  const gallerySet = new Set<string>();
  const mediaKeys = new Set<string>();

  for (const p of profiles) {
    if (!p) continue;
    if (p.name && !merged.name) merged.name = p.name;
    if (p.role && !merged.role) merged.role = p.role;
    if (p.description && !merged.description) merged.description = p.description;
    if (p.credentials && !merged.credentials) merged.credentials = p.credentials;
    if (p.imageUrl && !merged.imageUrl) merged.imageUrl = p.imageUrl;
    if (p.websiteUrl && !merged.websiteUrl) merged.websiteUrl = p.websiteUrl;
    if (p.instagramUrl && !merged.instagramUrl) merged.instagramUrl = p.instagramUrl;
    if (p.linkedinUrl && !merged.linkedinUrl) merged.linkedinUrl = p.linkedinUrl;
    if (p.location && !merged.location) merged.location = p.location;

    for (const g of p.galleryUrls || []) {
      if (!gallerySet.has(g)) {
        gallerySet.add(g);
        merged.galleryUrls!.push(g);
      }
    }
    for (const m of p.mediaLinks || []) {
      const key = m.url;
      if (!mediaKeys.has(key)) {
        mediaKeys.add(key);
        merged.mediaLinks!.push(m);
      }
    }
    for (const s of p.specialties || []) {
      if (!merged.specialties!.includes(s)) merged.specialties!.push(s);
    }
    merged.warnings!.push(...(p.warnings || []));
  }

  merged.galleryUrls = pickTopGalleryUrls(merged.galleryUrls, merged.imageUrl, 6);
  merged.mediaLinks = pickTopMediaLinks(merged.mediaLinks, 3);

  return merged;
}

export async function extractTrainerFromUrl(
  url: string,
  sourceKind: SourceKind,
  options: { stealth?: boolean; renderMode?: string; prompt?: string } = {}
) {
  const prompt =
    options.prompt ||
    (sourceKind === "instagram" ? INSTAGRAM_EXTRACT_PROMPT : EXTRACT_PROMPT);

  const body = await sgaiFetch("/extract", {
    method: "POST",
    body: JSON.stringify({
      url,
      prompt,
      schema: TRAINER_PROFILE_SCHEMA,
      fetchConfig: fetchConfigForSource(sourceKind, options)
    })
  });

  const raw = parsePayloadJson(body);
  return normalizeTrainerPayload(raw, url, sourceKind);
}

export async function crawlTrainerWebsite(
  url: string,
  options: { maxPages?: number; maxDepth?: number; stealth?: boolean } = {}
) {
  const maxPages = Math.min(Math.max(options.maxPages ?? 5, 1), 15);
  const maxDepth = Math.min(Math.max(options.maxDepth ?? 2, 1), 3);

  const body = await sgaiFetch("/crawl", {
    method: "POST",
    body: JSON.stringify({
      url,
      formats: [{
        type: "json",
        prompt: EXTRACT_PROMPT,
        schema: TRAINER_PROFILE_SCHEMA
      }],
      maxPages,
      maxDepth,
      allowExternal: false,
      fetchConfig: defaultFetchConfig(options)
    })
  });

  return {
    crawlId: body.id as string,
    status: body.status as string,
    total: (body.total as number) ?? maxPages
  };
}

export async function getCrawlStatus(crawlId: string) {
  return sgaiFetch(`/crawl/${crawlId}`, { method: "GET" });
}

export async function fetchAllCrawlPages(crawlId: string) {
  const allPages: any[] = [];
  let cursor = 0;

  while (true) {
    const body = await sgaiFetch(`/crawl/${crawlId}/pages?limit=50&cursor=${cursor}`, { method: "GET" });
    const batch = body.data || [];
    allPages.push(...batch);
    const nextCursor = body.pagination?.nextCursor;
    if (nextCursor == null || batch.length === 0) break;
    cursor = Number(nextCursor);
  }

  return allPages;
}

export function profilesFromCrawlPages(pages: any[], sourceUrl: string): ScrapedTrainerProfile[] {
  const profiles: ScrapedTrainerProfile[] = [];

  for (const page of pages) {
    if (page.status !== "completed") continue;
    const jsonResults = page.scrape?.results?.json;
    const jsonData = jsonResults?.data ?? jsonResults?.json ?? jsonResults;
    let payload = jsonData;
    if (Array.isArray(jsonData) && jsonData.length === 1 && typeof jsonData[0] === "object") {
      payload = jsonData[0];
    } else if (typeof jsonData === "string") {
      try {
        payload = JSON.parse(jsonData);
      } catch {
        payload = null;
      }
    }
    if (payload) profiles.push(normalizeTrainerPayload(payload, page.url || sourceUrl, "website"));
  }

  return profiles;
}

export async function waitForCrawl(
  crawlId: string,
  opts: { pollMs?: number; onProgress?: (p: { status: string; finished: number; total: number }) => void; signal?: AbortSignal } = {}
) {
  while (true) {
    if (opts.signal?.aborted) throw new Error("Crawl cancelled");

    const status = await getCrawlStatus(crawlId);
    opts.onProgress?.({
      status: status.status,
      finished: status.finished ?? 0,
      total: status.total ?? 0
    });

    if (status.status === "completed") return status;
    if (status.status === "failed") throw new Error(`Crawl failed: ${status.error || "unknown error"}`);

    await new Promise((r) => setTimeout(r, opts.pollMs ?? 2000));
  }
}

export function buildSourceList(input: {
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
}): Array<{ kind: SourceKind; url: string }> {
  const sources: Array<{ kind: SourceKind; url: string }> = [];
  const website = normalizeWebsiteUrl(input.websiteUrl || "");
  const instagram = normalizeInstagramUrl(input.instagramUrl || "");
  const linkedin = normalizeLinkedInUrl(input.linkedinUrl || "");

  if (website) sources.push({ kind: "website", url: website });
  if (linkedin) sources.push({ kind: "linkedin", url: linkedin });
  if (instagram) sources.push({ kind: "instagram", url: instagram });

  return sources;
}
