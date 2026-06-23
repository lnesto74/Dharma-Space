import path from "node:path";
import { fileURLToPath } from "node:url";

/** Backend package root — stable regardless of process.cwd() on App Platform. */
export const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_ROOT = path.join(BACKEND_ROOT, "data");
export const TRAINER_MEDIA_DIR = path.join(DATA_ROOT, "trainer-media");
export const PROGRAM_MEDIA_DIR = path.join(DATA_ROOT, "program-media");
export const TEAM_BUILDING_MEDIA_DIR = path.join(DATA_ROOT, "team-building-media");
export const AVATAR_MEDIA_DIR = path.join(DATA_ROOT, "avatar-media");
