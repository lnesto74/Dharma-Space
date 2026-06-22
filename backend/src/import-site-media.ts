import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { DATA_ROOT, PROGRAM_MEDIA_DIR, TRAINER_MEDIA_DIR } from "./data-root.js";
import { saveUploadedProgramFile } from "./program-media-cache.js";
import { saveUploadedTrainerFile } from "./trainer-media-cache.js";

export const GLOW_YOGA_DESC =
  "Yoga in a UV-lit studio with neon body paint — under the lamps, every move glows. A playful, high-energy night you won't forget.";

const SPECIALIST_NAMES: Record<string, string> = {
  "vera-pleshakova": "Vera Pleshakova",
  "bolor-lorinet": "Bolor Lorinet",
  "kristina-gazi": "Kristina Gazi",
  "oxana-shilina": "Oxana Shilina",
  "yana-an": "Yana An",
  "kanthan-jeganathan": "Kanthan Jeganathan",
  "dr-nirmal-bhusal": "Dr. Nirmal Bhusal",
  "manjeet-mathur": "Manjeet Mathur"
};

const PROGRAM_TITLES: Record<string, string> = {
  "200-hour-yoga-teacher-training": "200-Hour Yoga Teacher Training",
  "cacao-ceremony": "Cacao Ceremony",
  "ecstatic-dance": "Ecstatic Dance",
  "sound-healing-journey": "Sound Healing Journey",
  "breathwork-circle": "Breathwork Circle",
  "full-moon-ceremony": "Full Moon Ceremony",
  "glow-yoga": "Glow Yoga"
};

async function storedMediaFileExists(url: string): Promise<boolean> {
  const trainerMatch = url.match(/\/api\/media\/trainers\/([^/]+)\/([^/]+)$/);
  if (trainerMatch) {
    const [, id, file] = trainerMatch;
    try {
      await access(path.join(TRAINER_MEDIA_DIR, id, file));
      return true;
    } catch {
      return false;
    }
  }

  const programMatch = url.match(/\/api\/media\/programs\/([^/]+)\/([^/]+)$/);
  if (programMatch) {
    const [, id, file] = programMatch;
    try {
      await access(path.join(PROGRAM_MEDIA_DIR, id, file));
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

async function needsBundledMediaImport(url: string | null | undefined): Promise<boolean> {
  if (!url) return true;
  if (url.includes("_components/v2/")) return true;
  if (url.includes("images.unsplash.com")) return true;
  if (url.includes("/api/media/trainers/") || url.includes("/api/media/programs/")) {
    return !(await storedMediaFileExists(url));
  }
  return false;
}

async function importDir(
  prisma: PrismaClient,
  subdir: string,
  map: Record<string, string>,
  kind: "trainer" | "program"
) {
  const dir = path.join(DATA_ROOT, subdir);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  } catch {
    return;
  }

  for (const file of files) {
    const slug = file.replace(/\.(jpe?g|png|webp)$/i, "");
    const label = map[slug];
    if (!label) continue;

    const buffer = await readFile(path.join(dir, file));
    if (kind === "trainer") {
      const trainer = await prisma.siteTrainer.findFirst({ where: { name: label } });
      if (!trainer || !(await needsBundledMediaImport(trainer.imageUrl))) continue;
      const url = await saveUploadedTrainerFile(trainer.id, buffer, file);
      await prisma.siteTrainer.update({ where: { id: trainer.id }, data: { imageUrl: url } });
      console.log(`[startup] Restored specialist portrait: ${label}`);
    } else {
      const program = await prisma.siteProgram.findFirst({ where: { title: label } });
      if (!program || !(await needsBundledMediaImport(program.imageUrl))) continue;
      const url = await saveUploadedProgramFile(program.id, buffer, file);
      const data: { imageUrl: string; description?: string; title?: string; location?: string } = { imageUrl: url };
      if (label === "Glow Yoga") {
        data.description = GLOW_YOGA_DESC;
        data.title = "Glow Yoga";
        data.location = "Dharma Space Studio";
      }
      await prisma.siteProgram.update({ where: { id: program.id }, data });
      console.log(`[startup] Restored program image: ${label}`);
    }
  }
}

export async function syncSiteMediaMetadata(prisma: PrismaClient) {
  await prisma.siteTrainer.updateMany({ where: { name: "KJ" }, data: { name: "Kanthan Jeganathan" } });
  await prisma.siteProgram.updateMany({
    where: { OR: [{ title: "Glow Yoga" }, { title: "Wellness Networking Evening" }] },
    data: {
      title: "Glow Yoga",
      description: GLOW_YOGA_DESC,
      location: "Dharma Space Studio",
      facilitator: "Dharma Space Team"
    }
  });
}

export async function importBundledSiteMedia(prisma: PrismaClient) {
  await syncSiteMediaMetadata(prisma);
  await importDir(prisma, "specialist-portraits", SPECIALIST_NAMES, "trainer");
  await importDir(prisma, "program-images", PROGRAM_TITLES, "program");
}
