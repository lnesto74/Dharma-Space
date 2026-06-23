import type { PrismaClient } from "@prisma/client";
import { normalizeProgramCategory } from "./education.js";

export const INQUIRY_SEGMENTS = [
  "CORPORATE",
  "CWP",
  "FLAGSHIP",
  "COURSE",
  "WORKSHOP",
  "EVENT",
  "REGULAR_CLASS"
] as const;

export type InquirySegment = (typeof INQUIRY_SEGMENTS)[number];

export type PaymentStatus = "WAITLIST" | "NOT_PAID" | "PAID";

export type InquiryPayload = {
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  facilitator?: string;
  price?: string;
  bookingType?: string;
  reference?: string;
  amount?: string;
  guests?: string;
  notes?: string;
  uen?: string;
  segment?: InquirySegment;
  paymentStatus?: PaymentStatus;
  siteClassId?: string;
  programCategory?: string;
  companyName?: string;
  employeeCount?: string;
  interest?: string;
  inquiryId?: string;
  paidAt?: string;
};

export function programCategoryToSegment(category: string): InquirySegment {
  const normalized = normalizeProgramCategory(category);
  if (normalized === "FLAGSHIP") return "FLAGSHIP";
  if (normalized === "WORKSHOP") return "WORKSHOP";
  if (normalized === "EVENT") return "EVENT";
  return "COURSE";
}

export function segmentLabel(segment: InquirySegment): string {
  const labels: Record<InquirySegment, string> = {
    CORPORATE: "Corporate",
    CWP: "CWP Platform",
    FLAGSHIP: "Flagship Training",
    COURSE: "Courses",
    WORKSHOP: "Workshops",
    EVENT: "Events",
    REGULAR_CLASS: "Regular Classes"
  };
  return labels[segment];
}

export function paymentTagFromSubmission(type: string, payload: InquiryPayload): PaymentStatus {
  if (payload.paymentStatus) return payload.paymentStatus;
  const upper = type.toUpperCase();
  if (upper === "WAITLIST" || upper === "CLASS_WAITLIST" || upper === "CLASS_SCHEDULE_NOTIFY") return "WAITLIST";
  if (upper === "BOOKING_CONFIRMED") return "PAID";
  if (upper === "BOOKING_PAYMENT") return "NOT_PAID";
  if (upper === "BOOKING_INTENT") return "NOT_PAID";
  return "WAITLIST";
}

export function paymentTagLabel(status: PaymentStatus): string {
  if (status === "WAITLIST") return "Waitlist";
  if (status === "NOT_PAID") return "Not paid";
  return "Paid";
}

export async function resolveInquirySegment(
  prisma: PrismaClient,
  input: {
    type: string;
    siteProgramId?: string | null;
    siteClassId?: string | null;
    context?: { segment?: InquirySegment; programCategory?: string };
  }
): Promise<InquirySegment> {
  if (input.context?.segment) return input.context.segment;
  if (input.type === "contact") return "CORPORATE";
  if (input.type === "cwp_demo") return "CWP";

  if (input.siteClassId) {
    const cls = await prisma.siteClass.findUnique({ where: { id: input.siteClassId } });
    if (cls) return "REGULAR_CLASS";
  }

  if (input.siteProgramId) {
    const program = await prisma.siteProgram.findUnique({ where: { id: input.siteProgramId } });
    if (program) return programCategoryToSegment(program.category);
  }

  if (input.context?.programCategory) {
    const cat = input.context.programCategory.toUpperCase();
    if (cat === "REGULAR_CLASS") return "REGULAR_CLASS";
    return programCategoryToSegment(input.context.programCategory);
  }

  const upper = input.type.toUpperCase();
  if (upper === "CLASS_WAITLIST" || upper === "CLASS_SCHEDULE_NOTIFY") return "REGULAR_CLASS";
  return "COURSE";
}

export async function enrichSubmissionRecord(
  prisma: PrismaClient,
  submission: {
    id: string;
    type: string;
    inbox: string;
    payload: string;
    siteProgramId?: string | null;
  }
) {
  let payload: InquiryPayload = {};
  try {
    payload = JSON.parse(submission.payload || "{}") as InquiryPayload;
  } catch {
    payload = {};
  }

  const segment =
    payload.segment ||
    (await resolveInquirySegment(prisma, {
      type: submission.type,
      siteProgramId: submission.siteProgramId,
      siteClassId: payload.siteClassId,
      context: payload
    }));

  const paymentStatus = paymentTagFromSubmission(submission.type, payload);

  return {
    segment,
    segmentLabel: segmentLabel(segment),
    paymentStatus,
    paymentTag: paymentTagLabel(paymentStatus)
  };
}
