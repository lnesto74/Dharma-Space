import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  enrichSubmissionRecord,
  type InquiryPayload,
  type InquirySegment,
  type PaymentStatus,
  resolveInquirySegment
} from "./inquiry-meta.js";
import { inboxFor, isMailConfigured, notifyInbox, sendMail, sourceFromInbox } from "./mail.js";

const contextSchema = z
  .object({
    title: z.string().optional(),
    date: z.string().optional(),
    time: z.string().optional(),
    location: z.string().optional(),
    facilitator: z.string().optional(),
    price: z.string().optional(),
    bookingType: z.string().optional(),
    reference: z.string().optional(),
    amount: z.string().optional(),
    guests: z.string().optional(),
    notes: z.string().optional(),
    uen: z.string().optional(),
    segment: z.enum(["CORPORATE", "CWP", "FLAGSHIP", "COURSE", "WORKSHOP", "EVENT", "REGULAR_CLASS"]).optional(),
    paymentStatus: z.enum(["WAITLIST", "NOT_PAID", "PAID"]).optional(),
    siteClassId: z.string().optional(),
    programCategory: z.string().optional(),
    companyName: z.string().optional(),
    employeeCount: z.string().optional(),
    interest: z.string().optional(),
    inquiryId: z.string().optional()
  })
  .optional();

export const inquirySchema = z.object({
  type: z.enum([
    "contact",
    "cwp_demo",
    "waitlist",
    "booking_payment",
    "class_waitlist",
    "class_schedule_notify",
    "booking_intent",
    "booking_confirmed"
  ]),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().optional(),
  notes: z.string().optional(),
  guests: z.string().optional(),
  siteProgramId: z.string().optional(),
  siteClassId: z.string().optional(),
  audienceType: z.enum(["student", "practitioner"]).optional(),
  context: contextSchema
});

export type InquiryInput = z.infer<typeof inquirySchema>;

function parsePayload(raw: string): InquiryPayload {
  try {
    return JSON.parse(raw || "{}") as InquiryPayload;
  } catch {
    return {};
  }
}

export async function serializeSubmission(
  prisma: PrismaClient,
  submission: {
    id: string;
    type: string;
    inbox: string;
    payload: string;
    status: string;
    name: string;
    email: string;
    phone?: string | null;
    subject?: string | null;
    message?: string | null;
    createdAt: Date;
    siteProgramId?: string | null;
    audienceType?: string | null;
  }
) {
  const payload = parsePayload(submission.payload);
  const meta = await enrichSubmissionRecord(prisma, submission);
  const source = sourceFromInbox(submission.inbox, submission.type);
  return {
    ...submission,
    payload,
    source,
    sourceLabel:
      meta.segment === "CWP"
        ? "CWP Platform"
        : source === "corporate"
          ? "Corporate"
          : "Education",
    segment: meta.segment,
    segmentLabel: meta.segmentLabel,
    paymentStatus: meta.paymentStatus,
    paymentTag: meta.paymentTag
  };
}

function categoryFor(type: InquiryInput["type"]): "corporate" | "education" {
  if (type === "contact" || type === "cwp_demo") return "corporate";
  return "education";
}

function paymentStatusForType(type: InquiryInput["type"], context?: InquiryPayload): PaymentStatus {
  if (context?.paymentStatus) return context.paymentStatus;
  switch (type) {
    case "waitlist":
    case "class_waitlist":
    case "class_schedule_notify":
      return "WAITLIST";
    case "booking_intent":
      return "NOT_PAID";
    case "booking_confirmed":
      return "PAID";
    case "booking_payment":
      return "NOT_PAID";
    default:
      return "WAITLIST";
  }
}

function inquiryContext(input: InquiryInput): InquiryPayload {
  return {
    ...(input.context || {}),
    notes: input.notes || input.context?.notes,
    guests: input.guests || input.context?.guests
  };
}

function bookingDetailsBlock(ctx: InquiryPayload, input?: InquiryInput) {
  return [
    ctx.title ? `Title: ${ctx.title}` : null,
    ctx.date ? `Date: ${ctx.date}` : null,
    ctx.time ? `Time: ${ctx.time}` : null,
    ctx.location ? `Address: ${ctx.location}` : null,
    ctx.facilitator ? `Facilitator: ${ctx.facilitator}` : null,
    ctx.price ? `Price: ${ctx.price}` : null,
    ctx.amount ? `Amount: ${ctx.amount}` : null,
    ctx.guests ? `Guests: ${ctx.guests}` : null,
    ctx.reference ? `Reference: ${ctx.reference}` : null,
    ctx.bookingType ? `Booking type: ${ctx.bookingType}` : null,
    ctx.companyName ? `Company: ${ctx.companyName}` : null,
    ctx.employeeCount ? `Team size: ${ctx.employeeCount}` : null,
    ctx.interest ? `Interest: ${ctx.interest}` : null,
    input?.phone ? `Phone: ${input.phone}` : null,
    ctx.notes ? `Notes: ${ctx.notes}` : null,
    input?.message && input.message !== ctx.notes ? `Message: ${input.message}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

function adminSubject(input: InquiryInput) {
  const title = input.context?.title;
  switch (input.type) {
    case "contact":
      return `New corporate enquiry: ${input.subject || "Contact form"}`;
    case "cwp_demo":
      return `CWP platform demo request: ${input.context?.companyName || input.name}`;
    case "waitlist":
      return `Reserve spot: ${title || "Program"}`;
    case "class_waitlist":
      return `Reserve spot (class): ${title || "Class"}`;
    case "class_schedule_notify":
      return `Regular classes — notify me interest: ${input.name}`;
    case "booking_intent":
      return `Booking started (payment pending): ${title || "Session"}`;
    case "booking_confirmed":
      return `Booking confirmed & paid: ${title || "Session"}`;
    case "booking_payment":
      return `PayNow booking (awaiting payment): ${title || "Program"}`;
  }
}

function adminBody(input: InquiryInput, segment: InquirySegment, paymentStatus: PaymentStatus) {
  const ctx = inquiryContext(input);
  const lines = [
    `Segment: ${segment}`,
    `Payment: ${paymentStatus === "WAITLIST" ? "Waitlist" : paymentStatus === "PAID" ? "Paid" : "Not paid"}`,
    `Type: ${input.type}`,
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    input.phone ? `Phone: ${input.phone}` : null,
    input.subject ? `Subject: ${input.subject}` : null,
    "",
    bookingDetailsBlock(ctx, input) || null,
    input.siteProgramId ? `\nProgram ID: ${input.siteProgramId}` : null,
    input.siteClassId ? `Class ID: ${input.siteClassId}` : null
  ].filter(Boolean);
  return lines.join("\n");
}

function customerSubject(input: InquiryInput) {
  const title = input.context?.title;
  switch (input.type) {
    case "contact":
      return "We received your message — Dharma Space";
    case "cwp_demo":
      return "Your CWP platform demo request — Dharma Space";
    case "waitlist":
    case "class_waitlist":
      return `Your spot is reserved — ${title || "Dharma Space"}`;
    case "class_schedule_notify":
      return "You're on the list — Regular Classes at Dharma Space";
    case "booking_intent":
      return `Complete your payment — ${title || "Dharma Space"}`;
    case "booking_confirmed":
      return `Booking confirmed — ${title || "Dharma Space"}`;
    case "booking_payment":
      return `Booking received — ${title || "Dharma Space"}`;
  }
}

function customerBody(input: InquiryInput) {
  const ctx = inquiryContext(input);
  const whatsapp = process.env.WHATSAPP_URL || "https://wa.me/6598664331";
  const greeting = `Hi ${input.name},\n\nThank you for choosing Dharma Space.`;
  const details = bookingDetailsBlock(ctx, input);
  const detailsBlock = details ? `${details}\n\n` : "";

  if (input.type === "contact") {
    return `${greeting}\n\nWe received your enquiry and will reply within one business day.\n\nYour message:\n"${input.message || ""}"\n\nWhatsApp: ${whatsapp}\n\nWarm regards,\nDharma Space Team`;
  }

  if (input.type === "cwp_demo") {
    return `${greeting}\n\nThank you for your interest in the Dharma Space Corporate Wellness Platform (CWP). Our team will reach out within one business day to schedule a walkthrough.\n\n${detailsBlock}WhatsApp: ${whatsapp}\n\nWarm regards,\nDharma Space Team`;
  }

  if (input.type === "waitlist" || input.type === "class_waitlist") {
    return `${greeting}\n\nWe've received your reservation for ${ctx.title || "your selected session"}. We'll email you as soon as dates are confirmed.\n\n${detailsBlock}WhatsApp: ${whatsapp}\n\nWarm regards,\nDharma Space Team`;
  }

  if (input.type === "class_schedule_notify") {
    return `${greeting}\n\nYou're on our list for the weekly regular class schedule. We'll email you as soon as booking opens.\n\n${detailsBlock}WhatsApp: ${whatsapp}\n\nWarm regards,\nDharma Space Team`;
  }

  if (input.type === "booking_intent") {
    return `${greeting}\n\nYou're almost booked for ${ctx.title || "your session"}. Please complete payment on the secure Stripe checkout page to confirm your spot.\n\n${detailsBlock}If checkout didn't open, contact us on WhatsApp: ${whatsapp}\n\nDharma Space Team`;
  }

  if (input.type === "booking_confirmed") {
    return `${greeting}\n\nYour booking is confirmed. We look forward to seeing you.\n\n${detailsBlock}This email serves as your confirmation and receipt.\n\nWhatsApp: ${whatsapp}\n\nWarm regards,\nDharma Space Team`;
  }

  if (input.type === "booking_payment") {
    return `${greeting}\n\nYour booking for ${ctx.title} is recorded.\n\n${detailsBlock}Include reference "${ctx.reference}" in your PayNow transfer${ctx.uen ? ` to UEN ${ctx.uen}` : ""}. We'll confirm payment within a few hours.\n\nWhatsApp: ${whatsapp}\n\nDharma Space Team`;
  }

  return `${greeting}\n\nWe've saved your interest in ${ctx.title || "the selected session"}. Our team will follow up shortly.\n\n${detailsBlock}WhatsApp: ${whatsapp}\n\nDharma Space Team`;
}

async function sendInquiryEmails(
  category: "corporate" | "education",
  input: InquiryInput,
  segment: InquirySegment,
  paymentStatus: PaymentStatus
) {
  const inbox = inboxFor(category);
  const notify = notifyInbox();
  const ccVera = notify && notify.toLowerCase() !== inbox.toLowerCase() ? notify : undefined;

  const teamSent = await sendMail(category, {
    to: inbox,
    cc: ccVera,
    replyTo: input.email,
    subject: adminSubject(input),
    text: adminBody(input, segment, paymentStatus)
  });
  const customerSent = await sendMail(category, {
    to: input.email,
    replyTo: inbox,
    subject: customerSubject(input),
    text: customerBody(input)
  });
  return teamSent && customerSent;
}

export async function processInquiry(prisma: PrismaClient, input: InquiryInput) {
  const category = categoryFor(input.type);
  const inbox = inboxFor(category);
  const segment = await resolveInquirySegment(prisma, {
    type: input.type,
    siteProgramId: input.siteProgramId,
    siteClassId: input.siteClassId,
    context: input.context
  });
  const paymentStatus = paymentStatusForType(input.type, input.context);

  const payload: InquiryPayload = {
    ...input.context,
    segment,
    paymentStatus,
    notes: input.notes,
    guests: input.guests || input.context?.guests,
    siteClassId: input.siteClassId || input.context?.siteClassId,
    companyName: input.context?.companyName,
    employeeCount: input.context?.employeeCount,
    interest: input.context?.interest || (input.type === "cwp_demo" ? "demo" : undefined)
  };

  if (input.type === "booking_confirmed" && input.context?.reference) {
    const existing = await prisma.formSubmission.findFirst({
      where: {
        type: "BOOKING_CONFIRMED",
        email: input.email.toLowerCase(),
        payload: { contains: input.context.reference }
      },
      orderBy: { createdAt: "desc" }
    });
    if (existing) {
      return {
        id: existing.id,
        emailSent: existing.emailSent,
        stored: true,
        message: "Booking already confirmed."
      };
    }
  }

  const record = await prisma.formSubmission.create({
    data: {
      type: input.type.toUpperCase(),
      inbox,
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone || null,
      subject: input.subject || input.context?.title || null,
      message: input.message || input.notes || null,
      payload: JSON.stringify(payload),
      status: "NEW",
      emailSent: false,
      siteProgramId: input.siteProgramId || null,
      audienceType: input.audienceType || null
    }
  });

  if (!isMailConfigured(category)) {
    return {
      id: record.id,
      emailSent: false,
      stored: true,
      message: `Your request was saved. Email is not configured yet — add SMTP_${category === "corporate" ? "CORPORATE" : "EDUCATION"}_PASS in backend/.env and restart the server.`
    };
  }

  let emailSent = false;
  try {
    emailSent = await sendInquiryEmails(category, input, segment, paymentStatus);
  } catch (error) {
    console.error("[inquiry] email failed:", error);
  }

  if (emailSent) {
    await prisma.formSubmission.update({
      where: { id: record.id },
      data: { emailSent: true }
    });
  }

  return {
    id: record.id,
    emailSent,
    stored: true,
    message: emailSent
      ? "Thank you — your message was sent and saved."
      : "Your message was saved. Email delivery is pending SMTP configuration."
  };
}

function submissionToInquiryInput(
  submission: {
    name: string;
    email: string;
    phone: string | null;
    siteProgramId: string | null;
    audienceType: string | null;
    message: string | null;
  },
  payload: InquiryPayload,
  type: InquiryInput["type"]
): InquiryInput {
  return {
    type,
    name: submission.name,
    email: submission.email,
    phone: submission.phone || undefined,
    siteProgramId: submission.siteProgramId || undefined,
    siteClassId: payload.siteClassId,
    audienceType: (submission.audienceType as InquiryInput["audienceType"]) || undefined,
    notes: payload.notes,
    message: submission.message || undefined,
    context: {
      title: payload.title,
      date: payload.date,
      time: payload.time,
      location: payload.location,
      facilitator: payload.facilitator,
      price: payload.price,
      amount: payload.amount,
      reference: payload.reference,
      uen: payload.uen,
      guests: payload.guests,
      bookingType: payload.bookingType,
      programCategory: payload.programCategory,
      segment: payload.segment,
      paymentStatus: "PAID"
    }
  };
}

export async function markInquiryPaid(prisma: PrismaClient, id: string) {
  const submission = await prisma.formSubmission.findUnique({ where: { id } });
  if (!submission) {
    throw Object.assign(new Error("Inquiry not found"), { status: 404 });
  }
  const markableTypes = new Set(["BOOKING_PAYMENT", "BOOKING_INTENT"]);
  if (!markableTypes.has(submission.type)) {
    throw Object.assign(new Error("Only unpaid bookings can be marked as paid"), { status: 400 });
  }

  const payload = parsePayload(submission.payload);
  if (payload.paymentStatus === "PAID") {
    return {
      submission: await serializeSubmission(prisma, submission),
      emailSent: submission.emailSent,
      alreadyPaid: true
    };
  }

  const segment =
    payload.segment ||
    (await resolveInquirySegment(prisma, {
      type: submission.type,
      siteProgramId: submission.siteProgramId,
      siteClassId: payload.siteClassId,
      context: payload
    }));

  const updatedPayload: InquiryPayload = {
    ...payload,
    segment,
    paymentStatus: "PAID",
    paidAt: new Date().toISOString()
  };

  let record = await prisma.formSubmission.update({
    where: { id },
    data: {
      payload: JSON.stringify(updatedPayload),
      status: submission.status === "NEW" ? "READ" : submission.status
    }
  });

  const category = categoryFor("booking_payment");
  let emailSent = false;

  if (isMailConfigured(category)) {
    const confirmInput = submissionToInquiryInput(submission, updatedPayload, "booking_confirmed");
    try {
      const inbox = inboxFor(category);
      const notify = notifyInbox();
      const ccVera = notify && notify.toLowerCase() !== inbox.toLowerCase() ? notify : undefined;
      const title = updatedPayload.title || "Session";
      const isPayNow = submission.type === "BOOKING_PAYMENT";
      const teamSubject = isPayNow
        ? `PayNow payment verified & booking confirmed: ${title}`
        : `Booking payment verified & confirmed: ${title}`;
      const teamIntro = isPayNow
        ? "PayNow payment has been verified manually."
        : "Booking payment has been verified manually.";

      const teamSent = await sendMail(category, {
        to: inbox,
        cc: ccVera,
        replyTo: submission.email,
        subject: teamSubject,
        text: [teamIntro, "", adminBody(confirmInput, segment, "PAID")].join("\n")
      });
      const customerSent = await sendMail(category, {
        to: submission.email,
        replyTo: inbox,
        subject: customerSubject(confirmInput),
        text: customerBody(confirmInput)
      });
      emailSent = teamSent && customerSent;
    } catch (error) {
      console.error("[inquiry] mark paid email failed:", error);
    }

    if (emailSent) {
      record = await prisma.formSubmission.update({
        where: { id },
        data: { emailSent: true }
      });
    }
  }

  return {
    submission: await serializeSubmission(prisma, record),
    emailSent,
    alreadyPaid: false
  };
}
