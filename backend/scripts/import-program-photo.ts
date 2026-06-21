/**
 * Import a program/event hero image, crop, save under data/program-media, update DB.
 *
 * Usage:
 *   npx tsx scripts/import-program-photo.ts "Program title" /path/to/photo.png [aspect]
 *   aspect: 4:5 (default, Education flagship) or 16:9 (Events cards)
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PROGRAM_MEDIA_DIR, saveUploadedProgramFile } from "../src/program-media-cache.js";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

function parseAspect(raw?: string): { w: number; h: number } {
  if (!raw || raw === "4:5") return { w: 4, h: 5 };
  if (raw === "16:9") return { w: 16, h: 9 };
  throw new Error(`Unsupported aspect ratio: ${raw}. Use 4:5 or 16:9.`);
}

function targetSize(aspect: { w: number; h: number }) {
  if (aspect.w === 16) return { width: 1600, height: 900 };
  return { width: 1200, height: 1500 };
}

async function cropHero(inputPath: string, aspect: { w: number; h: number }): Promise<Buffer> {
  const { spawnSync } = await import("node:child_process");
  const tmpOut = path.join(PROGRAM_MEDIA_DIR, "_tmp-program-import.jpg");
  const { width, height } = targetSize(aspect);
  const ratio = aspect.w / aspect.h;

  const py = `
from PIL import Image
src = Image.open(${JSON.stringify(inputPath)}).convert("RGB")
w, h = src.size
ratio = ${ratio}
if w / h > ratio:
    crop_h = h
    crop_w = int(h * ratio)
else:
    crop_w = w
    crop_h = int(w / ratio)
left = max(0, (w - crop_w) // 2)
top = max(0, (h - crop_h) // 2)
right = min(w, left + crop_w)
bottom = min(h, top + crop_h)
crop = src.crop((left, top, right, bottom))
crop = crop.resize((${width}, ${height}), Image.Resampling.LANCZOS)
crop.save(${JSON.stringify(tmpOut)}, "JPEG", quality=92, optimize=True)
print("ok")
`;
  const result = spawnSync("python3", ["-c", py], { encoding: "utf-8" });
  if (result.status !== 0 || !result.stdout.includes("ok")) {
    throw new Error(result.stderr || "Failed to crop image");
  }
  const buffer = await readFile(tmpOut);
  const { unlink } = await import("node:fs/promises");
  await unlink(tmpOut).catch(() => {});
  return buffer;
}

async function main() {
  const titleQuery = process.argv[2]?.trim();
  const inputPath = process.argv[3]?.trim();
  const aspect = parseAspect(process.argv[4]?.trim());
  if (!titleQuery || !inputPath) {
    console.error('Usage: npx tsx scripts/import-program-photo.ts "Program title" /path/to/photo [4:5|16:9]');
    process.exit(1);
  }

  const resolved = path.resolve(inputPath);
  const prisma = new PrismaClient();
  try {
    const program = await prisma.siteProgram.findFirst({
      where: { title: { contains: titleQuery } }
    });
    if (!program) {
      throw new Error(`Program not found: ${titleQuery}`);
    }

    const buffer = await cropHero(resolved, aspect);
    const url = await saveUploadedProgramFile(program.id, buffer, "hero.jpg");

    const archiveDir = path.join(PROGRAM_MEDIA_DIR, "..", "program-images");
    await mkdir(archiveDir, { recursive: true });
    const slug = program.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
    await writeFile(path.join(archiveDir, `${slug}.jpg`), buffer);

    await prisma.siteProgram.update({
      where: { id: program.id },
      data: { imageUrl: url }
    });

    console.log(`Saved ${program.title} → ${url}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
