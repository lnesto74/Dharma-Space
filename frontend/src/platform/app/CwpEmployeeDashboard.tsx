import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, Footprints, XCircle } from "lucide-react";
import { EventCard } from "../components/wellness/EventCard";
import { LeaderboardTable } from "../components/wellness/LeaderboardTable";
import { StatCard } from "../components/wellness/StatCard";
import { AttendanceBreakdown } from "../components/wellness/AttendanceBreakdown";
import { CwpStatisticsSection } from "../components/wellness/CwpStatisticsSection";
import { EmployeeJourneyHero } from "../components/wellness/EmployeeJourneyHero";
import { DepartmentRallyBoard } from "../components/wellness/DepartmentRallyBoard";
import { LocationBadge } from "../components/wellness/LocationBadge";
import { WellnessIcon } from "../components/wellness/wellness-icons";
import { CwpAppLayout } from "../components/CwpAppLayout";
import { CwpCard } from "../components/CwpCard";
import { CwpSectionTitle } from "../components/CwpSectionTitle";
import { CwpPlatformShell } from "../components/CwpPlatformShell";
import {
  bookWellnessEvent,
  cancelWellnessBooking,
  fetchDepartmentLeaderboard,
  fetchMyWellnessBookings,
  fetchWellnessCategories,
  fetchWellnessEvents,
  fetchWellnessLeaderboard,
  fetchWellnessStats
} from "../../lib/wellness-api";
import type { WellnessBooking, WellnessCategory, WellnessEvent } from "../../types/wellness";
import type { PlatformRole } from "../nav-config";

type Auth = {
  token: string | null;
  user: { id: string; name: string; role?: PlatformRole } | null;
};

export function CwpEmployeeDashboard({ auth }: { auth: Auth }) {
  const token = auth.token || "";
  const userId = auth.user?.id || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<Awaited<ReturnType<typeof fetchWellnessLeaderboard>>["entries"]>([]);
  const [events, setEvents] = useState<WellnessEvent[]>([]);
  const [bookings, setBookings] = useState<WellnessBooking[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchWellnessStats>> | null>(null);
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartmentLeaderboard>>["departments"]>([]);
  const [categories, setCategories] = useState<WellnessCategory[]>([]);

  const bookedEventIds = useMemo(
    () => new Set(bookings.filter((b) => !b.cancelled).map((b) => b.event.id)),
    [bookings]
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [lb, ev, bk, st, dept, cats] = await Promise.all([
        fetchWellnessLeaderboard(token),
        fetchWellnessEvents(token, { upcoming: true, categoryId: categoryFilter || undefined }),
        fetchMyWellnessBookings(token),
        fetchWellnessStats(token),
        fetchDepartmentLeaderboard(token),
        fetchWellnessCategories(token)
      ]);
      setLeaderboard(lb.entries);
      setEvents(ev.events);
      setBookings(bk.bookings);
      setStats(st);
      setDepartments(dept.departments);
      setCategories(cats.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [token, categoryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  };

  const handleJoin = async (eventId: string) => {
    setJoiningId(eventId);
    try {
      await bookWellnessEvent(token, eventId);
      showToast("Booking confirmed");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setJoiningId(null);
    }
  };

  const handleCancel = async (bookingId: string) => {
    try {
      await cancelWellnessBooking(token, bookingId);
      showToast("Booking cancelled");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Cancel failed");
    }
  };

  const role = auth.user?.role || "EMPLOYEE";
  const userLabel = auth.user?.name || "User";
  const firstName = auth.user?.name?.split(" ")[0] || "there";

  if (loading) {
    return (
      <CwpPlatformShell role={role} userLabel={userLabel}>
        <CwpAppLayout title="Dashboard" subtitle="Loading your wellness overview…">
          <div className="flex min-h-[40vh] items-center justify-center">
            <p className="text-stone">Loading your wellness dashboard…</p>
          </div>
        </CwpAppLayout>
      </CwpPlatformShell>
    );
  }

  if (error) {
    return (
      <CwpPlatformShell role={role} userLabel={userLabel}>
        <CwpAppLayout title="Dashboard" subtitle="We could not load your data.">
          <div className="flex min-h-[40vh] items-center justify-center">
            <p className="text-[var(--cwp-error)]">{error}</p>
          </div>
        </CwpAppLayout>
      </CwpPlatformShell>
    );
  }

  return (
    <CwpPlatformShell role={role} userLabel={userLabel}>
      {toast && <div className="cwp-toast">{toast}</div>}
      <CwpAppLayout
        title={`Hello, ${firstName}`}
        subtitle="Book sessions, track your score, and climb the leaderboard."
      >
        <div className="space-y-8">
          <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr] xl:items-start">
            {stats && <EmployeeJourneyHero stats={stats} />}
            <LeaderboardTable entries={leaderboard} currentUserId={userId} limit={8} />
          </div>

          <DepartmentRallyBoard departments={departments} userDepartmentRank={stats?.departmentRank} />

          <section>
            <CwpSectionTitle title="Upcoming events" />
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={`cwp-pill ${!categoryFilter ? "cwp-pill-online" : "cwp-pill-room"}`}
                onClick={() => setCategoryFilter("")}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`cwp-pill inline-flex items-center gap-1.5 ${categoryFilter === cat.id ? "cwp-pill-online" : "cwp-pill-room"}`}
                  onClick={() => setCategoryFilter(cat.id)}
                >
                  <WellnessIcon symbol={cat.icon} name={cat.name} size={14} />
                  {cat.name}
                </button>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  isBooked={bookedEventIds.has(event.id)}
                  joinLoading={joiningId === event.id}
                  onJoin={() => handleJoin(event.id)}
                />
              ))}
              {events.length === 0 && (
                <p className="text-sm text-stone">No upcoming events — check back soon.</p>
              )}
            </div>
          </section>

          <section>
            <CwpSectionTitle title="My bookings" />
            <div className="space-y-3">
              {bookings.filter((b) => !b.cancelled).map((booking) => {
                const past = new Date(booking.event.dateTime) < new Date();
                return (
                  <CwpCard key={booking.id} className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-navy">{booking.event.title}</p>
                      <p className="text-sm text-stone">
                        {new Date(booking.event.dateTime).toLocaleString()}
                        {booking.event.trainer ? ` · ${booking.event.trainer.name}` : ""}
                      </p>
                      <LocationBadge type={booking.event.locationType} detail={booking.event.locationDetail} />
                      {past && (
                        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-navy">
                          {booking.attended ? (
                            <>
                              <CheckCircle2 size={14} strokeWidth={1.75} className="text-[var(--cwp-success)]" />
                              Attended
                            </>
                          ) : (
                            <>
                              <XCircle size={14} strokeWidth={1.75} className="text-[var(--cwp-error)]" />
                              Missed
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    {!past && (
                      <button type="button" className="cwp-btn-primary" onClick={() => handleCancel(booking.id)}>
                        Cancel
                      </button>
                    )}
                  </CwpCard>
                );
              })}
            </div>
          </section>

          {stats && (
            <CwpStatisticsSection title="My statistics" eyebrow="Personal snapshot">
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <StatCard tone={0} icon={Award} label="Wellness score" value={`${stats.totalWellnessScore.toLocaleString()} pts`} />
                <StatCard tone={1} icon={Footprints} label="Total steps logged" value={stats.totalSteps} />
              </div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--cwp-stat-deep)]/80">
                Attendance by category
              </p>
              <AttendanceBreakdown categories={stats.attendanceByCategory} embedded />
            </CwpStatisticsSection>
          )}
        </div>
      </CwpAppLayout>
    </CwpPlatformShell>
  );
}
