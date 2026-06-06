import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const PROGRAM_MEDIA_DIR = path.join(process.cwd(), "data", "program-media");
export const PROGRAM_MEDIA_URL_PREFIX = "/api/media/programs";

const ALLOWED_UPLOAD_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

function extFromUpload(filename: string): string {
  const fromName = filename.split(".").pop()?.toLowerCase();
  if (fromName && ALLOWED_UPLOAD_EXT.has(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  return "jpg";
}

export async function saveUploadedProgramFile(
  programId: string,
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
  const dir = path.join(PROGRAM_MEDIA_DIR, programId);
  await mkdir(dir, { recursive: true });

  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 12);
  const finalName = `hero-${hash}-${Date.now()}.${ext}`;
  await writeFile(path.join(dir, finalName), buffer);

  return `${PROGRAM_MEDIA_URL_PREFIX}/${programId}/${finalName}`;
}
