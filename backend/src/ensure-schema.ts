import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function usesPostgres(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

export async function tableCount(url: string): Promise<number> {
  const { PrismaClient } = await import("@prisma/client");
  const client = new PrismaClient({ datasources: { db: { url } } });
  try {
    const rows = await client.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    return Number(rows[0]?.count ?? 0);
  } finally {
    await client.$disconnect();
  }
}

/** Returns true when schema is ready for queries. */
export async function ensureDatabaseSchema(): Promise<boolean> {
  if (!usesPostgres()) return true;

  const url = process.env.DATABASE_URL!;

  if ((await tableCount(url)) > 0) {
    console.log("[startup] Database OK — tables already exist.");
    return true;
  }

  console.log("[startup] No tables yet — running prisma db push...");
  try {
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      cwd: backendRoot,
      stdio: "inherit",
      env: process.env
    });
    console.log("[startup] Database schema created.");
    return true;
  } catch (error) {
    console.warn("[startup] db push failed — starting API anyway so DigitalOcean can finish provisioning.");
    console.warn("[startup] DO grants dev-DB permissions only AFTER a successful deploy.");
    console.warn("[startup] Redeploy once more after this deployment goes ACTIVE; tables should then be created.");
    return false;
  }
}
