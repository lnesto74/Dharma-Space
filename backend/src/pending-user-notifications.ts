import { inboxFor, isMailConfigured, notifyInbox, sendMail } from "./mail.js";
import { ROLE_HOME } from "./user-auth.js";

type PendingSignupMethod = "email" | "google";

const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: "Employee",
  HR_ADMIN: "HR Admin",
  CORPORATE_ADMIN: "Corporate Admin",
  TRAINER: "Specialist / Trainer",
  SUPER_ADMIN: "Dharma Admin"
};

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

function roleLabel(role?: string | null) {
  if (!role) return "Not specified";
  return ROLE_LABELS[role] || role;
}

export async function notifyAdminPendingUser(input: {
  name: string;
  email: string;
  method: PendingSignupMethod;
  role?: string | null;
  position?: string | null;
  company?: string | null;
  companyId?: string | null;
  department?: string | null;
}) {
  if (!isMailConfigured("corporate")) {
    console.warn("[pending-user] Corporate SMTP not configured — skipped admin notification for", input.email);
    return;
  }

  const frontend = (process.env.FRONTEND_URL || "https://dharma-space.com").replace(/\/$/, "");
  const adminUrl = `${frontend}/admin/cwp`;
  const companyUrl =
    input.companyId ? `${frontend}/admin/cwp/companies/${input.companyId}?tab=people` : adminUrl;
  const methodLabel = input.method === "google" ? "Google sign-in" : "Email registration";

  const text = [
    "A new corporate wellness platform account is waiting for approval.",
    "",
    "Applicant details",
    "-----------------",
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Role requested: ${roleLabel(input.role)}`,
    `Position: ${input.position?.trim() || "Not specified"}`,
    `Company: ${input.company?.trim() || "Not assigned yet"}`,
    `Department: ${input.department?.trim() || "Not assigned yet"}`,
    `Signed up via: ${methodLabel}`,
    `Status: PENDING`,
    "",
    "Review in the admin backend:",
    adminUrl,
    "",
    input.companyId
      ? `Open this company's People tab directly:\n${companyUrl}`
      : "Assign company and department in Users, then approve access.",
    "",
    "In the admin panel: open Pending approvals (briefcase icon, lower right) or CWP → company → People → Approve."
  ].join("\n");

  await sendMail("corporate", {
    to: inboxFor("corporate"),
    cc: notifyInbox(),
    subject: `[CWP] Pending approval — ${input.name} (${roleLabel(input.role)})`,
    text,
    replyTo: input.email
  }).catch((error) => {
    console.error("[pending-user] Admin notification failed:", error);
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cwpEmailShell(title: string, bodyHtml: string, footerNote: string) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f2ebe0;font-family:Georgia,'Times New Roman',Times,serif;color:#2a2825;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2ebe0;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e8dfd2;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(42,40,37,0.08);">
          <tr>
            <td style="padding:28px 32px 20px;background:linear-gradient(135deg,#f7f0e6 0%,#ffffff 55%);border-bottom:1px solid #ece4d8;">
              <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#c4785a;font-family:Helvetica,Arial,sans-serif;">Dharma Space</p>
              <h1 style="margin:0;font-size:26px;line-height:1.25;font-weight:400;color:#2a2825;">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;font-size:15px;line-height:1.65;color:#4a4640;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #ece4d8;background:#faf7f2;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#7a746c;font-family:Helvetica,Arial,sans-serif;">
                ${footerNote}<br />
                <a href="mailto:corporate@dharma-space.com" style="color:#c4785a;text-decoration:none;">corporate@dharma-space.com</a>
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:#a39a90;font-family:Helvetica,Arial,sans-serif;">© ${year} Dharma Space</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function detailRow(label: string, value: string) {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #f0e8dc;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#8a8278;font-family:Helvetica,Arial,sans-serif;width:38%;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:10px 0;border-bottom:1px solid #f0e8dc;font-size:15px;color:#2a2825;vertical-align:top;">${escapeHtml(value)}</td>
  </tr>`;
}

export async function notifyUserApproved(input: {
  name: string;
  email: string;
  role: string;
  position?: string | null;
  company?: string | null;
  department?: string | null;
}) {
  if (!isMailConfigured("corporate")) {
    console.warn("[pending-user] Corporate SMTP not configured — skipped approval email for", input.email);
    return;
  }

  const frontend = (process.env.FRONTEND_URL || "https://dharma-space.com").replace(/\/$/, "");
  const portalUrl = `${frontend}/portal`;
  const role = roleLabel(input.role);
  const workspaceLabels: Record<string, string> = {
    "/app/dashboard": "Employee dashboard",
    "/hr/dashboard": "HR / company manager",
    "/trainer/dashboard": "Trainer dashboard",
    "/company/dashboard": "Company admin",
    "/admin": "Admin"
  };
  const workspace = workspaceLabels[ROLE_HOME[input.role] || "/app/dashboard"] || "Corporate Wellness Platform";
  const firstName = input.name.trim().split(/\s+/)[0] || input.name;

  const text = [
    `Hello ${firstName},`,
    "",
    "Great news — your Corporate Wellness Platform access has been approved.",
    "",
    "Your account",
    `Role: ${role}`,
    `Position: ${input.position?.trim() || "—"}`,
    `Company: ${input.company?.trim() || "—"}`,
    `Department: ${input.department?.trim() || "—"}`,
    "",
    "Sign in here:",
    portalUrl,
    "",
    "Use the same email and password you registered with, or continue with Google if you signed up that way.",
    "",
    "We look forward to supporting your wellness journey.",
    "",
    "Warm regards,",
    "Dharma Space Corporate Team",
    "corporate@dharma-space.com"
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hello <strong>${escapeHtml(firstName)}</strong>,</p>
    <p style="margin:0 0 20px;">Your access to the <strong>Corporate Wellness Platform</strong> has been approved. You can sign in and start booking sessions, tracking your wellness score, and connecting with your team.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border-collapse:collapse;">
      ${detailRow("Role", role)}
      ${detailRow("Position", input.position?.trim() || "—")}
      ${detailRow("Company", input.company?.trim() || "—")}
      ${detailRow("Department", input.department?.trim() || "—")}
      ${detailRow("Workspace", workspace)}
    </table>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
      <tr>
        <td style="border-radius:999px;background:#c4785a;">
          <a href="${portalUrl}" style="display:inline-block;padding:14px 28px;font-size:13px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#ffffff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;">Sign in to CWP</a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:14px;color:#6b6560;">Use your registered email and password, or <strong>Continue with Google</strong> if you signed up that way.</p>
  `;

  const html = cwpEmailShell(
    "Your access is approved",
    bodyHtml,
    "Questions about your corporate wellness access?"
  );

  await sendMail("corporate", {
    to: input.email,
    replyTo: inboxFor("corporate"),
    subject: "Your Dharma Space Corporate Wellness access is approved",
    text,
    html
  }).catch((error) => {
    console.error("[pending-user] Approval email failed:", error);
  });
}
