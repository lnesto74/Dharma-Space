import type { Booking, PrismaClient } from "@prisma/client";
import { programCategoryToSegment, segmentLabel, type InquirySegment } from "./inquiry-meta.js";
import { inboxFor, isMailConfigured, notifyInbox, sendMail } from "./mail.js";

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
    booking.paymentMethod ? `Payment: ${booking.paymentMethod}` : null,
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
    await sendBookingConfirmedEmails(booking).catch((error) => {
      console.error("[booking-mail] confirmation failed:", error);
    });
  }

  return booking;
}
