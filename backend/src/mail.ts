import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export type MailCategory = "corporate" | "education";

const transporters: Partial<Record<MailCategory, Transporter | null>> = {};

function smtpUser(category: MailCategory) {
  if (category === "corporate") {
    return process.env.SMTP_CORPORATE_USER || process.env.MAIL_CORPORATE_INBOX || "corporate@dharma-space.com";
  }
  return process.env.SMTP_EDUCATION_USER || process.env.MAIL_EDUCATION_INBOX || "education@dharma-space.com";
}

function smtpPass(category: MailCategory) {
  const raw = category === "corporate" ? process.env.SMTP_CORPORATE_PASS : process.env.SMTP_EDUCATION_PASS;
  if (!raw) return undefined;
  // Google app passwords are 16 chars; strip accidental spaces from copy/paste.
  return raw.trim().replace(/\s+/g, "");
}

export function resetMailTransporter(category?: MailCategory) {
  if (category) {
    delete transporters[category];
    return;
  }
  delete transporters.corporate;
  delete transporters.education;
}

export function isMailConfigured(category: MailCategory) {
  return Boolean(smtpUser(category) && smtpPass(category));
}

export function mailConfigured() {
  return {
    corporate: isMailConfigured("corporate"),
    education: isMailConfigured("education")
  };
}

function getTransporter(category: MailCategory) {
  if (transporters[category] !== undefined) return transporters[category]!;
  if (!isMailConfigured(category)) {
    transporters[category] = null;
    return null;
  }
  transporters[category] = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: smtpUser(category),
      pass: smtpPass(category)
    }
  });
  return transporters[category];
}

export function mailFrom(category: MailCategory) {
  if (category === "corporate") {
    return process.env.SMTP_CORPORATE_FROM || `Dharma Space <${smtpUser("corporate")}>`;
  }
  return process.env.SMTP_EDUCATION_FROM || `Dharma Space <${smtpUser("education")}>`;
}

export function inboxFor(category: MailCategory) {
  if (category === "corporate") {
    return process.env.MAIL_CORPORATE_INBOX || smtpUser("corporate");
  }
  return process.env.MAIL_EDUCATION_INBOX || smtpUser("education");
}

export function notifyInbox() {
  return process.env.MAIL_NOTIFY || "vera@dharma-space.com";
}

/** Which team inbox received this submission (corporate@ vs education@). */
export function sourceFromInbox(inbox: string, type?: string): MailCategory {
  const normalized = inbox.toLowerCase();
  const corporateInbox = inboxFor("corporate").toLowerCase();
  const educationInbox = inboxFor("education").toLowerCase();

  if (normalized === corporateInbox || normalized.includes("corporate@")) return "corporate";
  if (normalized === educationInbox || normalized.includes("education@")) return "education";
  if (type?.toUpperCase() === "CONTACT") return "corporate";
  return "education";
}

export async function sendMail(
  category: MailCategory,
  options: {
    to: string | string[];
    subject: string;
    text: string;
    replyTo?: string;
    cc?: string | string[];
  }
) {
  const transport = getTransporter(category);
  if (!transport) {
    console.warn(`[mail] ${category} SMTP not configured — skipped:`, options.subject);
    return false;
  }
  try {
    await transport.sendMail({
      from: mailFrom(category),
      to: options.to,
      cc: options.cc,
      replyTo: options.replyTo,
      subject: options.subject,
      text: options.text
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/535|BadCredentials|authentication/i.test(message)) {
      resetMailTransporter(category);
    }
    console.error(`[mail] ${category} send failed (${options.subject}):`, error);
    return false;
  }
}

export async function verifyMailConnection(category: MailCategory) {
  const transport = getTransporter(category);
  if (!transport) {
    return { ok: false, error: "SMTP not configured — add app password to backend/.env" };
  }
  try {
    await transport.verify();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/535|BadCredentials|authentication/i.test(message)) {
      resetMailTransporter(category);
    }
    return { ok: false, error: message };
  }
}

export function logMailStatus() {
  const status = mailConfigured();
  if (status.corporate) {
    console.log("[mail] Corporate SMTP configured →", inboxFor("corporate"));
  } else {
    console.warn("[mail] Corporate SMTP not configured — set SMTP_CORPORATE_PASS in backend/.env");
  }
  if (status.education) {
    console.log("[mail] Education SMTP configured →", inboxFor("education"));
  } else {
    console.warn("[mail] Education SMTP not configured — set SMTP_EDUCATION_PASS in backend/.env");
  }
  const notify = notifyInbox();
  if (notify) console.log("[mail] Team notifications CC →", notify);
}
