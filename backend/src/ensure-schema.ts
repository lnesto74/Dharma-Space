import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function usesPostgres(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

export async function ensureDatabaseSchema(): Promise<void> {
  if (!usesPostgres()) return;

  console.log("[startup] Applying Prisma schema to PostgreSQL...");
  execSync("npx prisma db push --skip-generate", {
    cwd: backendRoot,
    stdio: "inherit",
    env: process.env
  });
  console.log("[startup] Database schema ready.");
}
