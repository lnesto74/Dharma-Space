import type { Booking, PrismaClient } from "@prisma/client";
import { programCategoryToSegment, segmentLabel, type InquirySegment } from "./inquiry-meta.js";
import { inboxFor, isMailConfigured, notifyInbox, sendMail } from "./mail.js";
import { providerFromLegacyMethod, settlePayment } from "./payments/ledger.js";
import { parsePriceToCents } from "./payments/money.js";
import { STUDIO_ADDRESS, buildIcs, icsFilename, singaporeInstant } from "./calendar-invite.js";

type BookingMail = Pick<
  Booking,
  | "reference"
  | "offeringTitle"
  | "scheduledLabel"
  | "time"
  | "location"
  | "facilitator"
  | "price"
  | "guests"
  | "notes"
  | "customerName"
  | "customerEmail"
  | "customerPhone"
  | "category"
  | "siteProgramId"
  | "siteClassId"
  | "paymentMethod"
>;

function bookingSegment(booking: BookingMail): InquirySegment {
  if (booking.category === "REGULAR_CLASS") return "REGULAR_CLASS";
  return programCategoryToSegment(booking.category);
}

/** How it was paid, in words a customer would use rather than our enum. */
function paymentLabel(method: string | null): string | null {
  switch (method) {
    case "MEMBERSHIP":
      return "Included in your membership";
    case "CREDITS":
      return "Paid with class credits";
    case "STRIPE":
      return "Paid online";
    case "PAYNOW":
      return "PayNow";
    case "CASH":
      return "Cash";
    default:
      return method;
  }
}

function bookingDetailsBlock(booking: BookingMail) {
  return [
    booking.offeringTitle ? `Title: ${booking.offeringTitle}` : null,
    booking.scheduledLabel ? `Date: ${booking.scheduledLabel}` : null,
    booking.time ? `Time: ${booking.time}` : null,
    booking.location ? `Address: ${booking.location}` : null,
    booking.facilitator ? `Facilitator: ${booking.facilitator}` : null,
    booking.price ? `Price: ${booking.price}` : null,
    booking.guests ? `Guests: ${booking.guests}` : null,
    booking.reference ? `Reference: ${booking.reference}` : null,
    paymentLabel(booking.paymentMethod) ? `Payment: ${paymentLabel(booking.paymentMethod)}` : null,
    booking.customerPhone ? `Phone: ${booking.customerPhone}` : null,
    booking.notes ? `Notes: ${booking.notes}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendTeamAndCustomer(
  booking: BookingMail,
  teamSubject: string,
  teamIntro: string,
  customerSubject: string,
  customerBody: string
) {
  const category = "education" as const;
  if (!isMailConfigured(category)) {
    console.warn("[booking-mail] Education SMTP not configured — skipped:", booking.reference);
    return false;
  }

  const segment = bookingSegment(booking);
  const details = bookingDetailsBlock(booking);
  const inbox = inboxFor(category);
  const notify = notifyInbox();
  const ccVera = notify && notify.toLowerCase() !== inbox.toLowerCase() ? notify : undefined;

  const teamBody = [
    teamIntro,
    "",
    `Segment: ${segment} (${segmentLabel(segment)})`,
    `Name: ${booking.customerName}`,
    `Email: ${booking.customerEmail}`,
    "",
    details,
    booking.siteProgramId ? `\nProgram ID: ${booking.siteProgramId}` : null,
    booking.siteClassId ? `Class ID: ${booking.siteClassId}` : null
  ]
    .filter(Boolean)
    .join("\n");

  const teamSent = await sendMail(category, {
    to: inbox,
    cc: ccVera,
    replyTo: booking.customerEmail,
    subject: teamSubject,
    text: teamBody
  });
  const customerSent = await sendMail(category, {
    to: booking.customerEmail,
    replyTo: inbox,
    subject: customerSubject,
    text: customerBody
  });

  if (teamSent && customerSent) {
    console.log("[booking-mail] Sent for", booking.reference);
  } else {
    console.warn("[booking-mail] Partial/failed send for", booking.reference, { teamSent, customerSent });
  }

  return teamSent && customerSent;
}

export async function sendBookingConfirmedEmails(booking: BookingMail) {
  const whatsapp = process.env.WHATSAPP_URL || "https://wa.me/6598664331";
  const details = bookingDetailsBlock(booking);
  const customerBody = [
    `Hi ${booking.customerName},`,
    "",
    "Thank you for choosing Dharma Space.",
    "",
    "Your booking is confirmed. We look forward to seeing you.",
    "",
    details,
    "",
    "This email serves as your confirmation and receipt.",
    "",
    `WhatsApp: ${whatsapp}`,
    "",
    "Warm regards,",
    "Dharma Space Team"
  ].join("\n");

  return sendTeamAndCustomer(
    booking,
    `Booking confirmed & paid: ${booking.offeringTitle}`,
    "A new booking has been paid and confirmed.",
    `Booking confirmed — ${booking.offeringTitle}`,
    customerBody
  );
}

export async function sendBookingPayNowPendingEmails(booking: BookingMail) {
  const whatsapp = process.env.WHATSAPP_URL || "https://wa.me/6598664331";
  const uen = process.env.PAYNOW_UEN || "";
  const details = bookingDetailsBlock(booking);
  const customerBody = [
    `Hi ${booking.customerName},`,
    "",
    "Thank you for choosing Dharma Space.",
    "",
    `Your booking for ${booking.offeringTitle} is recorded.`,
    "",
    details,
    "",
    `Include reference "${booking.reference}" in your PayNow transfer${uen ? ` to UEN ${uen}` : ""}. We'll confirm payment within a few hours.`,
    "",
    `WhatsApp: ${whatsapp}`,
    "",
    "Dharma Space Team"
  ].join("\n");

  return sendTeamAndCustomer(
    booking,
    `PayNow booking (awaiting payment): ${booking.offeringTitle}`,
    "A new PayNow booking is awaiting payment.",
    `Booking received — ${booking.offeringTitle}`,
    customerBody
  );
}

/**
 * The exact moment a booking starts, from whichever row it was booked against.
 * Returns null when the offering has no fixed date yet — a "Coming Soon"
 * program has nothing to put in a calendar.
 */
async function bookingOccurrence(
  prisma: PrismaClient,
  booking: { siteClassId: string | null; siteProgramId: string | null }
): Promise<{ start: Date; durationMinutes: number; room: string } | null> {
  if (booking.siteClassId) {
    const siteClass = await prisma.siteClass.findUnique({ where: { id: booking.siteClassId } });
    if (!siteClass) return null;
    const start = singaporeInstant(siteClass.classDate, siteClass.startMinutes);
    if (!start) return null;
    return { start, durationMinutes: siteClass.durationMinutes || 60, room: siteClass.location };
  }

  if (booking.siteProgramId) {
    const program = await prisma.siteProgram.findUnique({ where: { id: booking.siteProgramId } });
    if (!program) return null;
    const start = singaporeInstant(program.scheduledDate, program.startMinutes);
    if (!start) return null;
    // Programs run to their own published schedule; block a nominal two hours
    // so the entry is visible without pretending to know the finish time.
    return { start, durationMinutes: 120, room: program.location };
  }

  return null;
}

/**
 * The second email: the booking as a calendar entry. Sent separately from the
 * confirmation so the receipt stays readable and the .ics is easy to find.
 */
export async function sendBookingCalendarInvite(prisma: PrismaClient, booking: Booking) {
  const category = "education" as const;
  if (!isMailConfigured(category)) return false;

  const occurrence = await bookingOccurrence(prisma, booking);
  if (!occurrence) {
    // Nothing to put in a calendar — a program with no date set yet.
    console.log("[booking-mail] no fixed date, calendar invite skipped:", booking.reference);
    return false;
  }

  const inbox = inboxFor(category);
  const location = [occurrence.room, STUDIO_ADDRESS].filter(Boolean).join(" · ");
  const ics = buildIcs({
    uid: `${booking.reference}@dharma-space.com`,
    title: `${booking.offeringTitle} · Dharma Space`,
    description: [
      booking.facilitator ? `With ${booking.facilitator}` : null,
      `Reference: ${booking.reference}`,
      `Questions: ${inbox}`
    ]
      .filter(Boolean)
      .join("\n"),
    location,
    start: occurrence.start,
    durationMinutes: occurrence.durationMinutes,
    organizerName: "Dharma Space",
    organizerEmail: inbox
  });

  const sent = await sendMail(category, {
    to: booking.customerEmail,
    replyTo: inbox,
    subject: `Add to your calendar — ${booking.offeringTitle}`,
    text: [
      `Hi ${booking.customerName},`,
      "",
      "Here's your class as a calendar entry — open the attachment to add it.",
      "",
      `${booking.offeringTitle}`,
      `${booking.scheduledLabel}${booking.time ? ` · ${booking.time}` : ""}`,
      location,
      "",
      "We've set a reminder for an hour before, and we'll see you on the mat.",
      "",
      "Dharma Space Team"
    ].join("\n"),
    attachments: [
      {
        filename: icsFilename(booking.reference),
        content: ics,
        contentType: "text/calendar; charset=utf-8; method=PUBLISH"
      }
    ]
  });

  console.log(
    sent
      ? `[booking-mail] Calendar invite sent for ${booking.reference}`
      : `[booking-mail] Calendar invite failed for ${booking.reference}`
  );
  return sent;
}

/**
 * Everything a confirmed booking should send: the confirmation and receipt,
 * then the calendar entry. Every rail that confirms a booking goes through
 * here, so a class booked on a membership is treated the same as one paid for.
 */
export async function sendBookingConfirmation(prisma: PrismaClient, booking: Booking) {
  await sendBookingConfirmedEmails(booking).catch((error) => {
    console.error("[booking-mail] confirmation failed:", error);
  });
  await sendBookingCalendarInvite(prisma, booking).catch((error) => {
    console.error("[booking-mail] calendar invite failed:", error);
  });
}

/** Mark booking paid once and send confirmation emails (idempotent). */
export async function completeBookingPayment(
  prisma: PrismaClient,
  reference: string,
  paymentMethod = "STRIPE"
) {
  const transitioned = await prisma.booking.updateMany({
    where: { reference, status: "AWAITING_PAYMENT" },
    data: { status: "PAID", paidAt: new Date(), paymentMethod }
  });

  const booking = await prisma.booking.findUnique({ where: { reference } });
  if (!booking) return null;

  if (transitioned.count > 0) {
    // Every rail settles through here, so the ledger stays complete without each
    // caller having to remember to record the money.
    const { provider, method } = providerFromLegacyMethod(paymentMethod);
    await settlePayment(
      prisma,
      { id: booking.id, reference: booking.reference, memberId: booking.memberId, price: booking.price },
      {
        provider,
        method,
        amountCents: parsePriceToCents(booking.price),
        providerRef: booking.stripeSessionId,
        providerPaymentRef: booking.stripePaymentIntentId
      }
    ).catch((error) => {
      console.error("[payments] could not record settlement:", error);
    });

    await sendBookingConfirmation(prisma, booking);
  }

  return booking;
}
