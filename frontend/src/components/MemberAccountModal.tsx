import { useEffect, useState } from "react";
import { ChevronRight, LogOut, X } from "lucide-react";
import { useMemberAuth } from "../auth/MemberAuthContext";
import {
  fetchBookableOfferings,
  fetchMemberBookings,
  type BookableOffering,
  type MemberBooking
} from "../lib/member-api";
import { MemberAuthPanel } from "./MemberAuthPanel";
import { programActionLabel, programToReserveInfo, type ReserveInfo } from "../lib/education";
import type { SiteProgram } from "../lib/site-content";

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
};

function bookingStatusLabel(booking: MemberBooking) {
  if (booking.status === "PAID") return "Paid";
  if (booking.status === "CANCELLED") return "Cancelled";
  return "Awaiting payment";
}

export function MemberAccountModal({ onClose, onBookProgram, onBookClass }: MemberAccountModalProps) {
  const { isLoggedIn, member, logout, token } = useMemberAuth();
  const [tab, setTab] = useState<"bookings" | "offerings">("bookings");
  const [bookings, setBookings] = useState<MemberBooking[]>([]);
  const [programs, setPrograms] = useState<BookableOffering[]>([]);
  const [classes, setClasses] = useState<BookableOffering[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    setError("");
    Promise.all([fetchMemberBookings(token), fetchBookableOfferings()])
      .then(([bookingsRes, offeringsRes]) => {
        setBookings(bookingsRes.bookings);
        setPrograms(offeringsRes.programs.filter((p) => p.bookable !== false));
        setClasses(offeringsRes.classes.filter((c) => c.bookable !== false));
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
              {isLoggedIn ? member?.name : "Sign in"}
            </h2>
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

            <div className="px-8 pt-4 flex gap-2">
              {(["bookings", "offerings"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`px-4 py-2 text-[11px] tracking-[0.12em] uppercase border ${
                    tab === key ? "border-[#C4785A] bg-[#C4785A] text-white" : "border-[#2A2825]/15 text-[#2A2825]/60"
                  }`}
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {key === "bookings" ? "My bookings" : "Book something"}
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
              ) : (
                <div className="space-y-8">
                  {programs.length > 0 && (
                    <div>
                      <p className="text-[10px] tracking-[0.25em] text-[#C4785A] uppercase mb-3" style={{ fontFamily: "var(--font-body)" }}>Programs & events</p>
                      <div className="space-y-3">
                        {programs.map((program) => (
                          <button
                            key={program.id}
                            type="button"
                            onClick={() => handleBookProgram(program)}
                            className="w-full text-left border border-[#2A2825]/8 p-4 hover:border-[#C4785A]/40 transition-colors flex items-center justify-between gap-4"
                          >
                            <div>
                              <p className="text-[#2A2825]" style={{ fontFamily: "var(--font-display)" }}>{program.title}</p>
                              <p className="text-[12px] text-[#7A7468]" style={{ fontFamily: "var(--font-body)" }}>{program.dates} · {program.price}</p>
                            </div>
                            <span className="text-[11px] tracking-[0.12em] uppercase text-[#C4785A] inline-flex items-center gap-1" style={{ fontFamily: "var(--font-body)" }}>
                              {programActionLabel(program)} <ChevronRight size={12} />
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {classes.length > 0 && (
                    <div>
                      <p className="text-[10px] tracking-[0.25em] text-[#C4785A] uppercase mb-3" style={{ fontFamily: "var(--font-body)" }}>Regular classes</p>
                      <div className="space-y-3">
                        {classes.map((siteClass) => (
                          <button
                            key={siteClass.id}
                            type="button"
                            onClick={() => handleBookClass(siteClass)}
                            className="w-full text-left border border-[#2A2825]/8 p-4 hover:border-[#C4785A]/40 transition-colors flex items-center justify-between gap-4"
                          >
                            <div>
                              <p className="text-[#2A2825]" style={{ fontFamily: "var(--font-display)" }}>{siteClass.classType || siteClass.title}</p>
                              <p className="text-[12px] text-[#7A7468]" style={{ fontFamily: "var(--font-body)" }}>{siteClass.day} · {siteClass.time}</p>
                            </div>
                            <span className="text-[11px] tracking-[0.12em] uppercase text-[#C4785A] inline-flex items-center gap-1" style={{ fontFamily: "var(--font-body)" }}>
                              Book <ChevronRight size={12} />
                            </span>
                          </button>
                        ))}
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
