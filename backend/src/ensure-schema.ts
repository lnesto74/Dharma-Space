import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PG_SCHEMA = "dharma";

export function usesPostgres(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

export function postgresUser(url: string): string | null {
  const match = url.match(/^postgres(?:ql)?:\/\/([^:@/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
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

export function withSchemaParam(databaseUrl: string, schema: string): string {
  const withoutSchema = databaseUrl.replace(/([?&])schema=[^&]*&?/g, "$1").replace(/[?&]$/, "");
  const joiner = withoutSchema.includes("?") ? "&" : "?";
  return `${withoutSchema}${joiner}schema=${encodeURIComponent(schema)}`;
}

function printGrantInstructions(url: string) {
  const user = postgresUser(url);
  if (!user) return;
  console.error(`
[startup] ── DigitalOcean: one-time database fix required ──

Open: DigitalOcean → Databases → your Postgres cluster → Query / Console
Run as doadmin:

  CREATE SCHEMA IF NOT EXISTS ${PG_SCHEMA} AUTHORIZATION "${user}";
  GRANT ALL ON SCHEMA ${PG_SCHEMA} TO "${user}";
  GRANT ALL ON SCHEMA public TO "${user}";
  GRANT CREATE ON SCHEMA public TO "${user}";

Then redeploy.

Or add DATABASE_MIGRATION_URL = doadmin connection URI from DO (encrypted).
`);
}

async function createDedicatedSchema(baseUrl: string): Promise<string> {
  const { PrismaClient } = await import("@prisma/client");
  const bootstrap = new PrismaClient({
    datasources: { db: { url: baseUrl } }
  });

  try {
    await bootstrap.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${PG_SCHEMA}"`);
    console.log(`[startup] PostgreSQL schema "${PG_SCHEMA}" ready`);
  } catch (error) {
    console.warn(`[startup] Could not create schema "${PG_SCHEMA}" — will try db push on public`);
  } finally {
    await bootstrap.$disconnect();
  }

  return withSchemaParam(baseUrl, PG_SCHEMA);
}

export async function ensureDatabaseSchema(): Promise<void> {
  if (!usesPostgres()) return;

  const appUrl = normalizePostgresUrl(process.env.DATABASE_URL!);

  let pushUrl: string;
  if (process.env.DATABASE_MIGRATION_URL) {
    const adminUrl = normalizePostgresUrl(process.env.DATABASE_MIGRATION_URL);
    console.log("[startup] Using DATABASE_MIGRATION_URL for schema setup");
    pushUrl = withSchemaParam(adminUrl, PG_SCHEMA);
    await createDedicatedSchema(adminUrl).catch(() => undefined);
  } else {
    pushUrl = await createDedicatedSchema(appUrl);
  }

  console.log("[startup] Applying Prisma schema to PostgreSQL...");
  try {
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      cwd: backendRoot,
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: pushUrl }
    });
    console.log("[startup] Database schema ready.");
  } catch (error) {
    printGrantInstructions(appUrl);
    throw error;
  }

  process.env.DATABASE_URL = pushUrl.includes(`schema=${PG_SCHEMA}`)
    ? withSchemaParam(appUrl, PG_SCHEMA)
    : appUrl;
}
