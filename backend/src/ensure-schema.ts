import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PG_SCHEMA = "dharma";

export function usesPostgres(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

export function withSchemaParam(databaseUrl: string, schema: string): string {
  const withoutSchema = databaseUrl.replace(/([?&])schema=[^&]*&?/g, "$1").replace(/[?&]$/, "");
  const joiner = withoutSchema.includes("?") ? "&" : "?";
  return `${withoutSchema}${joiner}schema=${encodeURIComponent(schema)}`;
}

async function createDedicatedSchema(baseUrl: string): Promise<string> {
  const { PrismaClient } = await import("@prisma/client");
  const bootstrap = new PrismaClient({ datasources: { db: { url: baseUrl } } });
  try {
    await bootstrap.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${PG_SCHEMA}"`);
    console.log(`[startup] PostgreSQL schema "${PG_SCHEMA}" ready`);
    return withSchemaParam(baseUrl, PG_SCHEMA);
  } catch (error) {
    console.warn(`[startup] Could not create "${PG_SCHEMA}" schema, using public`);
    return baseUrl;
  } finally {
    await bootstrap.$disconnect();
  }
}

export async function ensureDatabaseSchema(): Promise<void> {
  if (!usesPostgres()) return;

  const migrationUrl = process.env.DATABASE_MIGRATION_URL?.trim();
  const appUrl = process.env.DATABASE_URL!;
  const pushUrl = migrationUrl || (await createDedicatedSchema(appUrl));

  console.log("[startup] Applying Prisma schema to PostgreSQL...");
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: backendRoot,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: pushUrl }
  });

  process.env.DATABASE_URL = pushUrl.includes(`schema=${PG_SCHEMA}`)
    ? withSchemaParam(appUrl, PG_SCHEMA)
    : appUrl;

  console.log("[startup] Database schema ready.");
}
