/**
 * Mail for memberships. Right now a membership is only ever started by the
 * studio in the admin panel, so this is what tells the member it exists: what
 * they're on, what it covers, when it renews and what the terms are.
 */

import { inboxFor, isMailConfigured, notifyInbox, sendMail } from "../mail.js";
import { formatCents } from "../payments/money.js";
import {
  CANCELLATION_NOTICE_DAYS,
  FREE_CATEGORY,
  MINIMUM_TERM_MONTHS
} from "./tiers.js";

const CATEGORY = "education" as const;

const CATEGORY_LABELS: Record<string, string> = {
  YOGA: "yoga",
  AERIAL: "aerial",
  SOUND: "sound healing",
  DANCE: "dance",
  MEDITATION: "meditation",
  CEREMONY: "ceremony",
  WORKSHOP: "workshops",
  TRAINING: "trainings"
};

function longDate(date: Date) {
  return date.toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" });
}

function list(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;
}

export type MembershipWelcome = {
  member: { name: string; email: string };
  tier: {
    name: string;
    includedSessionsPerMonth: number | null;
    /** Stored comma-separated, the same as everywhere else it's read. */
    allowedCategories: string;
    guestPassesPerMonth: number;
  };
  priceCents: number;
  startedAt: Date;
  currentPeriodEnd: Date;
  minimumTermEndsAt: Date;
  rateHeld: boolean;
  /** True when the studio created the account, so they have no password yet. */
  isNewAccount: boolean;
};

export async function sendMembershipWelcomeEmail(input: MembershipWelcome) {
  if (!isMailConfigured(CATEGORY)) {
    console.warn("[membership-mail] Education SMTP not configured — skipped:", input.member.email);
    return false;
  }

  const inbox = inboxFor(CATEGORY);
  const notify = notifyInbox();
  const ccVera = notify && notify.toLowerCase() !== inbox.toLowerCase() ? notify : undefined;

  const covered = list(
    input.tier.allowedCategories
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c && c !== FREE_CATEGORY)
      .map((c) => CATEGORY_LABELS[c] ?? c.toLowerCase())
  );

  const allowance =
    input.tier.includedSessionsPerMonth === null
      ? "Unlimited classes each month"
      : `${input.tier.includedSessionsPerMonth} classes each month`;

  const details = [
    `Plan: ${input.tier.name}`,
    `Price: ${formatCents(input.priceCents)} per month${input.rateHeld ? " — your rate is held" : ""}`,
    `Included: ${allowance}${covered ? ` across ${covered}` : ""}`,
    `Meditation: free, and never counts against your allowance`,
    input.tier.guestPassesPerMonth > 0
      ? `Guest passes: ${input.tier.guestPassesPerMonth} a month`
      : null,
    `Started: ${longDate(input.startedAt)}`,
    `Renews: ${longDate(input.currentPeriodEnd)}`
  ]
    .filter(Boolean)
    .join("\n");

  const signIn = input.isNewAccount
    ? [
        "",
        `We've set up an account for you under ${input.member.email}. Sign in at https://dharma-space.com — use "Continue with Google" if that's your Google address, or ask us and we'll help you set a password.`
      ]
    : ["", "Sign in at https://dharma-space.com to book — your classes are deducted automatically."];

  const body = [
    `Hi ${input.member.name},`,
    "",
    `Welcome to Dharma Space. Your ${input.tier.name} membership is active.`,
    "",
    details,
    ...signIn,
    "",
    `Good to know: the first ${MINIMUM_TERM_MONTHS} months are a minimum term, after which it runs month to month. Cancelling needs ${CANCELLATION_NOTICE_DAYS} days' notice and you keep access to the end of the period you've paid for. Classes your plan doesn't cover are available to you at the member rate.`,
    "",
    `Any questions, just reply to this email or message us on WhatsApp: ${process.env.WHATSAPP_URL || "https://wa.me/6598664331"}`,
    "",
    "Warm regards,",
    "Dharma Space Team"
  ].join("\n");

  const [memberSent, teamSent] = await Promise.all([
    sendMail(CATEGORY, {
      to: input.member.email,
      replyTo: inbox,
      subject: `Welcome to Dharma Space — your ${input.tier.name} membership`,
      text: body
    }),
    sendMail(CATEGORY, {
      to: inbox,
      cc: ccVera,
      replyTo: input.member.email,
      subject: `Membership started: ${input.member.name} — ${input.tier.name}`,
      text: [
        "A membership was created in the admin panel.",
        "",
        `Member: ${input.member.name} (${input.member.email})`,
        input.isNewAccount ? "New website account created for them." : "Existing website account.",
        "",
        details
      ].join("\n")
    })
  ]);

  if (!memberSent || !teamSent) {
    console.warn("[membership-mail] Partial/failed send for", input.member.email);
  }
  return memberSent && teamSent;
}
