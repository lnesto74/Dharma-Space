import type { PrismaClient } from "@prisma/client";
import { usesPostgres } from "./ensure-schema.js";

const REQUIRED_USER_COLUMNS = ["accountStatus", "onboardingCompleted", "position"] as const;

function candidateUrls(): string[] {
  // Prefer the doadmin/migration URL (full DDL), then fall back to the app URL.
  // The app user usually owns the User table and can ALTER it, so this works
  // even when DATABASE_MIGRATION_URL is not set.
  const urls = [process.env.DATABASE_MIGRATION_URL, process.env.DATABASE_URL].filter(
    (u): u is string => Boolean(u)
  );
  return [...new Set(urls)];
}

async function missingUserColumns(client: PrismaClient): Promise<string[]> {
  const rows = await client.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User'
      AND column_name IN ('accountStatus', 'onboardingCompleted', 'position')
  `;
  const present = new Set(rows.map((r) => r.column_name));
  return REQUIRED_USER_COLUMNS.filter((c) => !present.has(c));
}

async function applyUserColumns(client: PrismaClient): Promise<void> {
  await client.$executeRawUnsafe(
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountStatus" TEXT NOT NULL DEFAULT 'APPROVED'`
  );
  await client.$executeRawUnsafe(
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT true`
  );
  await client.$executeRawUnsafe(
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "position" TEXT`
  );
}

/**
 * Idempotent SQL patches so login/onboarding queries never hit a missing column.
 * Tries DATABASE_MIGRATION_URL first, then DATABASE_URL, and verifies the columns
 * actually exist afterwards. Logs a loud, actionable warning if they are still missing.
 */
export async function applySchemaPatches(): Promise<void> {
  if (!usesPostgres()) return;

  const urls = candidateUrls();
  if (!urls.length) return;

  const { PrismaClient } = await import("@prisma/client");
  let lastError: unknown;

  for (const url of urls) {
    const label = url === process.env.DATABASE_MIGRATION_URL ? "DATABASE_MIGRATION_URL" : "DATABASE_URL";
    const client = new PrismaClient({ datasources: { db: { url } } });
    try {
      const before = await missingUserColumns(client);
      if (before.length > 0) {
        console.log(`[startup] Adding missing User columns (${before.join(", ")}) via ${label}…`);
        await applyUserColumns(client);
      }
      await ensureDuelTables(client);
      await ensureCategoryGroups(client);

      const after = await missingUserColumns(client);
      if (after.length === 0) {
        console.log("[startup] Schema patches verified — User auth columns present.");
        return;
      }
      lastError = new Error(`Columns still missing after ALTER via ${label}: ${after.join(", ")}`);
      console.warn(`[startup] ${(lastError as Error).message}`);
    } catch (error) {
      lastError = error;
      console.warn(`[startup] Schema patches failed via ${label}:`, error);
    } finally {
      await client.$disconnect();
    }
  }

  console.error(
    "[startup] CRITICAL: required User columns are missing and could not be added. " +
      "Login will fail until fixed. Set DATABASE_MIGRATION_URL to the doadmin connection " +
      "string (DO → Databases → dharma-space-db → Connection details, direct port 25060, " +
      "database 'dharma') and redeploy, or run the ALTER TABLE statements manually.",
    lastError
  );
}

/**
 * Adds the WellnessEventCategory.group column and backfills known categories into
 * their Regular / Signature / Experience family so the CWP admin can group bookings
 * without needing a manual re-seed in production.
 */
async function ensureCategoryGroups(client: PrismaClient) {
  await client.$executeRawUnsafe(
    `ALTER TABLE "WellnessEventCategory" ADD COLUMN IF NOT EXISTS "group" TEXT NOT NULL DEFAULT 'SIGNATURE'`
  );

  const groupsByName: Record<string, string[]> = {
    REGULAR: ["Yoga Class", "Meditation Class", "Pilates"],
    EXPERIENCE: ["Team Building Activity"],
    SIGNATURE: [
      "Breathwork",
      "Sound Healing Session",
      "Wellness Talk & Workshop",
      "Wellness Lecture",
      "Ayurveda Talk",
      "Leadership Talk"
    ]
  };

  for (const [group, names] of Object.entries(groupsByName)) {
    await client.$executeRawUnsafe(
      `UPDATE "WellnessEventCategory" SET "group" = $1 WHERE "name" = ANY($2::text[])`,
      group,
      names
    );
  }
}

async function ensureDuelTables(client: PrismaClient) {
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Duel" (
      "id" TEXT NOT NULL,
      "companyId" TEXT,
      "challengerId" TEXT NOT NULL,
      "opponentId" TEXT NOT NULL,
      "typeId" TEXT NOT NULL,
      "target" INTEGER NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'invited',
      "timerEndsAt" TIMESTAMP(3),
      "timerDone" BOOLEAN NOT NULL DEFAULT false,
      "challengerPoints" INTEGER NOT NULL DEFAULT 0,
      "opponentPoints" INTEGER NOT NULL DEFAULT 0,
      "dismissedBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Duel_pkey" PRIMARY KEY ("id")
    )
  `);

  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DuelWitness" (
      "id" TEXT NOT NULL,
      "duelId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "response" TEXT NOT NULL DEFAULT 'pending',
      "challengerVote" TEXT NOT NULL DEFAULT 'pending',
      "opponentVote" TEXT NOT NULL DEFAULT 'pending',
      CONSTRAINT "DuelWitness_pkey" PRIMARY KEY ("id")
    )
  `);

  await client.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "DuelWitness_duelId_userId_key" ON "DuelWitness"("duelId", "userId")
  `);
  await client.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Duel_challengerId_idx" ON "Duel"("challengerId")
  `);
  await client.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Duel_opponentId_idx" ON "Duel"("opponentId")
  `);
  await client.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "DuelWitness_userId_idx" ON "DuelWitness"("userId")
  `);
}
