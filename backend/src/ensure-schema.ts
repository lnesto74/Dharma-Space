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
  if (/[?&]schema=/.test(databaseUrl)) {
    return databaseUrl.replace(/([?&])schema=[^&]*/, `$1schema=${encodeURIComponent(schema)}`);
  }
  const joiner = databaseUrl.includes("?") ? "&" : "?";
  return `${databaseUrl}${joiner}schema=${encodeURIComponent(schema)}`;
}

export async function ensureDatabaseSchema(): Promise<void> {
  if (!usesPostgres()) return;

  const schema = process.env.PG_SCHEMA || PG_SCHEMA;
  const baseUrl = process.env.DATABASE_URL!;
  const schemaUrl = withSchemaParam(baseUrl, schema);

  console.log(`[startup] Ensuring PostgreSQL schema "${schema}"...`);

  const { PrismaClient } = await import("@prisma/client");
  const bootstrap = new PrismaClient({
    datasources: { db: { url: baseUrl } }
  });
  try {
    await bootstrap.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  } finally {
    await bootstrap.$disconnect();
  }

  process.env.DATABASE_URL = schemaUrl;

  console.log("[startup] Applying Prisma schema to PostgreSQL...");
  execSync("npx prisma db push --skip-generate", {
    cwd: backendRoot,
    stdio: "inherit",
    env: process.env
  });
  console.log("[startup] Database schema ready.");
}
