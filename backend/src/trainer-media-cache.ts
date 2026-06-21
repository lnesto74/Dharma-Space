import { createHash } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Response } from "express";

export const TRAINER_MEDIA_DIR = path.join(process.cwd(), "data", "trainer-media");
export const TRAINER_MEDIA_URL_PREFIX = "/api/media/trainers";

const PROXY_HOST_SUFFIXES = [
  "cdninstagram.com",
  "fbcdn.net",
  "instagram.com",
  "licdn.com",
  "linkedin.com"
];

type MediaLink = { type: string; url: string; caption?: string; thumbnailUrl?: string };

export function needsMediaProxy(url: string | null | undefined): boolean {
  if (!url?.startsWith("http")) return false;
  if (url.includes(TRAINER_MEDIA_URL_PREFIX)) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PROXY_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

export function mediaProxyUrl(remoteUrl: string): string {
  return `/api/media/proxy?url=${encodeURIComponent(remoteUrl)}`;
}

export function resolveDisplayMediaUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  if (url.startsWith(TRAINER_MEDIA_URL_PREFIX) || url.startsWith("/api/media/proxy")) return url;
  if (needsMediaProxy(url)) return mediaProxyUrl(url);
  return url;
}

function hashUrl(url: string) {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

function localPublicUrl(trainerId: string, filename: string) {
  return `${TRAINER_MEDIA_URL_PREFIX}/${trainerId}/${filename}`;
}

const ALLOWED_UPLOAD_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

function extFromUpload(filename: string, contentType?: string): string {
  const fromName = filename.split(".").pop()?.toLowerCase();
  if (fromName && ALLOWED_UPLOAD_EXT.has(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

export async function saveUploadedTrainerFile(
  trainerId: string,
  buffer: Buffer,
  filename: string,
  contentType?: string
): Promise<string> {
  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error("Image must be under 8 MB");
  }
  if (buffer.length < 32) {
    throw new Error("Invalid image file");
  }

  const ext = extFromUpload(filename, contentType);
  const dir = path.join(TRAINER_MEDIA_DIR, trainerId);
  await mkdir(dir, { recursive: true });

  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 12);
  const finalName = `upload-${hash}-${Date.now()}.${ext}`;
  await writeFile(path.join(dir, finalName), buffer);

  return localPublicUrl(trainerId, finalName);
}

async function downloadImage(remoteUrl: string): Promise<{ buffer: Buffer; ext: string } | null> {
  try {
    const res = await fetch(remoteUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DharmaSpace/1.0)",
        Accept: "image/*,*/*"
      },
      redirect: "follow"
    });
    if (!res.ok) return null;

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : contentType.includes("gif")
          ? "gif"
          : "jpg";

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 128) return null;
    return { buffer, ext };
  } catch {
    return null;
  }
}

export async function cacheRemoteImage(trainerId: string, remoteUrl: string): Promise<string | null> {
  if (!remoteUrl?.startsWith("http")) return remoteUrl || null;
  if (remoteUrl.includes(TRAINER_MEDIA_URL_PREFIX)) return remoteUrl;

  const dir = path.join(TRAINER_MEDIA_DIR, trainerId);
  await mkdir(dir, { recursive: true });

  const hash = hashUrl(remoteUrl);

  try {
    const { readdir } = await import("node:fs/promises");
    const existing = await readdir(dir);
    const hit = existing.find((name) => name.startsWith(`${hash}.`));
    if (hit) return localPublicUrl(trainerId, hit);
  } catch {
    /* first download for this trainer */
  }

  const downloaded = await downloadImage(remoteUrl);
  if (!downloaded) return null;

  const filename = `${hash}.${downloaded.ext}`;
  const filepath = path.join(dir, filename);

  try {
    await access(filepath);
  } catch {
    await writeFile(filepath, downloaded.buffer);
  }

  return localPublicUrl(trainerId, filename);
}

export async function cacheTrainerMedia(
  trainerId: string,
  data: {
    imageUrl?: string | null;
    galleryUrls?: string[];
    mediaLinks?: MediaLink[];
  }
) {
  const out = { ...data };

  if (data.imageUrl && needsMediaProxy(data.imageUrl)) {
    out.imageUrl = (await cacheRemoteImage(trainerId, data.imageUrl)) || data.imageUrl;
  }

  if (data.galleryUrls?.length) {
    out.galleryUrls = [];
    for (const url of data.galleryUrls) {
      if (needsMediaProxy(url)) {
        out.galleryUrls.push((await cacheRemoteImage(trainerId, url)) || url);
      } else {
        out.galleryUrls.push(url);
      }
    }
  }

  if (data.mediaLinks?.length) {
    out.mediaLinks = [];
    for (const link of data.mediaLinks) {
      let thumbnailUrl = link.thumbnailUrl;
      if (thumbnailUrl && needsMediaProxy(thumbnailUrl)) {
        thumbnailUrl = (await cacheRemoteImage(trainerId, thumbnailUrl)) || thumbnailUrl;
      }
      out.mediaLinks.push({ ...link, thumbnailUrl });
    }
  }

  return out;
}

export function displayTrainerMedia<T extends {
  id: string;
  imageUrl?: string;
  galleryUrls?: string[];
  mediaLinks?: MediaLink[];
}>(trainer: T): T {
  return {
    ...trainer,
    imageUrl: resolveDisplayMediaUrl(trainer.imageUrl) || trainer.imageUrl,
    galleryUrls: trainer.galleryUrls?.map((u) => resolveDisplayMediaUrl(u) || u),
    mediaLinks: trainer.mediaLinks?.map((m) => ({
      ...m,
      thumbnailUrl: m.thumbnailUrl ? resolveDisplayMediaUrl(m.thumbnailUrl) || m.thumbnailUrl : undefined
    }))
  };
}

export function trainerHasExternalMedia(trainer: {
  imageUrl?: string | null;
  galleryUrls?: string | null;
  mediaLinks?: string | null;
}): boolean {
  if (needsMediaProxy(trainer.imageUrl)) return true;
  try {
    const gallery = JSON.parse(trainer.galleryUrls || "[]") as string[];
    if (gallery.some(needsMediaProxy)) return true;
    const media = JSON.parse(trainer.mediaLinks || "[]") as MediaLink[];
    if (media.some((m) => needsMediaProxy(m.thumbnailUrl))) return true;
  } catch {
    return false;
  }
  return false;
}

export async function recacheTrainerMediaFromDb(
  prisma: import("@prisma/client").PrismaClient,
  trainerId: string
) {
  const trainer = await prisma.siteTrainer.findUnique({ where: { id: trainerId } });
  if (!trainer) throw new Error("Trainer not found");

  let galleryUrls: string[] = [];
  let mediaLinks: MediaLink[] = [];
  try {
    galleryUrls = JSON.parse(trainer.galleryUrls || "[]");
  } catch {
    galleryUrls = [];
  }
  try {
    mediaLinks = JSON.parse(trainer.mediaLinks || "[]");
  } catch {
    mediaLinks = [];
  }

  const cached = await cacheTrainerMedia(trainerId, {
    imageUrl: trainer.imageUrl,
    galleryUrls,
    mediaLinks
  });

  const updated = await prisma.siteTrainer.update({
    where: { id: trainerId },
    data: {
      imageUrl: cached.imageUrl ?? trainer.imageUrl,
      galleryUrls: JSON.stringify(cached.galleryUrls ?? galleryUrls),
      mediaLinks: JSON.stringify(cached.mediaLinks ?? mediaLinks)
    }
  });

  return updated;
}

export function isAllowedProxyUrl(url: string): boolean {
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return PROXY_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

export async function streamProxiedImage(remoteUrl: string, res: Response) {
  const upstream = await fetch(remoteUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; DharmaSpace/1.0)",
      Accept: "image/*,*/*",
      Referer: "https://www.instagram.com/"
    },
    redirect: "follow"
  });

  if (!upstream.ok) {
    res.status(upstream.status).json({ message: "Could not fetch image" });
    return;
  }

  const contentType = upstream.headers.get("content-type") || "image/jpeg";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=86400");
  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.send(buffer);
}
