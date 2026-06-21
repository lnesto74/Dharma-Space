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
export const yanaImg = byName["Yana An"];
export const kjImg = byName["Kanthan Jeganathan"];
export const nirmalImg = byName["Dr. Nirmal Bhusal"];
export const manjeetImg = byName["Manjeet Mathur"];

export const aerialSoundBathImg =
  "https://images.unsplash.com/photo-1623764211727-5a8278662af0?w=600&h=800&fit=crop&auto=format";
export const glowYogaImg =
  "https://images.unsplash.com/photo-1588286840104-8957b019727f?w=600&h=800&fit=crop&auto=format";
export const handpanImg = yanaImg;
export const cookingImg = bolorImg;
export const yachtImg =
  "https://images.unsplash.com/photo-1567894340315-735d7c361db0?w=600&h=800&fit=crop&auto=format";

export const platformImg1 = founderImg;
export const platformImg2 = oxanaImg;
export const platformImg3 = bolorImg;
