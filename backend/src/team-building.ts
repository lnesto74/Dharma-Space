import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient, SiteTeamActivity } from "@prisma/client";
import { DATA_ROOT } from "./data-root.js";
import { saveUploadedTeamBuildingFile } from "./team-building-media-cache.js";

export const DEFAULT_TEAM_ACTIVITIES = [
  {
    title: "Aerial Sound Bath",
    description:
      "Immersive Tibetan and crystal bowl experience enjoyed from the comfort of aerial hammocks — deep collective relaxation and reset like no other.",
    imageUrl: "/team-building/aerial-sound-bath.jpg",
    sortOrder: 0
  },
  {
    title: "Glow Yoga",
    description:
      "Yoga in a UV-lit studio with neon body paint — under the lamps, every move glows. A playful, high-energy night you won't forget.",
    imageUrl: "/team-building/glow-yoga.jpg",
    sortOrder: 1
  },
  {
    title: "Learning Handpan Class",
    description:
      "Discover the meditative magic of the handpan together — no experience needed, pure presence required.",
    imageUrl: "/team-building/handpan-class.jpg",
    sortOrder: 2
  },
  {
    title: "Nature Walk & Mindfulness",
    description:
      "Guided outdoor walk blending movement, breath, and sensory awareness in Singapore's green spaces.",
    imageUrl: "/team-building/nature-walk.jpg",
    sortOrder: 3
  },
  {
    title: "Healthy Meals Cooking Classes",
    description:
      "Hands-on cooking class focused on healthy, nourishing meals — learn together, eat well, and bond as a team.",
    imageUrl: "/team-building/cooking-class.jpg",
    sortOrder: 4
  },
  {
    title: "Creative Movement",
    description:
      "Freeform expressive dance to music — no steps, just authentic movement, joy, and connection.",
    imageUrl: "/team-building/creative-movement.jpg",
    sortOrder: 5
  },
  {
    title: "Corporate Yacht Events",
    description:
      "Exclusive sailing experiences on Singapore's waters — the ultimate backdrop for team connection.",
    imageUrl: "/team-building/corporate-yacht.jpg",
    sortOrder: 6
  },
  {
    title: "Padel Team-Building",
    description:
      "Fast-paced, beginner-friendly padel sessions that spark healthy competition and team spirit.",
    imageUrl: "/team-building/padel.jpg",
    sortOrder: 7
  }
] as const;

const BUNDLED_TEAM_IMAGES: Array<{ title: string; file: string }> = [
  { title: "Aerial Sound Bath", file: "aerial-sound-bath.jpg" },
  { title: "Learning Handpan Class", file: "learning-handpan-class.jpg" },
  { title: "Healthy Meals Cooking Classes", file: "healthy-meals-cooking-class.jpg" }
];

export function serializeTeamActivity(activity: SiteTeamActivity) {
  return {
    id: activity.id,
    title: activity.title,
    description: activity.description,
    imageUrl: activity.imageUrl,
    sortOrder: activity.sortOrder
  };
}

export async function ensureTeamActivities(prisma: PrismaClient) {
  for (const activity of DEFAULT_TEAM_ACTIVITIES) {
    await prisma.siteTeamActivity.upsert({
      where: { title: activity.title },
      create: {
        title: activity.title,
        description: activity.description,
        imageUrl: activity.imageUrl,
        sortOrder: activity.sortOrder,
        published: true
      },
      update: {
        description: activity.description,
        sortOrder: activity.sortOrder,
        published: true
      }
    });
  }
}

export async function restoreBundledTeamBuildingImages(prisma: PrismaClient) {
  for (const { title, file } of BUNDLED_TEAM_IMAGES) {
    const activity = await prisma.siteTeamActivity.findFirst({ where: { title } });
    if (!activity) continue;

    const bundledPath = path.join(DATA_ROOT, "team-building-images", file);
    let buffer: Buffer;
    try {
      buffer = await readFile(bundledPath);
    } catch {
      continue;
    }

    const url = await saveUploadedTeamBuildingFile(activity.id, buffer, file);
    if (activity.imageUrl === url) continue;
    await prisma.siteTeamActivity.update({
      where: { id: activity.id },
      data: { imageUrl: url }
    });
    console.log(`[startup] Restored team building image: ${title}`);
  }
}
