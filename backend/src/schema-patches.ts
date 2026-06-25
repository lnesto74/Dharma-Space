import type { PrismaClient } from "@prisma/client";
import { usesPostgres } from "./ensure-schema.js";

/**
 * Idempotent SQL patches when prisma db push cannot run (e.g. DO app user lacks DDL).
 * Uses DATABASE_MIGRATION_URL when set, otherwise DATABASE_URL.
 */
export async function applySchemaPatches(): Promise<void> {
  if (!usesPostgres()) return;

  const patchUrl = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
  if (!patchUrl) return;

  const { PrismaClient } = await import("@prisma/client");
  const client = new PrismaClient({ datasources: { db: { url: patchUrl } } });

  try {
    await client.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountStatus" TEXT NOT NULL DEFAULT 'APPROVED'`
    );
    await client.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT true`
    );
    await client.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "position" TEXT`
    );

    await ensureDuelTables(client);

    console.log("[startup] Incremental schema patches applied.");
  } catch (error) {
    console.warn("[startup] Incremental schema patches failed:", error);
    console.warn(
      "[startup] Set DATABASE_MIGRATION_URL (doadmin URI) on App Platform so startup can ALTER tables."
    );
  } finally {
    await client.$disconnect();
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
