import { useEffect, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { useMemberAuth } from "../auth/MemberAuthContext";
import { MemberAuthPanel } from "./MemberAuthPanel";
import { BODY, DISPLAY, ModalShell } from "./ModalShell";
import {
  categoriesLabel,
  clearPendingMembership,
  confirmMembershipPurchase,
  fetchMembershipTiers,
  readPendingMembership,
  savePendingMembership,
  sessionsLabel,
  startMembershipCheckout,
  type MembershipTier
} from "../lib/memberships-api";

/**
 * Joining a plan: sign in, pick a plan, then out to Stripe.
 *
 * Card only, and said so on the button — a membership renews itself every
 * month, which PayNow has no way of doing.
 */
export function MembershipModal({
  onClose,
  initialTierId
}: {
  onClose: () => void;
  initialTierId?: string;
}) {
  const { isLoggedIn, token } = useMemberAuth();
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [stripeReady, setStripeReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [tierId, setTierId] = useState(initialTierId ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMembershipTiers()
      .then(({ tiers: list, stripeReady: ready }) => {
        const sellable = list.filter((t) => !t.soldOut);
        setTiers(list);
        setStripeReady(ready);
        setTierId((current) => current || sellable[0]?.id || "");
      })
      .catch((e) => setError(e.message || "Could not load membership plans"))
      .finally(() => setLoading(false));
  }, []);

  const selected = tiers.find((t) => t.id === tierId) || null;
  // A fixed-length pass is bought once. Nothing about renewal applies to it,
  // and saying otherwise would be the first thing a new person reads.
  const isPass = Boolean(selected?.termDays);

  const handleJoin = async () => {
    if (!token || !selected) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await startMembershipCheckout(token, { tierId: selected.id });
      savePendingMembership({ reference: result.reference, tierName: result.tier.name });
      window.location.href = result.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <ModalShell eyebrow="Membership" title={isPass ? "Start your week" : "Join a plan"} onClose={onClose}>
      {!isLoggedIn ? (
        <>
          <div className="px-8 pt-6 pb-2">
            <p className="text-[13px] text-[#7A7468] leading-relaxed" style={BODY}>
              Your membership lives in your account, so sign in or create one first. It takes a moment and it's free.
            </p>
          </div>
          <MemberAuthPanel compact onSuccess={() => setError("")} />
        </>
      ) : loading ? (
        <p className="p-8 text-[#7A7468] text-[14px]" style={BODY}>
          Loading plans…
        </p>
      ) : (
        <div className="p-8 space-y-7">
          <div className="space-y-3">
            {tiers.map((tier) => {
              const active = tier.id === tierId;
              return (
                <button
                  key={tier.id}
                  type="button"
                  disabled={tier.soldOut}
                  onClick={() => setTierId(tier.id)}
                  className={`w-full text-left p-4 border flex items-start justify-between gap-4 transition-colors duration-200 ${
                    tier.soldOut
                      ? "border-[#2A2825]/10 opacity-50 cursor-not-allowed"
                      : active
                        ? "border-[#C4785A] bg-white"
                        : "border-[#2A2825]/10 hover:border-[#C4785A]/40"
                  }`}
                >
                  <div>
                    <p className="text-[#2A2825] text-[16px]" style={DISPLAY}>
                      {tier.name}
                    </p>
                    <p className="text-[11px] text-[#7A7468] mt-0.5 leading-relaxed" style={BODY}>
                      {tier.termDays
                        ? `${tier.termDays} days, everything · paid once`
                        : `${sessionsLabel(tier.includedSessionsPerMonth)} · ${categoriesLabel(
                            tier.allowedCategories
                          )}`}
                    </p>
                    {tier.soldOut ? (
                      <p className="text-[11px] text-[#C4785A] mt-1" style={BODY}>
                        Fully subscribed
                      </p>
                    ) : tier.placesLeft !== null ? (
                      <p className="text-[11px] text-[#C4785A] mt-1" style={BODY}>
                        {tier.placesLeft} of {tier.maxMembers} places left
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[#2A2825] text-[15px]" style={BODY}>
                      {tier.monthlyPrice}
                      {tier.termDays ? "" : " / mth"}
                    </span>
                    {active && !tier.soldOut && <Check size={16} className="text-[#C4785A]" />}
                  </div>
                </button>
              );
            })}
          </div>

          {isPass && selected ? (
            <div className="bg-[#F2EBE0] p-4">
              <p className="text-[10px] tracking-[0.2em] text-[#C4785A] uppercase mb-1" style={BODY}>
                How the week works
              </p>
              <p className="text-[12px] text-[#2A2825]/75 leading-relaxed" style={BODY}>
                Your {selected.termDays} days start the moment you pay, and everything on the timetable is open to you
                until they're up. Nothing renews and there's nothing to cancel.
              </p>
            </div>
          ) : selected?.rateHeldMonths ? (
            <div className="bg-[#F2EBE0] p-4">
              <p className="text-[10px] tracking-[0.2em] text-[#C4785A] uppercase mb-1" style={BODY}>
                Founding rate
              </p>
              <p className="text-[12px] text-[#2A2825]/75 leading-relaxed" style={BODY}>
                Your {selected.monthlyPrice} a month is held for {selected.rateHeldMonths} months, whatever happens to
                prices in the meantime.
              </p>
            </div>
          ) : null}

          {!stripeReady && (
            <p className="text-[12px] text-[#C4785A]" style={BODY}>
              Online payment isn't available right now — message us on WhatsApp and we'll start your membership.
            </p>
          )}
          {error && (
            <p className="text-[12px] text-red-500 text-center" style={BODY}>
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleJoin}
            disabled={submitting || !selected || selected.soldOut || !stripeReady}
            className="w-full py-4 bg-[#C4785A] text-white text-[12px] tracking-[0.15em] uppercase hover:bg-[#B86848] transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-60"
            style={BODY}
          >
            {submitting
              ? "Opening checkout…"
              : !selected
                ? "Choose a plan"
                : isPass
                  ? `Pay ${selected.monthlyPrice} once — PayNow or card`
                  : `${selected.monthlyPrice} a month — pay by card`}
            <ChevronRight size={14} />
          </button>
          <p className="text-[11px] text-[#7A7468] text-center leading-relaxed" style={BODY}>
            {isPass
              ? `One payment, ${selected?.termDays} days, nothing to cancel. First visit only.`
              : "Renews monthly by card. Three-month minimum term, then cancel any time with 14 days' notice."}
          </p>
        </div>
      )}
    </ModalShell>
  );
}

/**
 * Landing spot after Stripe. Confirms against the session so the plan shows
 * straight away rather than waiting on the webhook.
 */
export function MembershipSuccessModal({ onClose }: { onClose: () => void }) {
  const { isLoggedIn, token } = useMemberAuth();
  const pending = readPendingMembership();
  const [state, setState] = useState<"confirming" | "done" | "pending" | "error">("confirming");
  const [message, setMessage] = useState("");
  const [tierName, setTierName] = useState("");
  const [termDays, setTermDays] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !token) {
      setState("pending");
      setMessage("Sign in to see your plan — we've emailed your welcome note.");
      return;
    }
    const sessionId = new URLSearchParams(window.location.search).get("session_id") || undefined;
    confirmMembershipPurchase(token, { sessionId, reference: pending?.reference })
      .then((res) => {
        setTierName(res.tierName);
        setTermDays(res.termDays);
        setState("done");
        clearPendingMembership();
        // Drop the Stripe session id so a refresh doesn't re-confirm.
        window.history.replaceState({}, "", "/memberships/success");
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "";
        setMessage(msg || "We couldn't confirm the payment just yet.");
        setState(/hasn't completed/i.test(msg) ? "pending" : "error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, token]);

  return (
    <ModalShell
      eyebrow="Membership"
      title={state === "done" ? "You're in" : "Thank you"}
      onClose={onClose}
    >
      <div className="p-8 space-y-5 text-center">
        {state === "confirming" && (
          <p className="text-[#7A7468] text-[14px]" style={BODY}>
            Confirming your payment…
          </p>
        )}

        {state === "done" && (
          <>
            <div className="w-14 h-14 rounded-full bg-[#E8F0E8] text-[#4A6741] flex items-center justify-center mx-auto">
              <Check size={24} />
            </div>
            <p className="text-[#2A2825] text-xl" style={DISPLAY}>
              Welcome to {tierName}
            </p>
            <p className="text-[#7A7468] text-[14px] leading-relaxed" style={BODY}>
              {termDays
                ? `Your ${termDays} days start today — every class on the timetable is open to you until they're up. Nothing renews, and the details are in the email on its way to you.`
                : "Your classes are included from today, and your membership renews each month on the same date. Everything you need is in the welcome email on its way to you."}
            </p>
          </>
        )}

        {(state === "pending" || state === "error") && (
          <>
            <p className="text-[#2A2825] text-lg" style={DISPLAY}>
              {pending ? `${pending.tierName} — payment received` : "Payment received"}
            </p>
            <p className="text-[#7A7468] text-[14px] leading-relaxed" style={BODY}>
              {message} You'll get an email the moment your membership is live.
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
