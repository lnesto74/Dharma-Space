/**
 * Import a specialist portrait: crop to 3:4, save under data/trainer-media, update DB.
 *
 * Usage:
 *   npx tsx scripts/import-specialist-photo.ts "Vera Pleshakova" /path/to/photo.png
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { TRAINER_MEDIA_DIR } from "../src/trainer-media-cache.js";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

const TARGET_W = 900;
const TARGET_H = 1200; // 3:4 portrait for specialist cards

async function cropPortrait(inputPath: string): Promise<Buffer> {
  const { spawnSync } = await import("node:child_process");
  const tmpOut = path.join(TRAINER_MEDIA_DIR, "_tmp-import.jpg");

  const py = `
from PIL import Image
src = Image.open(${JSON.stringify(inputPath)}).convert("RGB")
w, h = src.size
ratio = 3 / 4
# Tighter head-and-shoulders crop from the upper portion.
crop_w = int(w * 0.94)
crop_h = int(crop_w / ratio)
if crop_h > h:
    crop_h = h
    crop_w = int(crop_h * ratio)
left = max(0, (w - crop_w) // 2 - int(w * 0.03))
top = max(0, int(h * 0.02))
right = min(w, left + crop_w)
bottom = min(h, top + crop_h)
if bottom - top < crop_h:
    top = max(0, bottom - crop_h)
crop = src.crop((left, top, right, bottom))
crop = crop.resize((${TARGET_W}, ${TARGET_H}), Image.Resampling.LANCZOS)
crop.save(${JSON.stringify(tmpOut)}, "JPEG", quality=92, optimize=True)
print("ok")
`;
  const result = spawnSync("python3", ["-c", py], { encoding: "utf-8" });
  if (result.status !== 0 || !result.stdout.includes("ok")) {
    throw new Error(result.stderr || "Failed to crop image");
  }
  const { readFile, unlink } = await import("node:fs/promises");
  const buffer = await readFile(tmpOut);
  await unlink(tmpOut).catch(() => {});
  return buffer;
}

async function main() {
  const name = process.argv[2]?.trim();
  const inputPath = process.argv[3]?.trim();
  if (!name || !inputPath) {
    console.error('Usage: npx tsx scripts/import-specialist-photo.ts "Full Name" /path/to/photo');
    process.exit(1);
  }

  const resolved = path.resolve(inputPath);
  const prisma = new PrismaClient();
  try {
    const trainer = await prisma.siteTrainer.findFirst({ where: { name } });
    if (!trainer) {
      throw new Error(`Trainer not found: ${name}`);
    }

    const buffer = await cropPortrait(resolved);
    const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 12);
    const filename = `upload-${hash}-${Date.now()}.jpg`;
    const dir = path.join(TRAINER_MEDIA_DIR, trainer.id);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), buffer);

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const portraitsDir = path.join(TRAINER_MEDIA_DIR, "..", "specialist-portraits");
    await mkdir(portraitsDir, { recursive: true });
    await writeFile(path.join(portraitsDir, `${slug}.jpg`), buffer);

    const imageUrl = `/api/media/trainers/${trainer.id}/${filename}`;
    await prisma.siteTrainer.update({
      where: { id: trainer.id },
      data: { imageUrl }
    });

    console.log(`Saved ${name} → ${imageUrl}`);
    console.log(`File: ${path.join(dir, filename)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
