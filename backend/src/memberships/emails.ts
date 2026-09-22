/**
 * Mail for memberships. Right now a membership is only ever started by the
 * studio in the admin panel, so this is what tells the member it exists: what
 * they're on, what it covers, when it renews and what the terms are.
 */

import { inboxFor, isMailConfigured, notifyInbox, sendMail } from "../mail.js";
import { formatCents } from "../payments/money.js";
import { renderCustomerEmail } from "../email-template.js";
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
  /** Set for a fixed-length pass: it ends on its date rather than renewing. */
  termDays?: number | null;
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

  // A pass runs for a set number of days and then stops. Everything the email
  // says about months and renewal has to change with it, or the first thing a
  // new person reads about us is wrong.
  const isPass = Boolean(input.termDays && input.termDays > 0);
  const per = isPass ? `for ${input.termDays} days` : "each month";

  const allowance =
    input.tier.includedSessionsPerMonth === null
      ? `Unlimited classes ${per}`
      : `${input.tier.includedSessionsPerMonth} classes ${per}`;

  const details = [
    `Plan: ${input.tier.name}`,
    isPass
      ? `Price: ${formatCents(input.priceCents)}, paid once`
      : `Price: ${formatCents(input.priceCents)} per month${input.rateHeld ? " — your rate is held" : ""}`,
    `Included: ${allowance}${covered ? ` across ${covered}` : ""}`,
    `Meditation: free, and never counts against your allowance`,
    input.tier.guestPassesPerMonth > 0
      ? `Guest passes: ${input.tier.guestPassesPerMonth} a month`
      : null,
    `Started: ${longDate(input.startedAt)}`,
    `${isPass ? "Ends" : "Renews"}: ${longDate(input.currentPeriodEnd)}`
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
    isPass
      ? `Welcome to Dharma Space. Your ${input.tier.name} pass is open — everything on the timetable, for the next ${input.termDays} days.`
      : `Welcome to Dharma Space. Your ${input.tier.name} membership is active.`,
    "",
    details,
    ...signIn,
    "",
    isPass
      ? `Good to know: the pass runs to ${longDate(input.currentPeriodEnd)} and then simply stops — there's nothing to cancel and nothing renews. Come as often as you like in between; if you find your rhythm, we'll be glad to talk about a monthly plan.`
      : `Good to know: the first ${MINIMUM_TERM_MONTHS} months are a minimum term, after which it runs month to month. Cancelling needs ${CANCELLATION_NOTICE_DAYS} days' notice and you keep access to the end of the period you've paid for. Classes your plan doesn't cover are available to you at the member rate.`,
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
      subject: isPass
        ? `Your ${input.tier.name} week starts now`
        : `Welcome to Dharma Space — your ${input.tier.name} membership`,
      text: body,
      html: renderCustomerEmail({
        eyebrow: isPass ? "Pass open" : "Membership active",
        heading: `Welcome to ${input.tier.name}`,
        preheader: `${allowance}${covered ? ` across ${covered}` : ""}, starting today.`,
        greeting: `Hi ${input.member.name},`,
        paragraphs: [
          isPass
            ? `Welcome to Dharma Space. For the next ${input.termDays} days everything on the timetable is open to you — yoga, aerial, dance, sound healing and meditation. Come as often as you like and see what fits.`
            : "Welcome to Dharma Space. Your membership is active from today — book any class it covers and your allowance is applied automatically, with nothing to pay at the door."
        ],
        highlight: isPass
          ? { value: String(input.termDays), label: "days of everything" }
          : {
              value:
                input.tier.includedSessionsPerMonth === null
                  ? "Unlimited"
                  : String(input.tier.includedSessionsPerMonth),
              label: "classes each month"
            },
        details: [
          { label: "Plan", value: input.tier.name },
          {
            label: "Price",
            value: isPass
              ? `${formatCents(input.priceCents)}, paid once`
              : `${formatCents(input.priceCents)} per month${input.rateHeld ? " — rate held" : ""}`
          },
          ...(covered ? [{ label: "Covers", value: covered }] : []),
          { label: "Meditation", value: "Free, and never counts against your allowance" },
          ...(input.tier.guestPassesPerMonth > 0
            ? [{ label: "Guest passes", value: `${input.tier.guestPassesPerMonth} a month` }]
            : []),
          { label: "Started", value: longDate(input.startedAt) },
          {
            label: isPass ? "Ends" : "Renews",
            value: longDate(input.currentPeriodEnd)
          }
        ],
        detailsTitle: isPass ? "Your pass" : "Your membership",
        ...(input.isNewAccount
          ? {
              note: {
                title: "Your account",
                lines: [
                  `We've set one up for you under ${input.member.email}.`,
                  'Sign in with "Continue with Google" if that\'s your Google address, or ask us and we\'ll help you set a password.'
                ]
              }
            }
          : {}),
        cta: { label: "Book your first class", url: "https://dharma-space.com/classes" },
        closing: isPass
          ? [
              `Your pass runs to ${longDate(
                input.currentPeriodEnd
              )} and then simply stops — there's nothing to cancel and nothing renews.`,
              "If you find your rhythm with us in that week, we'd love to talk about a monthly plan."
            ]
          : [
              `The first ${MINIMUM_TERM_MONTHS} months are a minimum term, after which it runs month to month. Cancelling needs ${CANCELLATION_NOTICE_DAYS} days' notice and you keep access to the end of the period you've paid for.`,
              "Classes your plan doesn't cover are always open to you at the member rate."
            ]
      })
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
