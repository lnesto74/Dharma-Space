import type { PrismaClient } from "@prisma/client";
import { usesPostgres } from "./ensure-schema.js";
import { defaultDropInPrice } from "./schedule/pricing.js";

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
      await ensureBookingMembershipColumns(client);
      await ensureSiteClassCategory(client);
      await repriceClassesByCategory(client);
      await backfillPaymentLedger(client);
      await ensureExpiryReminderTable(client);
      await ensurePaymentKind(client);
      await ensureIntroPassColumns(client);

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
 * Links existing Booking rows to memberships. The membership tables themselves are
 * created by `prisma db push` on startup; these columns are added separately so an
 * already-populated Booking table in production picks them up without a reset.
 */
async function ensureBookingMembershipColumns(client: PrismaClient) {
  const statements = [
    `ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "membershipId" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "membershipPeriodId" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "sessionsSpent" INTEGER NOT NULL DEFAULT 0`,
    `CREATE INDEX IF NOT EXISTS "Booking_membershipId_idx" ON "Booking"("membershipId")`,
    `CREATE INDEX IF NOT EXISTS "Booking_membershipPeriodId_idx" ON "Booking"("membershipPeriodId")`
  ];
  for (const sql of statements) {
    await client.$executeRawUnsafe(sql);
  }
}

/**
 * Reads the first number out of a free-text price label ("SGD 75", "$35.50") as
 * integer cents.
 *
 * The group must stay non-capturing: substring(... from pattern) returns only
 * the first captured group when the pattern has plain parentheses, which would
 * silently yield null for a price with no decimal part.
 */
const PRICE_TO_CENTS_SQL = `
  COALESCE(
    ROUND(
      NULLIF(substring(replace(b."price", ',', '') from '[0-9]+(?:\\.[0-9]{1,2})?'), '')::numeric
      * 100
    )::int,
    0
  )
`;

/**
 * Writes a Payment row for every historical booking that predates the ledger, so
 * reports cover all takings rather than only bookings made since the change.
 * Derives provider and amount from the legacy per-booking columns.
 */
async function backfillPaymentLedger(client: PrismaClient) {
  const inserted = await client.$executeRawUnsafe(`
    INSERT INTO "Payment" (
      "id", "bookingId", "memberId", "reference", "provider", "method", "status",
      "amountCents", "currency", "providerRef", "providerPaymentRef",
      "paidAt", "refundedAt", "refundedAmountCents", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid()::text,
      b."id",
      b."memberId",
      b."reference",
      CASE b."paymentMethod"
        WHEN 'STRIPE' THEN 'STRIPE'
        WHEN 'PAYNOW' THEN 'PAYNOW'
        WHEN 'QASHIER' THEN 'QASHIER'
        WHEN 'CASH' THEN 'CASH'
        WHEN 'MEMBERSHIP' THEN 'MEMBERSHIP'
        ELSE 'MANUAL'
      END,
      CASE b."paymentMethod"
        WHEN 'STRIPE' THEN 'CARD'
        WHEN 'QASHIER' THEN 'CARD'
        WHEN 'PAYNOW' THEN 'PAYNOW'
        WHEN 'CASH' THEN 'CASH'
        WHEN 'MEMBERSHIP' THEN 'MEMBERSHIP'
        ELSE 'OTHER'
      END,
      CASE b."status"
        WHEN 'PAID' THEN 'PAID'
        WHEN 'REFUNDED' THEN 'REFUNDED'
        WHEN 'CANCELLED' THEN 'CANCELLED'
        ELSE 'PENDING'
      END,
      ${PRICE_TO_CENTS_SQL},
      'SGD',
      b."stripeSessionId",
      b."stripePaymentIntentId",
      b."paidAt",
      b."refundedAt",
      0,
      b."createdAt",
      b."updatedAt"
    FROM "Booking" b
    WHERE NOT EXISTS (SELECT 1 FROM "Payment" p WHERE p."bookingId" = b."id")
  `);
  if (inserted > 0) {
    console.log(`[startup] Payment ledger backfilled for ${inserted} existing booking(s).`);
  }

  // Repair rows left at zero by an earlier backfill whose price expression
  // failed to parse labels without a decimal part. Untouched once correct, and
  // never overwrites an amount that was set deliberately.
  const repaired = await client.$executeRawUnsafe(`
    UPDATE "Payment" p
    SET "amountCents" = src."cents"
    FROM (
      SELECT b."id" AS "bookingId", ${PRICE_TO_CENTS_SQL} AS "cents"
      FROM "Booking" b
    ) src
    WHERE p."bookingId" = src."bookingId"
      AND p."amountCents" = 0
      AND src."cents" > 0
  `);
  if (repaired > 0) {
    console.log(`[startup] Payment ledger repaired ${repaired} zero-amount row(s).`);
  }
}

/**
 * Adds SiteClass.category and classifies existing classes by name, so memberships
 * know which plans cover which weekly classes without a manual pass over the
 * schedule. Admins can correct any guess in the class editor.
 */
async function ensureSiteClassCategory(client: PrismaClient) {
  await client.$executeRawUnsafe(
    `ALTER TABLE "SiteClass" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'YOGA'`
  );
  await client.$executeRawUnsafe(
    `ALTER TABLE "SiteClass" ADD COLUMN IF NOT EXISTS "entryType" TEXT NOT NULL DEFAULT 'CLASS'`
  );
  await client.$executeRawUnsafe(
    `ALTER TABLE "SiteClass" ADD COLUMN IF NOT EXISTS "capacity" INTEGER NOT NULL DEFAULT 0`
  );

  // Only touch rows still sitting on the default, so manual corrections stick.
  const rules: [string, string][] = [
    ["AERIAL", "aerial|hammock|silk"],
    ["SOUND", "sound|gong|bowl|handpan"],
    ["DANCE", "dance|ecstatic|embodiment|movement"],
    ["MEDITATION", "meditation|mindfulness|breathwork|pranayama"]
  ];
  for (const [category, pattern] of rules) {
    await client.$executeRawUnsafe(
      `UPDATE "SiteClass" SET "category" = $1 WHERE "category" = 'YOGA' AND "classType" ~* $2`,
      category,
      pattern
    );
  }
}

/**
 * Week 1 was seeded at a flat SGD 35 before per-category prices existed. Move
 * those rows onto the real price list. Only rows still holding the old flat
 * rate are touched, so prices set in the admin editor stick.
 */
const LEGACY_FLAT_CLASS_PRICE = "SGD 35";

async function repriceClassesByCategory(client: PrismaClient) {
  for (const category of ["YOGA", "AERIAL", "DANCE", "SOUND", "CEREMONY", "MEDITATION"]) {
    const price = defaultDropInPrice(category);
    if (price === LEGACY_FLAT_CLASS_PRICE) continue;
    const updated = await client.$executeRawUnsafe(
      `UPDATE "SiteClass"
          SET "price" = $1
        WHERE "category" = $2
          AND "entryType" = 'CLASS'
          AND "price" = $3`,
      price,
      category,
      LEGACY_FLAT_CLASS_PRICE
    );
    if (updated > 0) {
      console.log(`[startup] Repriced ${updated} ${category} class(es) to ${price}.`);
    }
  }
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

/**
 * A plan that runs for a fixed number of days instead of renewing monthly.
 * Every existing plan is monthly, so the defaults leave them untouched.
 */
async function ensureIntroPassColumns(client: PrismaClient) {
  await client.$executeRawUnsafe(
    `ALTER TABLE "MembershipTier" ADD COLUMN IF NOT EXISTS "termDays" INTEGER`
  );
  await client.$executeRawUnsafe(
    `ALTER TABLE "MembershipTier" ADD COLUMN IF NOT EXISTS "introOnly" BOOLEAN NOT NULL DEFAULT false`
  );
}

/**
 * Labels what each payment was for. Existing rows are classified by what they
 * point at: a payment with a booking is a booking, and everything else that
 * predates memberships being sellable online was a credit pack.
 */
async function ensurePaymentKind(client: PrismaClient) {
  await client.$executeRawUnsafe(
    `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'BOOKING'`
  );
  await client.$executeRawUnsafe(
    `UPDATE "Payment" SET "kind" = 'CREDIT_PACK' WHERE "bookingId" IS NULL AND "kind" = 'BOOKING'`
  );
}

/**
 * The log of expiry warnings already sent. The unique index is what stops a
 * member being told three times that the same pack is running out, so it
 * matters more than the table.
 */
async function ensureExpiryReminderTable(client: PrismaClient) {
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ExpiryReminder" (
      "id" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "targetId" TEXT NOT NULL,
      "monthsOut" INTEGER NOT NULL,
      "memberId" TEXT,
      "email" TEXT NOT NULL DEFAULT '',
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ExpiryReminder_pkey" PRIMARY KEY ("id")
    )
  `);
  await client.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ExpiryReminder_kind_targetId_monthsOut_key"
      ON "ExpiryReminder"("kind", "targetId", "monthsOut")
  `);
  await client.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ExpiryReminder_memberId_idx" ON "ExpiryReminder"("memberId")
  `);
  await client.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ExpiryReminder_sentAt_idx" ON "ExpiryReminder"("sentAt")
  `);
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
