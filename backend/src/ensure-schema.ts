import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function usesPostgres(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

/** DigitalOcean dev DB URLs often use the component name as DB; the real DB is defaultdb. */
export function normalizePostgresUrl(url: string): string {
  let normalized = url;

  const match = normalized.match(/^(postgresql:\/\/[^/]+\/)([^?]+)(.*)$/);
  if (match) {
    const [, prefix, dbName, suffix] = match;
    if (/^dev-db-\d+$/.test(dbName)) {
      console.log(`[startup] DigitalOcean: using database "defaultdb" instead of "${dbName}"`);
      normalized = `${prefix}defaultdb${suffix}`;
    }
  }

  return normalized;
}

export async function ensureDatabaseSchema(): Promise<void> {
  if (!usesPostgres()) return;

  process.env.DATABASE_URL = normalizePostgresUrl(process.env.DATABASE_URL!);

  console.log("[startup] Applying Prisma schema to PostgreSQL...");
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: backendRoot,
    stdio: "inherit",
    env: process.env
  });
  console.log("[startup] Database schema ready.");
}
