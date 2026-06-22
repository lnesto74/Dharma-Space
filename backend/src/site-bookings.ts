import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import type { PrismaClient, SiteMember } from "@prisma/client";
import { z } from "zod";
import { assertProgramHasCapacity, getProgramBookingStats } from "./program-bookings.js";
import { serializeProgram } from "./education.js";
import { serializeClass, sortClasses } from "./class-schedule.js";
import {
  createStripeCheckoutSession,
  stripeConfigured,
  verifyCheckoutSessionPaid,
  syncStripePaymentIds,
  refundStripeBooking,
  markBookingRefundedManual,
  retrieveCheckoutSession
} from "./stripe.js";
import { completeBookingPayment, sendBookingPayNowPendingEmails } from "./booking-emails.js";

export type MemberToken = { sub: string; kind: "site_member" };

export type MemberRequest = Request & { siteMember?: SiteMember };

const BOOKING_STATUSES = ["AWAITING_PAYMENT", "PAID", "CANCELLED"] as const;

function bookingReference(prefix = "DS") {
  return `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function stripeCheckoutUrl(base: string, email: string, reference: string) {
  const url = new URL(base);
  url.searchParams.set("prefilled_email", email);
  url.searchParams.set("client_reference_id", reference);
  return url.toString();
}

export function serializeBooking(booking: {
  id: string;
  reference: string;
  memberId: string | null;
  siteProgramId: string | null;
  siteClassId: string | null;
  offeringType: string;
  offeringTitle: string;
  category: string;
  scheduledLabel: string;
  time: string;
  location: string;
  facilitator: string;
  price: string;
  guests: number;
  notes: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  status: string;
  paymentMethod: string | null;
  stripeCheckoutUrl: string | null;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const refundable =
    booking.status === "PAID" &&
    !booking.refundedAt &&
    (booking.paymentMethod === "STRIPE" || booking.paymentMethod === "PAYNOW");

  return {
    id: booking.id,
    reference: booking.reference,
    memberId: booking.memberId,
    siteProgramId: booking.siteProgramId,
    siteClassId: booking.siteClassId,
    offeringType: booking.offeringType,
    offeringTitle: booking.offeringTitle,
    category: booking.category,
    scheduledLabel: booking.scheduledLabel,
    time: booking.time,
    location: booking.location,
    facilitator: booking.facilitator,
    price: booking.price,
    guests: booking.guests,
    notes: booking.notes,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone,
    status: booking.status,
    paymentMethod: booking.paymentMethod,
    stripeCheckoutUrl: booking.stripeCheckoutUrl,
    paidAt: booking.paidAt?.toISOString() ?? null,
    refundedAt: booking.refundedAt?.toISOString() ?? null,
    refundable,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
    paymentStatus:
      booking.status === "REFUNDED"
        ? "REFUNDED"
        : booking.status === "CANCELLED"
          ? "CANCELLED"
          : booking.status === "PAID"
            ? "PAID"
            : "NOT_PAID"
  };
}

export function signMemberToken(member: SiteMember, jwtSecret: string) {
  return jwt.sign({ sub: member.id, kind: "site_member" } satisfies MemberToken, jwtSecret, {
    expiresIn: "30d"
  });
}

export function sanitizeMember(member: SiteMember) {
  const { passwordHash, ...safe } = member;
  return safe;
}

export function createMemberAuth(prisma: PrismaClient, jwtSecret: string) {
  return async (req: MemberRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Please sign in to continue." });
    }
    try {
      const payload = jwt.verify(header.slice(7), jwtSecret) as MemberToken;
      if (payload.kind !== "site_member") {
        return res.status(401).json({ message: "Invalid member session." });
      }
      const member = await prisma.siteMember.findUnique({ where: { id: payload.sub } });
      if (!member) return res.status(401).json({ message: "Account not found." });
      req.siteMember = member;
      next();
    } catch {
      res.status(401).json({ message: "Session expired. Please sign in again." });
    }
  };
}

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const createBookingSchema = z.object({
  siteProgramId: z.string().optional(),
  siteClassId: z.string().optional(),
  guests: z.number().int().min(1).max(10).optional(),
  notes: z.string().optional(),
  paymentMethod: z.enum(["STRIPE", "PAYNOW"]).optional()
});

async function loadOffering(prisma: PrismaClient, input: { siteProgramId?: string; siteClassId?: string }) {
  if (input.siteProgramId) {
    const program = await prisma.siteProgram.findUnique({ where: { id: input.siteProgramId } });
    if (!program || !program.published) throw Object.assign(new Error("Program not found"), { status: 404 });
    if (program.comingSoon) throw Object.assign(new Error("This offering is not open for booking yet."), { status: 400 });
    const stats = await getProgramBookingStats(prisma, program);
    if (stats.finished) throw Object.assign(new Error("This session has finished."), { status: 400 });
    if (stats.soldOut) throw Object.assign(new Error("This session is sold out."), { status: 400 });
    return {
      offeringType: "PROGRAM" as const,
      siteProgramId: program.id,
      siteClassId: null as string | null,
      offeringTitle: program.title,
      category: program.category,
      scheduledLabel: program.dates,
      time: program.time,
      location: program.location,
      facilitator: program.facilitator,
      price: program.price,
      stripeLink: program.stripeLink,
      usePayNow: program.usePayNow,
      depositAmount: program.depositAmount
    };
  }

  if (input.siteClassId) {
    const siteClass = await prisma.siteClass.findUnique({ where: { id: input.siteClassId } });
    if (!siteClass || !siteClass.published) throw Object.assign(new Error("Class not found"), { status: 404 });
    if (siteClass.comingSoon) throw Object.assign(new Error("This class is not open for booking yet."), { status: 400 });
    const scheduledLabel = siteClass.classDate
      ? `${siteClass.day}, ${siteClass.classDate}`
      : siteClass.day;
    return {
      offeringType: "CLASS" as const,
      siteProgramId: null as string | null,
      siteClassId: siteClass.id,
      offeringTitle: siteClass.classType,
      category: "REGULAR_CLASS",
      scheduledLabel,
      time: siteClass.time,
      location: siteClass.location,
      facilitator: siteClass.instructor,
      price: siteClass.price,
      stripeLink: siteClass.stripeLink,
      usePayNow: false,
      depositAmount: null as string | null
    };
  }

  throw Object.assign(new Error("Choose a program or class to book."), { status: 400 });
}

const ACTIVE_BOOKING_STATUSES = ["AWAITING_PAYMENT", "PAID"] as const;

export async function assertMemberHasNoActiveBooking(
  prisma: PrismaClient,
  memberId: string,
  offering: { siteProgramId: string | null; siteClassId: string | null; offeringTitle: string }
) {
  if (!offering.siteProgramId && !offering.siteClassId) return;

  const existing = await prisma.booking.findFirst({
    where: {
      memberId,
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
      ...(offering.siteProgramId ? { siteProgramId: offering.siteProgramId } : { siteClassId: offering.siteClassId })
    }
  });

  if (existing) {
    throw Object.assign(
      new Error(`You already have a booking for ${offering.offeringTitle}. See My account → My bookings.`),
      { status: 409 }
    );
  }
}

export async function getBookableOfferings(prisma: PrismaClient) {
  const [programs, classes] = await Promise.all([
    prisma.siteProgram.findMany({ where: { published: true }, orderBy: { sortOrder: "asc" } }),
    prisma.siteClass.findMany({ where: { published: true }, orderBy: [{ dayIndex: "asc" }, { startMinutes: "asc" }] })
  ]);

  const enrichedPrograms = await Promise.all(
    programs.map(async (program) => ({
      ...serializeProgram(program),
      offeringType: "PROGRAM" as const,
      bookable: !program.comingSoon,
      ...(await getProgramBookingStats(prisma, program))
    }))
  );

  return {
    programs: enrichedPrograms,
    classes: sortClasses(classes.map(serializeClass)).map((siteClass) => ({
      ...siteClass,
      offeringType: "CLASS" as const,
      bookable: !siteClass.comingSoon
    }))
  };
}

export async function createSiteBooking(
  prisma: PrismaClient,
  member: SiteMember,
  input: z.infer<typeof createBookingSchema>
) {
  const guests = input.guests ?? 1;
  const offering = await loadOffering(prisma, input);

  if (offering.siteProgramId) {
    await assertProgramHasCapacity(prisma, offering.siteProgramId, guests);
  }

  await assertMemberHasNoActiveBooking(prisma, member.id, offering);

  const paymentMethod = input.paymentMethod ?? (offering.usePayNow && !stripeConfigured() ? "PAYNOW" : "STRIPE");
  const reference = bookingReference();
  const priceLabel = offering.depositAmount || offering.price;

  let checkoutUrl: string | null = null;
  let stripeSessionId: string | null = null;
  if (paymentMethod === "STRIPE") {
    if (stripeConfigured()) {
      const session = await createStripeCheckoutSession({
        reference,
        email: member.email,
        title: offering.offeringTitle,
        subtitle: [offering.scheduledLabel, offering.time].filter(Boolean).join(" · "),
        priceLabel,
        guests,
        siteProgramId: offering.siteProgramId,
        siteClassId: offering.siteClassId
      });
      checkoutUrl = session?.url ?? null;
      stripeSessionId = session?.sessionId ?? null;
    } else if (offering.stripeLink?.trim()) {
      checkoutUrl = stripeCheckoutUrl(offering.stripeLink, member.email, reference);
    }
    if (!checkoutUrl) {
      throw Object.assign(new Error("Online payment is not available for this offering yet."), { status: 400 });
    }
  }

  const booking = await prisma.booking.create({
    data: {
      reference,
      memberId: member.id,
      siteProgramId: offering.siteProgramId,
      siteClassId: offering.siteClassId,
      offeringType: offering.offeringType,
      offeringTitle: offering.offeringTitle,
      category: offering.category,
      scheduledLabel: offering.scheduledLabel,
      time: offering.time,
      location: offering.location,
      facilitator: offering.facilitator,
      price: offering.depositAmount || offering.price,
      guests,
      notes: input.notes?.trim() || null,
      customerName: member.name,
      customerEmail: member.email,
      customerPhone: member.phone,
      status: "AWAITING_PAYMENT",
      paymentMethod,
      stripeCheckoutUrl: checkoutUrl,
      stripeSessionId
    }
  });

  if (paymentMethod === "PAYNOW") {
    await sendBookingPayNowPendingEmails(booking).catch((error) => {
      console.error("[booking-mail] PayNow pending email failed:", error);
    });
  }

  return {
    booking: serializeBooking(booking),
    checkoutUrl,
    payNowAmount: paymentMethod === "PAYNOW" ? offering.depositAmount || offering.price : null
  };
}

export async function getAdminBookingOverview(prisma: PrismaClient) {
  const bookings = await prisma.booking.findMany({ orderBy: { createdAt: "desc" } });
  const grouped = new Map<string, {
    key: string;
    offeringType: string;
    offeringTitle: string;
    category: string;
    scheduledLabel: string;
    siteProgramId: string | null;
    siteClassId: string | null;
    paidCount: number;
    unpaidCount: number;
    guestTotal: number;
    bookings: ReturnType<typeof serializeBooking>[];
  }>();

  for (const row of bookings) {
    const key = row.siteProgramId ? `program:${row.siteProgramId}` : `class:${row.siteClassId}`;
    const entry = grouped.get(key) ?? {
      key,
      offeringType: row.offeringType,
      offeringTitle: row.offeringTitle,
      category: row.category,
      scheduledLabel: row.scheduledLabel,
      siteProgramId: row.siteProgramId,
      siteClassId: row.siteClassId,
      paidCount: 0,
      unpaidCount: 0,
      guestTotal: 0,
      bookings: []
    };
    const serialized = serializeBooking(row);
    entry.bookings.push(serialized);
    entry.guestTotal += row.guests;
    if (row.status === "PAID") entry.paidCount += row.guests;
    else if (row.status === "AWAITING_PAYMENT") entry.unpaidCount += row.guests;
    grouped.set(key, entry);
  }

  return {
    totals: {
      bookings: bookings.length,
      paid: bookings.filter((b) => b.status === "PAID").length,
      awaitingPayment: bookings.filter((b) => b.status === "AWAITING_PAYMENT").length
    },
    offerings: [...grouped.values()].sort((a, b) => a.offeringTitle.localeCompare(b.offeringTitle))
  };
}

export function registerSiteBookingRoutes(
  app: import("express").Express,
  prisma: PrismaClient,
  jwtSecret: string,
  adminAuth: (req: Request, res: Response, next: NextFunction) => void,
  requireAdmin: (req: Request, res: Response, next: NextFunction) => void
) {
  const memberAuth = createMemberAuth(prisma, jwtSecret);

  app.post("/api/member/register", async (req, res, next) => {
    try {
      const body = registerSchema.parse(req.body);
      const existing = await prisma.siteMember.findUnique({ where: { email: body.email.toLowerCase() } });
      if (existing) return res.status(409).json({ message: "An account with this email already exists." });
      const member = await prisma.siteMember.create({
        data: {
          name: body.name.trim(),
          email: body.email.toLowerCase(),
          phone: body.phone?.trim() || null,
          passwordHash: await bcrypt.hash(body.password, 12)
        }
      });
      res.status(201).json({
        token: signMemberToken(member, jwtSecret),
        member: sanitizeMember(member)
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/member/login", async (req, res, next) => {
    try {
      const body = loginSchema.parse(req.body);
      const member = await prisma.siteMember.findUnique({ where: { email: body.email.toLowerCase() } });
      if (!member || !(await bcrypt.compare(body.password, member.passwordHash))) {
        return res.status(401).json({ message: "Invalid email or password." });
      }
      res.json({
        token: signMemberToken(member, jwtSecret),
        member: sanitizeMember(member)
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/member/me", memberAuth, async (req: MemberRequest, res, next) => {
    try {
      const body = z
        .object({
          name: z.string().min(2).optional(),
          phone: z.string().optional().nullable()
        })
        .parse(req.body);
      const updated = await prisma.siteMember.update({
        where: { id: req.siteMember!.id },
        data: {
          ...(body.name ? { name: body.name.trim() } : {}),
          ...(body.phone !== undefined ? { phone: body.phone?.trim() || null } : {})
        }
      });
      res.json({ member: sanitizeMember(updated) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/member/bookings/confirm-return", memberAuth, async (req: MemberRequest, res, next) => {
    try {
      const body = z
        .object({
          reference: z.string().min(3),
          sessionId: z.string().optional()
        })
        .parse(req.body);
      const booking = await prisma.booking.findFirst({
        where: { reference: body.reference, memberId: req.siteMember!.id }
      });
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.status === "PAID") {
        return res.json({ booking: serializeBooking(booking), alreadyPaid: true });
      }
      if (body.sessionId) {
        const paid = await verifyCheckoutSessionPaid(body.sessionId, body.reference);
        if (!paid) {
          return res.status(402).json({ message: "Payment not completed yet. Please wait a moment and refresh." });
        }
        const session = await retrieveCheckoutSession(body.sessionId);
        if (session) await syncStripePaymentIds(prisma, body.reference, session);
      }
      const updated = await completeBookingPayment(prisma, body.reference, booking.paymentMethod || "STRIPE");
      if (!updated) return res.status(404).json({ message: "Booking not found" });
      res.json({ booking: serializeBooking(updated) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/member/me", memberAuth, (req: MemberRequest, res) => {
    res.json({ member: sanitizeMember(req.siteMember!) });
  });

  app.get("/api/member/offerings", async (_req, res, next) => {
    try {
      res.json(await getBookableOfferings(prisma));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/member/bookings", memberAuth, async (req: MemberRequest, res, next) => {
    try {
      const rows = await prisma.booking.findMany({
        where: { memberId: req.siteMember!.id },
        orderBy: { createdAt: "desc" }
      });
      res.json({ bookings: rows.map(serializeBooking) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/member/bookings", memberAuth, async (req: MemberRequest, res, next) => {
    try {
      const body = createBookingSchema.parse(req.body);
      const result = await createSiteBooking(prisma, req.siteMember!, body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/bookings/overview", adminAuth, requireAdmin, async (_req, res, next) => {
    try {
      res.json(await getAdminBookingOverview(prisma));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/bookings", adminAuth, requireAdmin, async (req, res, next) => {
    try {
      const siteProgramId = typeof req.query.siteProgramId === "string" ? req.query.siteProgramId : undefined;
      const siteClassId = typeof req.query.siteClassId === "string" ? req.query.siteClassId : undefined;
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const rows = await prisma.booking.findMany({
        where: {
          ...(siteProgramId ? { siteProgramId } : {}),
          ...(siteClassId ? { siteClassId } : {}),
          ...(status && BOOKING_STATUSES.includes(status as typeof BOOKING_STATUSES[number]) ? { status } : {})
        },
        orderBy: { createdAt: "desc" }
      });
      res.json({ bookings: rows.map(serializeBooking) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/bookings/:id/mark-paid", adminAuth, requireAdmin, async (req, res, next) => {
    try {
      const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.status === "PAID") {
        return res.json({ booking: serializeBooking(booking), alreadyPaid: true });
      }
      const updated = await completeBookingPayment(prisma, booking.reference, "PAYNOW");
      if (!updated) return res.status(404).json({ message: "Booking not found" });
      res.json({ booking: serializeBooking(updated) });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/bookings/:id/cancel", adminAuth, requireAdmin, async (req, res, next) => {
    try {
      const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.status === "CANCELLED" || booking.status === "REFUNDED") {
        return res.status(409).json({ message: "Booking is already cancelled or refunded." });
      }
      if (booking.status === "PAID") {
        return res.status(400).json({
          message: "Paid bookings must be refunded before cancelling. Use Refund for Stripe/PayNow payments."
        });
      }
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED" }
      });
      res.json({ booking: serializeBooking(updated) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/bookings/:id/refund", adminAuth, requireAdmin, async (req, res, next) => {
    try {
      const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
      if (!booking) return res.status(404).json({ message: "Booking not found" });

      let updated;
      if (booking.paymentMethod === "STRIPE") {
        updated = await refundStripeBooking(prisma, booking);
      } else if (booking.paymentMethod === "PAYNOW") {
        updated = await markBookingRefundedManual(prisma, booking.id);
      } else {
        return res.status(400).json({
          message: "Only Stripe or PayNow bookings can be refunded from here."
        });
      }

      res.json({
        booking: serializeBooking(updated),
        message:
          booking.paymentMethod === "PAYNOW"
            ? "Marked as refunded. Send the PayNow refund to the customer manually."
            : "Stripe refund processed."
      });
    } catch (error) {
      next(error);
    }
  });
}
