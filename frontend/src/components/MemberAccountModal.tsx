import { useEffect, useState } from "react";
import { ChevronRight, LogOut, Plus, X } from "lucide-react";
import { useMemberAuth } from "../auth/MemberAuthContext";
import {
  fetchBookableOfferings,
  fetchMemberBookings,
  memberHasActiveBooking,
  type BookableOffering,
  type MemberBooking
} from "../lib/member-api";
import { MemberAuthPanel } from "./MemberAuthPanel";
import { programActionLabel, programToReserveInfo, type ReserveInfo } from "../lib/education";
import type { SiteProgram } from "../lib/site-content";
import {
  creditsExpiryLabel,
  creditsWorth,
  fetchMemberCredits,
  shareCreditWallet,
  unshareCreditWallet,
  type CreditSummary,
  type CreditWallet
} from "../lib/credits-api";

type MemberAccountModalProps = {
  onClose: () => void;
  onBookProgram?: (info: ReserveInfo) => void;
  onBookClass?: (info: {
    type: string;
    day: string;
    time: string;
    instructor: string;
    level: string;
    location: string;
    classId?: string;
    stripeLink?: string | null;
    price?: string;
    comingSoon?: boolean;
  }) => void;
  onBuyCredits?: () => void;
};

function bookingStatusLabel(booking: MemberBooking) {
  if (booking.status === "PAID") return "Paid";
  if (booking.status === "CANCELLED") return "Cancelled";
  return "Awaiting payment";
}

/**
 * One credit pack: the balance, who else can spend it, and — for the buyer —
 * the controls to add or remove people.
 */
function CreditWalletCard({
  wallet,
  costs,
  token,
  onSummary
}: {
  wallet: CreditWallet;
  costs: Record<string, number>;
  token: string;
  onSummary: (summary: CreditSummary) => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const expired = wallet.status !== "ACTIVE";

  const add = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { summary } = await shareCreditWallet(token, wallet.id, email.trim());
      setEmail("");
      onSummary(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not share this pack");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (memberId: string) => {
    setBusy(true);
    try {
      const { summary } = await unshareCreditWallet(token, wallet.id, memberId);
      onSummary(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update sharing");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`border border-[#2A2825]/8 p-5 bg-white ${expired ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[#2A2825] text-lg" style={{ fontFamily: "var(--font-display)" }}>
            {wallet.creditsLeft} of {wallet.creditsTotal} credits left
          </p>
          <p className="text-[12px] text-[#7A7468] mt-1" style={{ fontFamily: "var(--font-body)" }}>
            {wallet.packName} ·{" "}
            {expired ? "Expired" : `valid until ${creditsExpiryLabel(wallet.expiresAt)}`}
          </p>
          {!wallet.isOwner && (
            <p className="text-[12px] text-[#7A7468]" style={{ fontFamily: "var(--font-body)" }}>
              Shared with you by {wallet.owner.name}
            </p>
          )}
        </div>
        <span
          className={`text-[10px] tracking-[0.15em] uppercase px-2 py-1 ${
            expired ? "bg-[#F2EBE0] text-[#7A7468]" : "bg-[#E8F0E8] text-[#4A6741]"
          }`}
        >
          {expired ? "Expired" : "Active"}
        </span>
      </div>

      {!expired && wallet.creditsLeft > 0 && (
        <p className="text-[11px] text-[#7A7468] mt-3" style={{ fontFamily: "var(--font-body)" }}>
          Worth {creditsWorth(wallet.creditsLeft, costs)} classes · meditation free
        </p>
      )}

      {(wallet.sharedWith.length > 0 || wallet.isOwner) && (
        <div className="mt-4 pt-4 border-t border-[#2A2825]/8">
          <p className="text-[10px] tracking-[0.2em] text-[#C4785A] uppercase mb-2" style={{ fontFamily: "var(--font-body)" }}>
            Shared with
          </p>
          {wallet.sharedWith.length ? (
            <div className="flex flex-wrap gap-2">
              {wallet.sharedWith.map((person) => (
                <span
                  key={person.memberId}
                  className="inline-flex items-center gap-2 bg-[#F2EBE0] px-3 py-1.5 text-[12px] text-[#2A2825]"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {person.name}
                  {wallet.isOwner && !expired && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(person.memberId)}
                      className="text-[#7A7468] hover:text-[#C4785A] disabled:opacity-50"
                      aria-label={`Remove ${person.name}`}
                    >
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[#7A7468]" style={{ fontFamily: "var(--font-body)" }}>
              Only you can use this pack.
            </p>
          )}

          {wallet.isOwner && !expired && (
            <div className="flex gap-2 mt-3">
              <input
                type="email"
                value={email}
                placeholder="Add someone by email"
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add();
                  }
                }}
                className="flex-1 bg-[#EDE5D8] px-3 py-2 text-[13px] text-[#2A2825] placeholder-[#7A7468]/60 focus:outline-none focus:ring-1 focus:ring-[#C4785A]"
                style={{ fontFamily: "var(--font-body)" }}
              />
              <button
                type="button"
                onClick={add}
                disabled={busy}
                className="px-3 bg-[#2A2825] text-white hover:bg-[#C4785A] transition-colors disabled:opacity-50"
                aria-label="Share pack"
              >
                <Plus size={14} />
              </button>
            </div>
          )}
          {error && <p className="text-[11px] text-red-500 mt-2">{error}</p>}
        </div>
      )}

      {wallet.history.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#2A2825]/8 space-y-1.5">
          {wallet.history.slice(0, 4).map((entry, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3">
              <p className="text-[12px] text-[#7A7468] truncate" style={{ fontFamily: "var(--font-body)" }}>
                {entry.reason}
                {entry.memberName && !wallet.isOwner ? "" : entry.memberName ? ` · ${entry.memberName}` : ""}
              </p>
              <span
                className={`text-[12px] shrink-0 ${entry.credits < 0 ? "text-[#C4785A]" : "text-[#4A6741]"}`}
                style={{ fontFamily: "var(--font-body)" }}
              >
                {entry.credits > 0 ? `+${entry.credits}` : entry.credits}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MemberAccountModal({ onClose, onBookProgram, onBookClass, onBuyCredits }: MemberAccountModalProps) {
  const { isLoggedIn, member, logout, token } = useMemberAuth();
  const [tab, setTab] = useState<"bookings" | "credits" | "offerings">("bookings");
  const [bookings, setBookings] = useState<MemberBooking[]>([]);
  const [programs, setPrograms] = useState<BookableOffering[]>([]);
  const [classes, setClasses] = useState<BookableOffering[]>([]);
  const [credits, setCredits] = useState<CreditSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    setError("");
    Promise.all([fetchMemberBookings(token), fetchBookableOfferings(), fetchMemberCredits(token)])
      .then(([bookingsRes, offeringsRes, creditsRes]) => {
        setBookings(bookingsRes.bookings);
        setPrograms(offeringsRes.programs);
        setClasses(offeringsRes.classes);
        setCredits(creditsRes);
      })
      .catch((e) => setError(e.message || "Could not load account"))
      .finally(() => setLoading(false));
  }, [isLoggedIn, token]);

  const handleBookProgram = (program: BookableOffering) => {
    if (!onBookProgram) return;
    onClose();
    onBookProgram(
      programToReserveInfo({
        id: program.id,
        category: program.category || "EVENT",
        title: program.title,
        description: "",
        dates: program.dates || "Coming Soon",
        time: program.time || "",
        location: program.location || "Dharma Space Studio",
        facilitator: program.facilitator || "",
        price: program.price || "",
        comingSoon: program.comingSoon,
        soldOut: program.soldOut,
        stripeLink: program.stripeLink,
        usePayNow: program.usePayNow,
        singlePerson: true
      } as SiteProgram)
    );
  };

  const handleBookClass = (siteClass: BookableOffering) => {
    if (!onBookClass) return;
    onClose();
    onBookClass({
      type: siteClass.classType || siteClass.title,
      day: siteClass.day || siteClass.dates || "",
      time: siteClass.time || "",
      instructor: siteClass.instructor || "",
      level: "All Levels",
      location: siteClass.location || "Dharma Space Studio",
      classId: siteClass.id,
      stripeLink: siteClass.stripeLink,
      price: siteClass.price,
      comingSoon: siteClass.comingSoon
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[#1A1815]/70 backdrop-blur-sm p-0 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#FAF8F3] w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-start justify-between p-8 border-b border-[#2A2825]/8">
          <div>
            <p className="text-[10px] tracking-[0.25em] text-[#C4785A] uppercase mb-1" style={{ fontFamily: "var(--font-body)" }}>
              My account
            </p>
            <h2 className="text-2xl font-normal text-[#2A2825]" style={{ fontFamily: "var(--font-display)" }}>
              {isLoggedIn ? member?.name : "Sign in or join"}
            </h2>
            {!isLoggedIn && (
              <p className="text-[13px] text-[#7A7468] mt-1" style={{ fontFamily: "var(--font-body)" }}>
                Use Google or email — free account for bookings
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-[#2A2825]/40 hover:text-[#2A2825] p-1">
            <X size={20} />
          </button>
        </div>

        {!isLoggedIn ? (
          <MemberAuthPanel onSuccess={() => setTab("bookings")} />
        ) : (
          <>
            <div className="px-8 pt-6 flex items-center justify-between gap-4">
              <p className="text-[13px] text-[#7A7468]" style={{ fontFamily: "var(--font-body)" }}>{member?.email}</p>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 text-[12px] tracking-[0.1em] uppercase text-[#2A2825]/60 hover:text-[#2A2825]"
                style={{ fontFamily: "var(--font-body)" }}
              >
                <LogOut size={14} /> Log out
              </button>
            </div>

            <div className="px-8 pt-4 flex flex-wrap gap-2">
              {(["bookings", "credits", "offerings"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`px-4 py-2 text-[11px] tracking-[0.12em] uppercase border ${
                    tab === key ? "border-[#C4785A] bg-[#C4785A] text-white" : "border-[#2A2825]/15 text-[#2A2825]/60"
                  }`}
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {key === "bookings"
                    ? "My bookings"
                    : key === "credits"
                      ? `My credits${credits?.creditsLeft ? ` (${credits.creditsLeft})` : ""}`
                      : "Book something"}
                </button>
              ))}
            </div>

            <div className="p-8">
              {error && <p className="text-[12px] text-red-500 mb-4">{error}</p>}
              {loading ? (
                <p className="text-[#7A7468] text-[14px]">Loading…</p>
              ) : tab === "bookings" ? (
                bookings.length ? (
                  <div className="space-y-4">
                    {bookings.map((booking) => (
                      <div key={booking.id} className="border border-[#2A2825]/8 p-5 bg-white">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[#2A2825] text-lg" style={{ fontFamily: "var(--font-display)" }}>{booking.offeringTitle}</p>
                            <p className="text-[12px] text-[#7A7468] mt-1" style={{ fontFamily: "var(--font-body)" }}>
                              {booking.scheduledLabel}{booking.time ? ` · ${booking.time}` : ""}
                            </p>
                            <p className="text-[12px] text-[#7A7468]" style={{ fontFamily: "var(--font-body)" }}>{booking.location}</p>
                          </div>
                          <span className={`text-[10px] tracking-[0.15em] uppercase px-2 py-1 ${booking.status === "PAID" ? "bg-[#E8F0E8] text-[#4A6741]" : "bg-[#F2EBE0] text-[#C4785A]"}`}>
                            {bookingStatusLabel(booking)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#7A7468] mt-3" style={{ fontFamily: "var(--font-body)" }}>
                          Ref {booking.reference} · {booking.price} · {booking.guests} guest{booking.guests > 1 ? "s" : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[#7A7468] text-[14px]">No bookings yet. Browse offerings to reserve your spot.</p>
                )
              ) : tab === "credits" ? (
                <div className="space-y-4">
                  {credits?.wallets.length ? (
                    <>
                      <p className="text-[13px] text-[#7A7468]" style={{ fontFamily: "var(--font-body)" }}>
                        {credits.creditsLeft} credits available
                        {credits.nextExpiry ? ` · next expiry ${creditsExpiryLabel(credits.nextExpiry)}` : ""}
                      </p>
                      {credits.wallets.map((wallet) => (
                        <CreditWalletCard
                          key={wallet.id}
                          wallet={wallet}
                          costs={credits.costs}
                          token={token}
                          onSummary={setCredits}
                        />
                      ))}
                    </>
                  ) : (
                    <p className="text-[#7A7468] text-[14px]" style={{ fontFamily: "var(--font-body)" }}>
                      No credits yet. A pack is cheaper per class than walking up, lasts six months, and can be shared
                      with family or a friend.
                    </p>
                  )}
                  {onBuyCredits && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onBuyCredits();
                      }}
                      className="w-full py-3.5 border border-[#C4785A] text-[#C4785A] text-[11px] tracking-[0.15em] uppercase hover:bg-[#C4785A] hover:text-white transition-colors duration-300"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      Buy credits
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-8">
                  {programs.length > 0 && (
                    <div>
                      <p className="text-[10px] tracking-[0.25em] text-[#C4785A] uppercase mb-3" style={{ fontFamily: "var(--font-body)" }}>Programs & events</p>
                      <div className="space-y-3">
                        {programs.map((program) => {
                          const booked = memberHasActiveBooking(bookings, { siteProgramId: program.id, offeringTitle: program.title });
                          return (
                          <button
                            key={program.id}
                            type="button"
                            disabled={booked}
                            onClick={() => !booked && handleBookProgram(program)}
                            className={`w-full text-left border border-[#2A2825]/8 p-4 transition-colors flex items-center justify-between gap-4 ${booked ? "opacity-60 cursor-not-allowed" : "hover:border-[#C4785A]/40"}`}
                          >
                            <div>
                              <p className="text-[#2A2825]" style={{ fontFamily: "var(--font-display)" }}>{program.title}</p>
                              <p className="text-[12px] text-[#7A7468]" style={{ fontFamily: "var(--font-body)" }}>{program.dates} · {program.price}</p>
                            </div>
                            <span className="text-[11px] tracking-[0.12em] uppercase text-[#C4785A] inline-flex items-center gap-1" style={{ fontFamily: "var(--font-body)" }}>
                              {booked ? "Already booked" : <>{programActionLabel(program)} <ChevronRight size={12} /></>}
                            </span>
                          </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {classes.length > 0 && (
                    <div>
                      <p className="text-[10px] tracking-[0.25em] text-[#C4785A] uppercase mb-3" style={{ fontFamily: "var(--font-body)" }}>Regular classes</p>
                      <div className="space-y-3">
                        {classes.map((siteClass) => {
                          const booked = memberHasActiveBooking(bookings, { siteClassId: siteClass.id, offeringTitle: siteClass.classType || siteClass.title });
                          return (
                          <button
                            key={siteClass.id}
                            type="button"
                            disabled={booked}
                            onClick={() => !booked && handleBookClass(siteClass)}
                            className={`w-full text-left border border-[#2A2825]/8 p-4 transition-colors flex items-center justify-between gap-4 ${booked ? "opacity-60 cursor-not-allowed" : "hover:border-[#C4785A]/40"}`}
                          >
                            <div>
                              <p className="text-[#2A2825]" style={{ fontFamily: "var(--font-display)" }}>{siteClass.classType || siteClass.title}</p>
                              <p className="text-[12px] text-[#7A7468]" style={{ fontFamily: "var(--font-body)" }}>{siteClass.day} · {siteClass.time}</p>
                            </div>
                            <span className="text-[11px] tracking-[0.12em] uppercase text-[#C4785A] inline-flex items-center gap-1" style={{ fontFamily: "var(--font-body)" }}>
                              {booked ? "Already booked" : <>Book <ChevronRight size={12} /></>}
                            </span>
                          </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
