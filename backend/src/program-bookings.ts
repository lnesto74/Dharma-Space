import type { PrismaClient } from "@prisma/client";
import { isProgramFinished, isSessionProgram } from "./program-schedule.js";

const BOOKING_TYPES = ["BOOKING_INTENT", "BOOKING_PAYMENT"] as const;

export function parseClassSizeCapacity(classSize: string | null | undefined): number | null {
  const trimmed = String(classSize ?? "").trim();
  if (!trimmed) return null;
  const direct = Number(trimmed);
  if (!Number.isNaN(direct) && direct > 0) return Math.floor(direct);
  const match = trimmed.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function guestCountFromPayload(payload: string): number {
  try {
    const parsed = JSON.parse(payload || "{}") as { guests?: string };
    const raw = String(parsed.guests ?? "1");
    if (raw === "5+") return 5;
    const n = Number.parseInt(raw, 10);
    return Number.isNaN(n) ? 1 : Math.max(1, n);
  } catch {
    return 1;
  }
}

export async function countProgramBookings(prisma: PrismaClient, programId: string): Promise<number> {
  const rows = await prisma.formSubmission.findMany({
    where: {
      siteProgramId: programId,
      type: { in: [...BOOKING_TYPES] }
    },
    select: { payload: true }
  });

  return rows.reduce((sum, row) => sum + guestCountFromPayload(row.payload), 0);
}

export function computeProgramSoldOut(input: {
  category: string;
  classSize?: string | null;
  comingSoon?: boolean;
  finished?: boolean;
  bookingCount: number;
}): boolean {
  if (input.comingSoon || input.finished) return false;
  if (!isSessionProgram(input.category)) return false;
  const capacity = parseClassSizeCapacity(input.classSize);
  if (!capacity) return false;
  return input.bookingCount >= capacity;
}

export async function getProgramBookingStats(
  prisma: PrismaClient,
  program: { id: string; category: string; classSize?: string | null; comingSoon?: boolean; scheduledDate?: string; startMinutes?: number; dates?: string; duration?: string }
) {
  const bookingCount = await countProgramBookings(prisma, program.id);
  const capacity = parseClassSizeCapacity(program.classSize);
  const finished = isProgramFinished(program);
  const soldOut = computeProgramSoldOut({
    category: program.category,
    classSize: program.classSize,
    comingSoon: program.comingSoon,
    finished,
    bookingCount
  });

  return {
    bookingCount,
    capacity,
    spotsRemaining: capacity != null ? Math.max(0, capacity - bookingCount) : null,
    soldOut,
    finished,
    status: finished ? "FINISHED" as const : program.comingSoon ? "COMING_SOON" as const : "SCHEDULED" as const
  };
}

export async function assertProgramHasCapacity(
  prisma: PrismaClient,
  programId: string,
  guests = 1
): Promise<void> {
  const program = await prisma.siteProgram.findUnique({ where: { id: programId } });
  if (!program) return;

  const stats = await getProgramBookingStats(prisma, program);
  if (!stats.capacity || !isSessionProgram(program.category) || program.comingSoon || stats.finished) return;

  if (stats.bookingCount + guests > stats.capacity) {
    throw new Error("This workshop is sold out.");
  }
}

export function normalizeProgramPrice(price: string | undefined): string {
  const trimmed = String(price ?? "").trim();
  if (!trimmed) return "";
  if (/^SGD\s/i.test(trimmed)) return trimmed.replace(/^SGD\s+/i, "SGD ");
  const amount = trimmed.replace(/[^\d.,]/g, "").replace(/,/g, "");
  return amount ? `SGD ${amount}` : "";
}
