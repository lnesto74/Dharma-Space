import { inboxFor, isMailConfigured, notifyInbox, sendMail } from "./mail.js";

type PendingSignupMethod = "email" | "google";

export function allowedCorporateDomainsList() {
  return (process.env.CORPORATE_ALLOWED_DOMAINS || "dharma-space.com")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function selfSignupDomainRejectedMessage() {
  const domains = allowedCorporateDomainsList().join(", ");
  return `Self-registration is only available for approved company email domains (${domains}). Contact corporate@dharma-space.com if you need access.`;
}

export async function notifyAdminPendingUser(input: {
  name: string;
  email: string;
  method: PendingSignupMethod;
}) {
  if (!isMailConfigured("corporate")) {
    console.warn("[pending-user] Corporate SMTP not configured — skipped admin notification for", input.email);
    return;
  }

  const frontend = process.env.FRONTEND_URL || "https://dharma-space.com";
  const adminUrl = `${frontend.replace(/\/$/, "")}/admin/cwp`;
  const methodLabel = input.method === "google" ? "Google sign-in" : "Email registration";

  const text = [
    "A new corporate wellness platform account is waiting for approval.",
    "",
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Signed up via: ${methodLabel}`,
    `Status: PENDING`,
    "",
    "Open the admin backend to assign persona (role), company, and approve access:",
    adminUrl,
    "",
    "In Users → filter by Pending approval → Assign role → Approve."
  ].join("\n");

  await sendMail("corporate", {
    to: inboxFor("corporate"),
    cc: notifyInbox(),
    subject: `[CWP] Pending user approval — ${input.email}`,
    text,
    replyTo: input.email
  }).catch((error) => {
    console.error("[pending-user] Admin notification failed:", error);
  });
}
