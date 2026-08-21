/** Local + live asset paths for marketing pages. Specialist photos from dharma-space.com. */
import { LOGO_MARK_URL } from "../brand";
import { LIVE_SITE_SPECIALISTS } from "./specialists-from-live-site";

const u = (path: string) => path;

export const logoImg = LOGO_MARK_URL;

export const heroImg =
  "https://images.unsplash.com/photo-1597151429864-c3b530575201?w=1600&h=900&fit=crop&auto=format";

export const yttImg =
  "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1200&h=900&fit=crop&auto=format";

export const payNowQR = u("/imports/figma-asset-2.png");

const byName = Object.fromEntries(LIVE_SITE_SPECIALISTS.map((s) => [s.name, s.img]));

export const founderImg = byName["Vera Pleshakova"];
export const bolorImg = byName["Bolor Lorinet"];
export const kristinaImg = byName["Kristina Gazi"];
export const oxanaImg = byName["Oxana Shilina"];
export const yanaImg = u("/specialists/yana-an.jpg");
export const kjImg = byName["Kanthan Jeganathan"];
export const nirmalImg = byName["Dr. Nirmal Bhusal"];
export const manjeetImg = byName["Manjeet Mathur"];

/**
 * Local, hand-cropped specialist photos that override whatever the backend/live
 * bundle serves for a given name (used in the specialists scroller).
 */
export const specialistPhotoOverrides: Record<string, string> = {
  "Yana An": u("/specialists/yana-an.jpg")
};

const teamBuilding = (file: string) => u(`/team-building/${file}`);

export const aerialSoundBathImg = teamBuilding("aerial-sound-bath.jpg");
export const glowYogaImg = teamBuilding("glow-yoga.jpg");
export const handpanImg = teamBuilding("handpan-class.jpg");
export const cookingImg = teamBuilding("cooking-class.jpg");
export const yachtImg = teamBuilding("corporate-yacht.jpg");
export const natureWalkImg = teamBuilding("nature-walk.jpg");
export const creativeMovementImg = teamBuilding("creative-movement.jpg");
export const padelImg = teamBuilding("padel.jpg");

// Real CWP platform screenshots (served from frontend/public/cwp/platform).
export const platformImg1 = u("/cwp/platform/platform-dashboard.png");
export const platformImg2 = u("/cwp/platform/platform-events.png");
export const platformImg3 = u("/cwp/platform/platform-messenger.png");
