/**
 * The "don't let this lapse" emails.
 *
 * Three months out the tone is relaxed, one month out it is a nudge. The point
 * is always the same: here is what you still have, and here is the button that
 * turns it into a class. Nobody enjoys being told they wasted money, so the
 * copy stays warm even at the last milestone.
 */

import { inboxFor, isMailConfigured, sendMail } from "../mail.js";
import { renderCustomerEmail, type EmailDetail } from "../email-template.js";
import { formatCents } from "../payments/money.js";
import { CREDIT_COSTS } from "../credits/packs.js";
import type { Milestone } from "./milestones.js";

const CATEGORY = "education" as const;
const CLASSES_URL = "https://dharma-space.com/classes";
const ACCOUNT_URL = "https://dharma-space.com/login";

const CATEGORY_LABELS: Record<string, string> = {
  YOGA: "Yoga",
  AERIAL: "Aerial",
  DANCE: "Dance",
  SOUND: "Sound healing",
  CEREMONY: "Ceremony"
};

function longDate(date: Date) {
  return date.toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" });
}

function monthWord(months: Milestone) {
  return months === 1 ? "one month" : months === 2 ? "two months" : "three months";
}

/** What the remaining balance still buys, in classes rather than numbers. */
function worthLines(credits: number): string[] {
  return [
    ...Object.entries(CREDIT_COSTS)
      .filter(([, cost]) => cost > 0 && credits >= cost)
      .map(([category, cost]) => {
        const classes = Math.floor(credits / cost);
        const label = CATEGORY_LABELS[category] ?? category;
        return `${label}: ${classes} ${classes === 1 ? "class" : "classes"}`;
      }),
    "Meditation: free, and it never touches your credits"
  ];
}

/** The best single line for "what could I do with this", used in the copy. */
function bestOffer(credits: number): string {
  const yoga = Math.floor(credits / (CREDIT_COSTS.YOGA || 2));
  if (yoga >= 2) return `${yoga} yoga classes`;
  if (yoga === 1) return "one more yoga class";
  return "a meditation session";
}

// ─── Credit packs ────────────────────────────────────────────────────────────

export type CreditExpiryMail = {
  to: string;
  name: string;
  packName: string;
  creditsLeft: number;
  expiresAt: Date;
  months: Milestone;
  sharedWith: string[];
};

function creditCopy(input: CreditExpiryMail) {
  const { months, creditsLeft, name } = input;
  const offer = bestOffer(creditsLeft);

  if (months === 3) {
    return {
      subject: `Your credits are good for three more months`,
      eyebrow: "Three months to go",
      heading: "Your credits are waiting",
      opening: `Hi ${name}, no rush at all — this is just a friendly note that you still have ${creditsLeft} ${
        creditsLeft === 1 ? "credit" : "credits"
      } sitting in your account, which is about ${offer}.`,
      encouragement:
        "Three months is plenty of time. It's also exactly how long it takes for a once-a-week habit to stop feeling like effort, if you fancy the experiment."
    };
  }

  if (months === 2) {
    return {
      subject: `Two months left on your credits`,
      eyebrow: "Two months to go",
      heading: "Still got credits to spend",
      opening: `Hi ${name}, your ${creditsLeft} remaining ${
        creditsLeft === 1 ? "credit" : "credits"
      } — roughly ${offer} — run out on ${longDate(input.expiresAt)}.`,
      encouragement:
        "Two months is comfortably enough to enjoy every one of them. Book the next one now and your future self can stop thinking about it."
    };
  }

  return {
    subject: `Last month to use your credits`,
    eyebrow: "One month to go",
    heading: "Time to treat yourself",
    opening: `Hi ${name}, your ${creditsLeft} remaining ${
      creditsLeft === 1 ? "credit" : "credits"
    } expire on ${longDate(input.expiresAt)} — that's ${offer} still on the table.`,
    encouragement:
      "This is the month to be a little greedy with your practice. Come twice a week, bring someone, try the class you've been quietly curious about."
  };
}

/**
 * Built separately from sending so the studio can see exactly what a member
 * will receive without a message going out.
 */
export function creditExpiryMessage(input: CreditExpiryMail) {
  const copy = creditCopy(input);

  const details: EmailDetail[] = [
    { label: "Pack", value: input.packName },
    { label: "Credits left", value: String(input.creditsLeft) },
    { label: "Use them by", value: longDate(input.expiresAt) },
    ...(input.sharedWith.length
      ? [{ label: "Shared with", value: input.sharedWith.join("\n") }]
      : [])
  ];

  const text = [
    copy.opening,
    "",
    copy.encouragement,
    "",
    `Pack: ${input.packName}`,
    `Credits left: ${input.creditsLeft}`,
    `Use them by: ${longDate(input.expiresAt)}`,
    "",
    `Book a class: ${CLASSES_URL}`,
    "",
    "Warm regards,",
    "Dharma Space Team"
  ].join("\n");

  return {
    subject: copy.subject,
    text,
    html: renderCustomerEmail({
      eyebrow: copy.eyebrow,
      heading: copy.heading,
      preheader: `${input.creditsLeft} credits, good until ${longDate(input.expiresAt)}.`,
      paragraphs: [copy.opening, copy.encouragement],
      highlight: {
        value: String(input.creditsLeft),
        label: input.creditsLeft === 1 ? "credit left" : "credits left"
      },
      details,
      detailsTitle: "Your pack",
      note: { title: "What that's worth", lines: worthLines(input.creditsLeft) },
      cta: { label: "Book a class", url: CLASSES_URL },
      closing: [
        input.sharedWith.length
          ? "Anyone on the pack can spend from the same balance, so pass the word along if you won't get to it."
          : "You can share this pack with family or a friend from My account, if you'd rather someone else enjoyed the rest.",
        "Credits can't be extended past their date, which is the only reason we're nudging."
      ]
    })
  };
}

export async function sendCreditExpiryReminder(input: CreditExpiryMail) {
  if (!isMailConfigured(CATEGORY)) return false;
  return sendMail(CATEGORY, { to: input.to, replyTo: inboxFor(CATEGORY), ...creditExpiryMessage(input) });
}

// ─── Memberships ─────────────────────────────────────────────────────────────

export type MembershipEndMail = {
  to: string;
  name: string;
  tierName: string;
  endsAt: Date;
  months: Milestone;
  sessionsLeft: number | null;
};

export function membershipEndingMessage(input: MembershipEndMail) {
  const when = longDate(input.endsAt);
  const last = input.months === 1;

  const opening = `Hi ${input.name}, your ${input.tierName} membership runs until ${when}. Everything works exactly as normal until then — we just didn't want the date to catch you by surprise.`;
  const encouragement = last
    ? "If you've been meaning to try aerial, or finally get to the Sunday sound bath, this is the month for it. And if you'd like to carry on, just reply — picking up where you left off is a two-minute job."
    : "Plenty of practice left between now and then. Make the most of it, and if you'd like to stay on with us afterwards, simply reply to this email.";

  const details: EmailDetail[] = [
    { label: "Plan", value: input.tierName },
    { label: "Access until", value: when },
    ...(input.sessionsLeft !== null
      ? [{ label: "Classes left this month", value: String(input.sessionsLeft) }]
      : [{ label: "Classes left this month", value: "Unlimited" }])
  ];

  return {
    subject: last ? `Your last month with us — ${input.tierName}` : `Your membership runs until ${when}`,
    text: [opening, "", encouragement, "", `Plan: ${input.tierName}`, `Access until: ${when}`, "", `Book a class: ${CLASSES_URL}`, "", "Warm regards,", "Dharma Space Team"].join("\n"),
    html: renderCustomerEmail({
      eyebrow: last ? "One month to go" : `${monthWord(input.months)} to go`,
      heading: last ? "Let's make it a good one" : "Your membership end date",
      preheader: `${input.tierName} access until ${when}.`,
      paragraphs: [opening, encouragement],
      details,
      detailsTitle: "Your membership",
      cta: { label: "Book a class", url: CLASSES_URL },
      closing: ["Changed your mind about leaving? Reply to this email and we'll sort it out."]
    })
  };
}

export async function sendMembershipEndingReminder(input: MembershipEndMail) {
  if (!isMailConfigured(CATEGORY)) return false;
  return sendMail(CATEGORY, {
    to: input.to,
    replyTo: inboxFor(CATEGORY),
    ...membershipEndingMessage(input)
  });
}

export type RateHeldMail = {
  to: string;
  name: string;
  tierName: string;
  heldUntil: Date;
  heldPriceCents: number;
  standardPriceCents: number;
  months: Milestone;
};

export function rateEndingMessage(input: RateHeldMail) {
  const when = longDate(input.heldUntil);
  const saving = input.standardPriceCents - input.heldPriceCents;

  const opening = `Hi ${input.name}, you joined us early, and the rate we held for you — ${formatCents(
    input.heldPriceCents
  )} a month instead of ${formatCents(input.standardPriceCents)} — runs until ${when}.`;
  const encouragement =
    input.months === 1
      ? `That's ${formatCents(saving)} a month you've been saving, and one more month of it. Nothing changes before ${when}, and we'll write again before anything does.`
      : `Nothing to do right now. We'd simply rather you heard it from us early than noticed it on a statement later.`;

  return {
    subject: `Your founding rate holds until ${when}`,
    text: [opening, "", encouragement, "", `Plan: ${input.tierName}`, `Your rate: ${formatCents(input.heldPriceCents)} a month until ${when}`, `After that: ${formatCents(input.standardPriceCents)} a month`, "", "Warm regards,", "Dharma Space Team"].join("\n"),
    html: renderCustomerEmail({
      eyebrow: `${monthWord(input.months)} to go`,
      heading: "About your founding rate",
      preheader: `${formatCents(input.heldPriceCents)} a month held until ${when}.`,
      paragraphs: [opening, encouragement],
      details: [
        { label: "Plan", value: input.tierName },
        { label: "Your rate", value: `${formatCents(input.heldPriceCents)} a month` },
        { label: "Held until", value: when },
        { label: "Standard rate", value: `${formatCents(input.standardPriceCents)} a month` }
      ],
      detailsTitle: "Your membership",
      cta: { label: "Book a class", url: ACCOUNT_URL },
      closing: [
        "You were one of the first to back the studio, and we haven't forgotten it. Any questions about the change, just reply."
      ]
    })
  };
}

export async function sendRateEndingReminder(input: RateHeldMail) {
  if (!isMailConfigured(CATEGORY)) return false;
  return sendMail(CATEGORY, {
    to: input.to,
    replyTo: inboxFor(CATEGORY),
    ...rateEndingMessage(input)
  });
}
