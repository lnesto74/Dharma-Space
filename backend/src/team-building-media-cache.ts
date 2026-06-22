import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { TEAM_BUILDING_MEDIA_DIR } from "./data-root.js";

export { TEAM_BUILDING_MEDIA_DIR };
export const TEAM_BUILDING_MEDIA_URL_PREFIX = "/api/media/team-building";

const ALLOWED_UPLOAD_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

function extFromUpload(filename: string): string {
  const fromName = filename.split(".").pop()?.toLowerCase();
  if (fromName && ALLOWED_UPLOAD_EXT.has(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  return "jpg";
}

export async function saveUploadedTeamBuildingFile(
  activityId: string,
  buffer: Buffer,
  filename: string
): Promise<string> {
  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error("Image must be under 8 MB");
  }
  if (buffer.length < 32) {
    throw new Error("Invalid image file");
  }

  const ext = extFromUpload(filename);
  const dir = path.join(TEAM_BUILDING_MEDIA_DIR, activityId);
  await mkdir(dir, { recursive: true });

  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 12);
  const finalName = `photo-${hash}-${Date.now()}.${ext}`;
  await writeFile(path.join(dir, finalName), buffer);

  return `${TEAM_BUILDING_MEDIA_URL_PREFIX}/${activityId}/${finalName}`;
}
