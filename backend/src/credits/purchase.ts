/**
 * Buying a credit pack.
 *
 * A purchase is two rows written up front: a CreditWallet held at PENDING and a
 * Payment held at PENDING. Neither the balance nor the sharing takes effect
 * until the money arrives — `isSpendable` only accepts ACTIVE wallets — so an
 * abandoned checkout leaves nothing spendable behind.
 *
 * The wallet is created before checkout rather than after payment so the people
 * it is shared with are settled before money changes hands, and so a webhook
 * that arrives twice has something stable to be idempotent against.
 */

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import type { Prisma, PrismaClient, SiteMember } from "@prisma/client";
import { CREDIT_COSTS, centsPerCredit } from "./packs.js";
import { creditsRemaining, walletExpiryFrom } from "./wallet.js";
import { sendCreditPackPurchasedEmails, sendCreditShareInviteEmail } from "./emails.js";
import { formatCents } from "../payments/money.js";
import { openPayment } from "../payments/ledger.js";

type Db = PrismaClient | Prisma.TransactionClient;

/** Recognisable in the Stripe dashboard and short enough to read aloud. */
export function packReference() {
  return `PACK-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** Marks a Stripe session as buying credits rather than paying for a booking. */
export const CREDIT_PACK_PURCHASE = "CREDIT_PACK";

export async function listPacksForSale(prisma: PrismaClient) {
  const packs = await prisma.creditPack.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" }
  });

  return packs.map((pack) => ({
    id: pack.id,
    name: pack.name,
    credits: pack.credits,
    priceCents: pack.priceCents,
    price: formatCents(pack.priceCents),
    validMonths: pack.validMonths,
    perCreditCents: centsPerCredit(pack),
    perCredit: formatCents(centsPerCredit(pack))
  }));
}

/**
 * People a pack is shared with don't need an account yet. An email with no
 * account gets a placeholder one, the same way the admin membership form does,
 * so the credits are waiting the first time they sign in.
 */
async function resolveShareMembers(prisma: PrismaClient, owner: SiteMember, emails: string[]) {
  const wanted = [...new Set(emails.map((e) => e.toLowerCase().trim()).filter(Boolean))].filter(
    (email) => email !== owner.email.toLowerCase()
  );
  if (!wanted.length) return [];

  const existing = await prisma.siteMember.findMany({ where: { email: { in: wanted } } });
  const byEmail = new Map(existing.map((m) => [m.email, m]));

  const members: SiteMember[] = [];
  for (const email of wanted) {
    const found = byEmail.get(email);
    if (found) {
      members.push(found);
      continue;
    }
    members.push(
      await prisma.siteMember.create({
        data: {
          name: email.split("@")[0],
          email,
          passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 12)
        }
      })
    );
  }
  return members;
}

export type StartedPurchase = {
  reference: string;
  walletId: string;
  amountCents: number;
  pack: { id: string; name: string; credits: number; priceCents: number; validMonths: number };
  sharedWith: { id: string; name: string; email: string }[];
};

/**
 * Reserves the wallet and opens the payment. The caller sends the buyer to the
 * gateway with `reference` and `walletId`, which come back on the webhook.
 */
export async function startPackPurchase(
  prisma: PrismaClient,
  member: SiteMember,
  input: { packId: string; shareEmails?: string[] }
): Promise<StartedPurchase> {
  const pack = await prisma.creditPack.findUnique({ where: { id: input.packId } });
  if (!pack || !pack.isActive) {
    throw Object.assign(new Error("That credit pack is not on sale."), { status: 404 });
  }

  const shared = await resolveShareMembers(prisma, member, input.shareEmails ?? []);
  const reference = packReference();
  const now = new Date();

  const wallet = await prisma.$transaction(async (tx) => {
    const created = await tx.creditWallet.create({
      data: {
        packId: pack.id,
        ownerId: member.id,
        creditsTotal: pack.credits,
        // Provisional — reset to the settlement date when the payment lands, so
        // the six months run from when the credits become usable.
        expiresAt: walletExpiryFrom(now),
        status: "PENDING",
        purchaseRef: reference,
        notes: `${pack.name} — awaiting payment`,
        sharedWith: { create: shared.map((m) => ({ memberId: m.id })) }
      }
    });

    await openPayment(tx, {
      bookingId: null,
      memberId: member.id,
      reference,
      provider: "STRIPE",
      method: "CARD",
      amountCents: pack.priceCents
    });

    return created;
  });

  return {
    reference,
    walletId: wallet.id,
    amountCents: pack.priceCents,
    pack: {
      id: pack.id,
      name: pack.name,
      credits: pack.credits,
      priceCents: pack.priceCents,
      validMonths: pack.validMonths
    },
    sharedWith: shared.map((m) => ({ id: m.id, name: m.name, email: m.email }))
  };
}

export type FulfilledPurchase = {
  walletId: string;
  credits: number;
  expiresAt: Date;
  packName: string;
  alreadyFulfilled: boolean;
};

/**
 * Turns a paid purchase into a spendable balance. Idempotent: a webhook replay,
 * or the browser confirming the same session on its way back from Stripe, finds
 * the wallet already ACTIVE and changes nothing.
 */
export async function fulfilPackPurchase(
  prisma: PrismaClient,
  reference: string,
  opts: { providerRef?: string | null; providerPaymentRef?: string | null } = {}
): Promise<FulfilledPurchase | null> {
  const wallet = await prisma.creditWallet.findUnique({
    where: { purchaseRef: reference },
    include: { pack: true }
  });
  if (!wallet) return null;

  const packName = wallet.pack?.name ?? `${wallet.creditsTotal} credits`;
  if (wallet.status === "ACTIVE") {
    return {
      walletId: wallet.id,
      credits: wallet.creditsTotal,
      expiresAt: wallet.expiresAt,
      packName,
      alreadyFulfilled: true
    };
  }
  if (wallet.status !== "PENDING") {
    throw Object.assign(new Error(`This purchase is ${wallet.status.toLowerCase()}.`), { status: 409 });
  }

  const paidAt = new Date();
  const expiresAt = walletExpiryFrom(paidAt);

  await prisma.$transaction(async (tx) => {
    // Guarded on PENDING so two concurrent settlements can't both open the
    // wallet and write two opening entries.
    const claimed = await tx.creditWallet.updateMany({
      where: { id: wallet.id, status: "PENDING" },
      data: { status: "ACTIVE", purchasedAt: paidAt, expiresAt, notes: packName }
    });
    if (claimed.count === 0) return;

    await tx.creditLedgerEntry.create({
      data: {
        walletId: wallet.id,
        memberId: wallet.ownerId,
        credits: wallet.creditsTotal,
        reason: `${packName} purchased`
      }
    });

    const payment = await tx.payment.findFirst({ where: { reference, bookingId: null } });
    if (payment) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          paidAt,
          ...(opts.providerRef ? { providerRef: opts.providerRef } : {}),
          ...(opts.providerPaymentRef ? { providerPaymentRef: opts.providerPaymentRef } : {})
        }
      });
    }
  });

  return { walletId: wallet.id, credits: wallet.creditsTotal, expiresAt, packName, alreadyFulfilled: false };
}

/**
 * The single point every rail settles a pack through — Stripe's webhook, the
 * browser returning from checkout, or a counter sale. Fulfils once and emails
 * once, so whichever gets here first wins and the rest are no-ops.
 */
export async function completePackPurchase(
  prisma: PrismaClient,
  reference: string,
  opts: { providerRef?: string | null; providerPaymentRef?: string | null } = {}
) {
  const result = await fulfilPackPurchase(prisma, reference, opts);
  if (!result || result.alreadyFulfilled) return result;

  const wallet = await prisma.creditWallet.findUnique({
    where: { id: result.walletId },
    include: { owner: true, sharedWith: { include: { member: true } } }
  });
  if (!wallet) return result;

  const payment = await prisma.payment.findFirst({ where: { reference, bookingId: null } });

  await sendCreditPackPurchasedEmails({
    reference,
    packName: result.packName,
    credits: result.credits,
    amountCents: payment?.amountCents ?? 0,
    expiresAt: result.expiresAt,
    owner: { name: wallet.owner.name, email: wallet.owner.email },
    sharedWith: wallet.sharedWith.map((s) => ({ name: s.member.name, email: s.member.email }))
  }).catch((error) => {
    console.error("[credit-mail] purchase confirmation failed:", error);
  });

  return result;
}

/** The gateway told us the payment failed. The wallet stays PENDING for a retry. */
export async function failPackPurchase(prisma: PrismaClient, reference: string, reason: string) {
  await prisma.payment.updateMany({
    where: { reference, bookingId: null, status: "PENDING" },
    data: { status: "FAILED", failureReason: reason.slice(0, 500) }
  });
}

/** Checkout was abandoned — drop the reservation so it doesn't linger as unpaid credits. */
export async function voidPackPurchase(prisma: PrismaClient, reference: string) {
  await prisma.$transaction(async (tx) => {
    await tx.creditWallet.updateMany({
      where: { purchaseRef: reference, status: "PENDING" },
      data: { status: "CANCELLED", notes: "Checkout not completed" }
    });
    await tx.payment.updateMany({
      where: { reference, bookingId: null, status: "PENDING" },
      data: { status: "CANCELLED" }
    });
  });
}

/** Records a pack sold at the counter — paid in full, usable immediately. */
export async function recordCounterPackSale(
  prisma: PrismaClient,
  input: {
    member: SiteMember;
    packId: string;
    provider: "QASHIER" | "CASH" | "PAYNOW" | "MANUAL";
    method: "CARD" | "CASH" | "PAYNOW" | "OTHER";
    shareEmails?: string[];
  }
) {
  const started = await startPackPurchase(prisma, input.member, {
    packId: input.packId,
    shareEmails: input.shareEmails
  });
  await prisma.payment.updateMany({
    where: { reference: started.reference, bookingId: null },
    data: { provider: input.provider, method: input.method }
  });
  // Settled through the same door as Stripe, so someone who pays at the desk
  // gets the same receipt as someone who pays online.
  const fulfilled = await completePackPurchase(prisma, started.reference);
  return { ...started, fulfilled };
}

export type WalletView = {
  id: string;
  packName: string;
  creditsTotal: number;
  creditsUsed: number;
  creditsLeft: number;
  purchasedAt: string;
  expiresAt: string;
  status: string;
  isOwner: boolean;
  owner: { name: string; email: string };
  sharedWith: { memberId: string; name: string; email: string }[];
  history: { credits: number; reason: string; at: string; memberName: string | null }[];
};

/**
 * Everything a member can spend from — their own packs and any shared with
 * them — plus what each class costs, so the account page can say what a
 * balance is actually worth.
 */
export async function memberCreditSummary(prisma: PrismaClient, memberId: string) {
  const wallets = await prisma.creditWallet.findMany({
    where: {
      status: { in: ["ACTIVE", "EXPIRED"] },
      OR: [{ ownerId: memberId }, { sharedWith: { some: { memberId } } }]
    },
    orderBy: { expiresAt: "asc" },
    include: {
      pack: true,
      owner: true,
      sharedWith: { include: { member: true } },
      entries: { orderBy: { createdAt: "desc" }, take: 12, include: { member: true } }
    }
  });

  const now = new Date();
  const views: WalletView[] = wallets.map((wallet) => ({
    id: wallet.id,
    packName: wallet.pack?.name ?? `${wallet.creditsTotal} credits`,
    creditsTotal: wallet.creditsTotal,
    creditsUsed: wallet.creditsUsed,
    creditsLeft: creditsRemaining(wallet),
    purchasedAt: wallet.purchasedAt.toISOString(),
    expiresAt: wallet.expiresAt.toISOString(),
    // Expiry is a date, not an event — a wallet past its date reads as expired
    // whether or not the nightly sweep has relabelled it yet.
    status: wallet.expiresAt <= now ? "EXPIRED" : wallet.status,
    isOwner: wallet.ownerId === memberId,
    owner: { name: wallet.owner.name, email: wallet.owner.email },
    sharedWith: wallet.sharedWith.map((s) => ({
      memberId: s.memberId,
      name: s.member.name,
      email: s.member.email
    })),
    history: wallet.entries.map((entry) => ({
      credits: entry.credits,
      reason: entry.reason,
      at: entry.createdAt.toISOString(),
      memberName: entry.member?.name ?? null
    }))
  }));

  const spendable = views.filter((w) => w.status === "ACTIVE");
  return {
    wallets: views,
    creditsLeft: spendable.reduce((sum, w) => sum + w.creditsLeft, 0),
    nextExpiry: spendable.length ? spendable[0].expiresAt : null,
    costs: CREDIT_COSTS
  };
}

/** Adds someone to a pack. Only the buyer may change who it is shared with. */
export async function shareWallet(
  prisma: PrismaClient,
  owner: SiteMember,
  walletId: string,
  email: string
) {
  const wallet = await prisma.creditWallet.findUnique({ where: { id: walletId } });
  if (!wallet || wallet.ownerId !== owner.id) {
    throw Object.assign(new Error("Credit pack not found."), { status: 404 });
  }
  if (wallet.status !== "ACTIVE") {
    throw Object.assign(new Error("Only an active pack can be shared."), { status: 409 });
  }

  const [member] = await resolveShareMembers(prisma, owner, [email]);
  if (!member) {
    throw Object.assign(new Error("That is your own email — you can already use this pack."), {
      status: 400
    });
  }

  const existing = await prisma.creditWalletMember.findUnique({
    where: { walletId_memberId: { walletId, memberId: member.id } }
  });
  if (!existing) {
    await prisma.creditWalletMember.create({ data: { walletId, memberId: member.id } });
    const pack = wallet.packId
      ? await prisma.creditPack.findUnique({ where: { id: wallet.packId } })
      : null;
    await sendCreditShareInviteEmail({
      owner: { name: owner.name },
      person: { name: member.name, email: member.email },
      packName: pack?.name ?? `${wallet.creditsTotal} credits`,
      creditsLeft: creditsRemaining(wallet),
      expiresAt: wallet.expiresAt
    }).catch((error) => console.error("[credit-mail] share invite failed:", error));
  }

  return { memberId: member.id, name: member.name, email: member.email };
}

/**
 * Removes someone's access. Credits they already spent stay spent — the ledger
 * keeps the history, and the booking they made with them stands.
 */
export async function unshareWallet(
  prisma: PrismaClient,
  owner: SiteMember,
  walletId: string,
  memberId: string
) {
  const wallet = await prisma.creditWallet.findUnique({ where: { id: walletId } });
  if (!wallet || wallet.ownerId !== owner.id) {
    throw Object.assign(new Error("Credit pack not found."), { status: 404 });
  }
  await prisma.creditWalletMember.deleteMany({ where: { walletId, memberId } });
}

/**
 * Relabels packs whose six months have run out. Called on boot so reporting and
 * the admin list agree with what the booking rules already enforce.
 */
export async function expireLapsedWallets(prisma: PrismaClient) {
  const { count } = await prisma.creditWallet.updateMany({
    where: { status: "ACTIVE", expiresAt: { lte: new Date() } },
    data: { status: "EXPIRED" }
  });
  if (count > 0) console.log(`[credits] expired ${count} lapsed credit pack(s)`);
  return count;
}
