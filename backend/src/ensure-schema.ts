import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function usesPostgres(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

export function postgresUser(url: string): string | null {
  const match = url.match(/^postgres(?:ql)?:\/\/([^:@/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function tableCount(url: string): Promise<number> {
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

async function grantAppUserAccess(migrationUrl: string, appUser: string) {
  const { PrismaClient } = await import("@prisma/client");
  const admin = new PrismaClient({ datasources: { db: { url: migrationUrl } } });
  try {
    await admin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${appUser}"`);
    await admin.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${appUser}"`);
    await admin.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${appUser}"`);
    await admin.$executeRawUnsafe(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${appUser}"`
    );
    await admin.$executeRawUnsafe(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${appUser}"`
    );
    console.log(`[startup] Granted public schema access to "${appUser}"`);
  } finally {
    await admin.$disconnect();
  }
}

function printSetupInstructions(appUser: string | null) {
  console.error(`
╔══════════════════════════════════════════════════════════════════╗
║  FIRST-TIME DIGITALOCEAN DATABASE SETUP (do this once)           ║
╠══════════════════════════════════════════════════════════════════╣
║  1. DigitalOcean → Databases → your Postgres cluster             ║
║  2. Connection Details → copy the doadmin Connection URI        ║
║     (database must be dev-db-191474 — do NOT use defaultdb)      ║
║  3. App → Settings → Environment Variables → Add:                ║
║       Key:   DATABASE_MIGRATION_URL                              ║
║       Value: paste doadmin URI                                   ║
║       Encrypt: YES                                               ║
║       Scope: Run time                                            ║
║  4. Keep DATABASE_URL = \${dev-db-191474.DATABASE_URL}           ║
║  5. Redeploy                                                     ║
║  6. After first successful deploy, you may remove                ║
║     DATABASE_MIGRATION_URL                                       ║
╚══════════════════════════════════════════════════════════════════╝
App DB user: ${appUser ?? "unknown"}
`);
}

export async function ensureDatabaseSchema(): Promise<void> {
  if (!usesPostgres()) return;

  const appUrl = process.env.DATABASE_URL!;
  const appUser = postgresUser(appUrl);
  const migrationUrl = process.env.DATABASE_MIGRATION_URL?.trim();

  if (migrationUrl) {
    console.log("[startup] Step 1/3: db push with DATABASE_MIGRATION_URL (doadmin)...");
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      cwd: backendRoot,
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: migrationUrl }
    });

    if (appUser) {
      console.log("[startup] Step 2/3: grant app user access to tables...");
      await grantAppUserAccess(migrationUrl, appUser);
    }

    console.log("[startup] Step 3/3: database schema ready.");
    return;
  }

  const tables = await tableCount(appUrl);
  if (tables > 0) {
    console.log(`[startup] Database OK — ${tables} tables in public schema.`);
    return;
  }

  printSetupInstructions(appUser);
  throw new Error("Database has no tables. Set DATABASE_MIGRATION_URL and redeploy.");
}
