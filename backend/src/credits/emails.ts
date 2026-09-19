/**
 * Mail for credit pack purchases: a receipt for the buyer, a heads-up for
 * everyone the pack is shared with, and a copy to the studio inbox.
 */

import { inboxFor, isMailConfigured, notifyInbox, sendMail } from "../mail.js";
import { formatCents } from "../payments/money.js";
import { renderCustomerEmail } from "../email-template.js";
import { CREDIT_COSTS } from "./packs.js";

const CATEGORY = "education" as const;

function whatsapp() {
  return process.env.WHATSAPP_URL || "https://wa.me/6598664331";
}

function longDate(date: Date) {
  return date.toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" });
}

const CATEGORY_LABELS: Record<string, string> = {
  YOGA: "Yoga",
  AERIAL: "Aerial",
  DANCE: "Dance",
  SOUND: "Sound healing",
  CEREMONY: "Ceremony"
};

/** What the balance buys, so the receipt answers the obvious next question. */
function worthLines(credits: number): string[] {
  return [
    ...Object.entries(CREDIT_COSTS)
      .filter(([, cost]) => cost > 0)
      .map(([category, cost]) => {
        const label = CATEGORY_LABELS[category] ?? category;
        return `${label}: ${cost} credits per class — ${Math.floor(credits / cost)} classes`;
      }),
    "Meditation: free with a credit pack"
  ];
}

function worthBlock(credits: number) {
  return ["What your credits cover:", ...worthLines(credits).map((l) => `  ${l}`)].join("\n");
}

export type PackPurchaseMail = {
  reference: string;
  packName: string;
  credits: number;
  amountCents: number;
  expiresAt: Date;
  owner: { name: string; email: string };
  sharedWith: { name: string; email: string }[];
};

export async function sendCreditPackPurchasedEmails(purchase: PackPurchaseMail) {
  if (!isMailConfigured(CATEGORY)) {
    console.warn("[credit-mail] Education SMTP not configured — skipped:", purchase.reference);
    return false;
  }

  const inbox = inboxFor(CATEGORY);
  const notify = notifyInbox();
  const ccVera = notify && notify.toLowerCase() !== inbox.toLowerCase() ? notify : undefined;
  const expiry = longDate(purchase.expiresAt);
  const sharedNames = purchase.sharedWith.map((s) => `${s.name} (${s.email})`);

  const details = [
    `Pack: ${purchase.packName}`,
    `Credits: ${purchase.credits}`,
    `Paid: ${formatCents(purchase.amountCents)}`,
    `Valid until: ${expiry}`,
    `Reference: ${purchase.reference}`,
    sharedNames.length ? `Shared with: ${sharedNames.join(", ")}` : null
  ]
    .filter(Boolean)
    .join("\n");

  const buyerBody = [
    `Hi ${purchase.owner.name},`,
    "",
    "Thank you for choosing Dharma Space. Your credits are ready to use.",
    "",
    details,
    "",
    worthBlock(purchase.credits),
    "",
    sharedNames.length
      ? `${sharedNames.join(" and ")} can book with this pack too — the balance is shared, and we'll show you who used what in My account.`
      : "You can share this pack with family or friends any time from My account → My credits.",
    "",
    "Credits are deducted automatically when you book a class. This email serves as your receipt.",
    "",
    `WhatsApp: ${whatsapp()}`,
    "",
    "Warm regards,",
    "Dharma Space Team"
  ].join("\n");

  const teamBody = [
    "A credit pack was purchased online.",
    "",
    `Buyer: ${purchase.owner.name} (${purchase.owner.email})`,
    "",
    details
  ].join("\n");

  const results = await Promise.all([
    sendMail(CATEGORY, {
      to: inbox,
      cc: ccVera,
      replyTo: purchase.owner.email,
      subject: `Credit pack sold: ${purchase.packName} — ${purchase.owner.name}`,
      text: teamBody
    }),
    sendMail(CATEGORY, {
      to: purchase.owner.email,
      replyTo: inbox,
      subject: `Your credits are ready — ${purchase.packName}`,
      text: buyerBody,
      html: renderCustomerEmail({
        eyebrow: "Credits added",
        heading: "Your credits are ready",
        preheader: `${purchase.credits} credits, yours until ${expiry}.`,
        greeting: `Hi ${purchase.owner.name},`,
        paragraphs: [
          "Thank you for choosing Dharma Space. Your credits are in your account and come off automatically when you book."
        ],
        highlight: { value: String(purchase.credits), label: "credits available" },
        details: [
          { label: "Pack", value: purchase.packName },
          { label: "Paid", value: formatCents(purchase.amountCents) },
          { label: "Valid until", value: expiry },
          { label: "Reference", value: purchase.reference },
          ...(sharedNames.length ? [{ label: "Shared with", value: sharedNames.join("\n") }] : [])
        ],
        detailsTitle: "Your purchase",
        note: { title: "What your credits cover", lines: worthLines(purchase.credits) },
        cta: { label: "Book a class", url: "https://dharma-space.com/classes" },
        closing: [
          sharedNames.length
            ? "Everyone on the pack draws from the same balance, and you can see who used what in My account."
            : "You can share this pack with family or a friend any time from My account → My credits.",
          "This email is your receipt."
        ]
      })
    }),
    ...purchase.sharedWith.map((person) =>
      sendMail(CATEGORY, {
        to: person.email,
        replyTo: inbox,
        subject: `${purchase.owner.name} shared class credits with you`,
        html: renderCustomerEmail({
          eyebrow: "A gift of practice",
          heading: `${purchase.owner.name} shared credits with you`,
          preheader: `Book classes on a shared balance until ${expiry}.`,
          greeting: `Hi ${person.name},`,
          paragraphs: [
            `${purchase.owner.name} bought a ${purchase.packName} pack at Dharma Space and added you to it. You can book classes on the shared balance until ${expiry}.`
          ],
          highlight: { value: String(purchase.credits), label: "shared credits" },
          note: { title: "What the credits cover", lines: worthLines(purchase.credits) },
          cta: { label: "Book a class", url: "https://dharma-space.com/classes" },
          closing: [
            `Sign in with ${person.email} to book. If you haven't set a password, use "Continue with Google".`
          ]
        }),
        text: [
          `Hi ${person.name},`,
          "",
          `${purchase.owner.name} bought a ${purchase.packName} pack at Dharma Space and added you to it.`,
          `You can book classes with the shared balance until ${expiry}.`,
          "",
          worthBlock(purchase.credits),
          "",
          `Sign in at https://dharma-space.com with ${person.email} to book — use "Continue with Google" if you haven't set a password.`,
          "",
          `WhatsApp: ${whatsapp()}`,
          "",
          "Dharma Space Team"
        ].join("\n")
      })
    )
  ]);

  const sent = results.every(Boolean);
  if (sent) console.log("[credit-mail] Sent for", purchase.reference);
  else console.warn("[credit-mail] Partial/failed send for", purchase.reference);
  return sent;
}

/** Tells someone added to a pack after it was bought that they can use it. */
export async function sendCreditShareInviteEmail(input: {
  owner: { name: string };
  person: { name: string; email: string };
  packName: string;
  creditsLeft: number;
  expiresAt: Date;
}) {
  if (!isMailConfigured(CATEGORY)) return false;
  const inbox = inboxFor(CATEGORY);

  return sendMail(CATEGORY, {
    to: input.person.email,
    replyTo: inbox,
    subject: `${input.owner.name} shared class credits with you`,
    html: renderCustomerEmail({
      eyebrow: "A gift of practice",
      heading: `${input.owner.name} shared credits with you`,
      preheader: `${input.creditsLeft} credits to use until ${longDate(input.expiresAt)}.`,
      greeting: `Hi ${input.person.name},`,
      paragraphs: [
        `${input.owner.name} added you to their ${input.packName} pack at Dharma Space. The balance is shared, so book whenever it suits you.`
      ],
      highlight: { value: String(input.creditsLeft), label: "credits left" },
      details: [{ label: "Usable until", value: longDate(input.expiresAt) }],
      note: { title: "What the credits cover", lines: worthLines(input.creditsLeft) },
      cta: { label: "Book a class", url: "https://dharma-space.com/classes" },
      closing: [
        `Sign in with ${input.person.email} to book. If you haven't set a password, use "Continue with Google".`
      ]
    }),
    text: [
      `Hi ${input.person.name},`,
      "",
      `${input.owner.name} added you to their ${input.packName} pack at Dharma Space.`,
      `There are ${input.creditsLeft} credits left, usable until ${longDate(input.expiresAt)}.`,
      "",
      worthBlock(input.creditsLeft),
      "",
      `Sign in at https://dharma-space.com with ${input.person.email} to book — use "Continue with Google" if you haven't set a password.`,
      "",
      `WhatsApp: ${whatsapp()}`,
      "",
      "Dharma Space Team"
    ].join("\n")
  });
}
