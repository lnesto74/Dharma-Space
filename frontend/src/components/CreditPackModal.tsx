import { useEffect, useState } from "react";
import { Check, ChevronRight, Plus, X } from "lucide-react";
import { useMemberAuth } from "../auth/MemberAuthContext";
import { MemberAuthPanel } from "./MemberAuthPanel";
import {
  confirmCreditPurchase,
  creditsExpiryLabel,
  fetchCreditPacks,
  readPendingCreditPurchase,
  clearPendingCreditPurchase,
  savePendingCreditPurchase,
  startCreditPackCheckout,
  type CreditPack
} from "../lib/credits-api";

const PANEL = "bg-[#FAF8F3] w-full sm:max-w-lg max-h-[95vh] overflow-y-auto";
const BODY = { fontFamily: "var(--font-body)" } as const;
const DISPLAY = { fontFamily: "var(--font-display)" } as const;

function ModalShell({
  eyebrow,
  title,
  onClose,
  children
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[#1A1815]/70 backdrop-blur-sm p-0 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={PANEL}>
        <div className="flex items-start justify-between p-8 border-b border-[#2A2825]/8">
          <div>
            <p className="text-[10px] tracking-[0.25em] text-[#C4785A] uppercase mb-1" style={BODY}>
              {eyebrow}
            </p>
            <h2 className="text-2xl font-normal text-[#2A2825]" style={DISPLAY}>
              {title}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-[#2A2825]/40 hover:text-[#2A2825] transition-colors p-1 mt-1">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Buying a pack: sign in, pick a size, optionally name the people who may spend
 * from it, then out to Stripe. The people are chosen before payment so the pack
 * is ready to share the moment it's paid for.
 */
export function CreditPackModal({ onClose, initialPackId }: { onClose: () => void; initialPackId?: string }) {
  const { isLoggedIn, token, member } = useMemberAuth();
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [stripeReady, setStripeReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [packId, setPackId] = useState(initialPackId ?? "");
  const [emails, setEmails] = useState<string[]>([]);
  const [emailDraft, setEmailDraft] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCreditPacks()
      .then(({ packs: list, stripeReady: ready }) => {
        setPacks(list);
        setStripeReady(ready);
        setPackId((current) => current || list[1]?.id || list[0]?.id || "");
      })
      .catch((e) => setError(e.message || "Could not load credit packs"))
      .finally(() => setLoading(false));
  }, []);

  const selected = packs.find((p) => p.id === packId) || null;

  const addEmail = () => {
    const email = emailDraft.trim().toLowerCase();
    if (!email) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("That doesn't look like an email address.");
      return;
    }
    if (email === member?.email.toLowerCase()) {
      setError("You can already use this pack — no need to add yourself.");
      return;
    }
    if (emails.includes(email)) {
      setEmailDraft("");
      return;
    }
    setEmails([...emails, email]);
    setEmailDraft("");
    setError("");
  };

  const handleBuy = async () => {
    if (!token || !selected) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await startCreditPackCheckout(token, {
        packId: selected.id,
        shareEmails: emails.length ? emails : undefined
      });
      savePendingCreditPurchase({
        reference: result.reference,
        packName: result.pack.name,
        credits: result.pack.credits
      });
      window.location.href = result.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <ModalShell eyebrow="Class credits" title="Buy a credit pack" onClose={onClose}>
      {!isLoggedIn ? (
        <>
          <div className="px-8 pt-6 pb-2">
            <p className="text-[13px] text-[#7A7468] leading-relaxed" style={BODY}>
              Credits are held in your account, so sign in or create one first. It takes a moment and it's free.
            </p>
          </div>
          <MemberAuthPanel compact onSuccess={() => setError("")} />
        </>
      ) : loading ? (
        <p className="p-8 text-[#7A7468] text-[14px]" style={BODY}>
          Loading packs…
        </p>
      ) : (
        <div className="p-8 space-y-7">
          <div className="space-y-3">
            {packs.map((pack) => {
              const active = pack.id === packId;
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setPackId(pack.id)}
                  className={`w-full text-left p-4 border flex items-center justify-between gap-4 transition-colors duration-200 ${
                    active ? "border-[#C4785A] bg-white" : "border-[#2A2825]/10 hover:border-[#C4785A]/40"
                  }`}
                >
                  <div>
                    <p className="text-[#2A2825] text-[16px]" style={DISPLAY}>
                      {pack.credits} credits
                    </p>
                    <p className="text-[11px] text-[#7A7468] mt-0.5" style={BODY}>
                      {pack.perCredit} per credit · valid {pack.validMonths} months
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#2A2825] text-[15px]" style={BODY}>
                      {pack.price}
                    </span>
                    {active && <Check size={16} className="text-[#C4785A]" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="bg-[#F2EBE0] p-4 space-y-1">
            <p className="text-[10px] tracking-[0.2em] text-[#C4785A] uppercase mb-1" style={BODY}>
              Credits per class
            </p>
            <p className="text-[12px] text-[#2A2825]/75 leading-relaxed" style={BODY}>
              Yoga 2 · Aerial 3 · Dance 3 · Sound healing 4 · Ceremony 5 · Meditation free
            </p>
          </div>

          <div>
            <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={BODY}>
              Share with (optional)
            </label>
            <p className="text-[12px] text-[#7A7468] mb-3 leading-relaxed" style={BODY}>
              Add the people who may book from this pack. They'll get an email and draw on the same balance.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={emailDraft}
                placeholder="name@email.com"
                onChange={(e) => setEmailDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addEmail();
                  }
                }}
                className="flex-1 bg-[#EDE5D8] px-4 py-3 text-[14px] text-[#2A2825] placeholder-[#7A7468]/60 focus:outline-none focus:ring-1 focus:ring-[#C4785A]"
                style={BODY}
              />
              <button
                type="button"
                onClick={addEmail}
                className="px-4 bg-[#2A2825] text-white hover:bg-[#C4785A] transition-colors duration-200"
                aria-label="Add person"
              >
                <Plus size={16} />
              </button>
            </div>
            {emails.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {emails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-2 bg-white border border-[#2A2825]/10 px-3 py-1.5 text-[12px] text-[#2A2825]"
                    style={BODY}
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => setEmails(emails.filter((e) => e !== email))}
                      className="text-[#7A7468] hover:text-[#C4785A]"
                      aria-label={`Remove ${email}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {!stripeReady && (
            <p className="text-[12px] text-[#C4785A]" style={BODY}>
              Online payment isn't available right now — message us on WhatsApp and we'll set up your credits.
            </p>
          )}
          {error && (
            <p className="text-[12px] text-red-500 text-center" style={BODY}>
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleBuy}
            disabled={submitting || !selected || !stripeReady}
            className="w-full py-4 bg-[#C4785A] text-white text-[12px] tracking-[0.15em] uppercase hover:bg-[#B86848] transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-60"
            style={BODY}
          >
            {submitting ? "Opening checkout…" : selected ? `Pay ${selected.price} — PayNow or card` : "Choose a pack"}
            <ChevronRight size={14} />
          </button>
          <p className="text-[11px] text-[#7A7468] text-center leading-relaxed" style={BODY}>
            Credits last {selected?.validMonths ?? 6} months from purchase and are deducted automatically when you book.
          </p>
        </div>
      )}
    </ModalShell>
  );
}

/**
 * Landing spot after Stripe. Confirms the purchase against the session so the
 * balance shows immediately rather than waiting on the webhook.
 */
export function CreditPurchaseSuccessModal({ onClose }: { onClose: () => void }) {
  const { isLoggedIn, token } = useMemberAuth();
  const pending = readPendingCreditPurchase();
  const [state, setState] = useState<"confirming" | "done" | "pending" | "error">("confirming");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ credits: number; packName: string; expiresAt: string } | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !token) {
      setState("pending");
      setMessage("Sign in to see your new balance — we've emailed your receipt.");
      return;
    }
    const sessionId = new URLSearchParams(window.location.search).get("session_id") || undefined;
    confirmCreditPurchase(token, { sessionId, reference: pending?.reference })
      .then((res) => {
        setResult({ credits: res.credits, packName: res.packName, expiresAt: res.expiresAt });
        setState("done");
        clearPendingCreditPurchase();
        // Drop the Stripe session id so a refresh doesn't re-confirm.
        window.history.replaceState({}, "", "/credits/success");
      })
      .catch((err) => {
        // PayNow can settle after the tab closes — that isn't a failure, the
        // webhook will finish it and the receipt email follows.
        const msg = err instanceof Error ? err.message : "";
        setMessage(msg || "We couldn't confirm the payment just yet.");
        setState(/hasn't completed/i.test(msg) ? "pending" : "error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, token]);

  return (
    <ModalShell eyebrow="Class credits" title={state === "done" ? "Credits added" : "Thank you"} onClose={onClose}>
      <div className="p-8 space-y-5 text-center">
        {state === "confirming" && (
          <p className="text-[#7A7468] text-[14px]" style={BODY}>
            Confirming your payment…
          </p>
        )}

        {state === "done" && result && (
          <>
            <div className="w-14 h-14 rounded-full bg-[#E8F0E8] text-[#4A6741] flex items-center justify-center mx-auto">
              <Check size={24} />
            </div>
            <p className="text-[#2A2825] text-xl" style={DISPLAY}>
              {result.credits} credits are ready to use
            </p>
            <p className="text-[#7A7468] text-[14px] leading-relaxed" style={BODY}>
              {result.packName} · valid until {creditsExpiryLabel(result.expiresAt)}. Credits come off automatically
              when you book a class, and your receipt is on its way by email.
            </p>
          </>
        )}

        {(state === "pending" || state === "error") && (
          <>
            <p className="text-[#2A2825] text-lg" style={DISPLAY}>
              {pending ? `${pending.packName} — payment received` : "Payment received"}
            </p>
            <p className="text-[#7A7468] text-[14px] leading-relaxed" style={BODY}>
              {message} You'll get an email the moment the credits land in your account.
            </p>
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-4 bg-[#C4785A] text-white text-[12px] tracking-[0.15em] uppercase hover:bg-[#B86848] transition-colors duration-300"
          style={BODY}
        >
          Book a class
        </button>
      </div>
    </ModalShell>
  );
}
