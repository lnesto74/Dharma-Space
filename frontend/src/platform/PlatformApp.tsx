import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CwpEmployeeDashboard } from "./app/CwpEmployeeDashboard";
import { MedalRank } from "./components/wellness/MedalRank";
import { CwpAppLayout } from "./components/CwpAppLayout";
import { CwpPlatformShell } from "./components/CwpPlatformShell";
import { ProfileAvatar } from "./components/ProfileAvatar";
import { navForRole } from "./nav-config";
import { useSelectedCompany } from "./selected-company";
import {
  buddyChallengeTypes,
  buddyChallengeTypeMap,
  formatSeconds,
  pointsForTarget
} from "./challenge-types";
import { ChallengeProvider, useChallenges } from "./challenge-store";
import { DuelCard } from "./components/DuelCard";
import { EventCard } from "./components/wellness/EventCard";
import { LocationBadge } from "./components/wellness/LocationBadge";
import { WellnessIcon } from "./components/wellness/wellness-icons";
import {
  bookWellnessEvent,
  cancelWellnessBooking,
  fetchMyWellnessBookings,
  fetchWellnessCategories,
  fetchWellnessEvents
} from "../lib/wellness-api";
import type { WellnessBooking, WellnessCategory, WellnessEvent } from "../types/wellness";
import { getMarketingSiteUrl } from "../lib/education";
import { platformLogout } from "./platform-session";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Crown,
  Flame,
  Gauge,
  GraduationCap,
  HeartPulse,
  Home,
  Leaf,
  Lock,
  LogOut,
  Mail,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  User,
  Users,
  Wind,
  XCircle
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { BrandLogo } from "../components/BrandLogo";
import { GoogleSignIn, GoogleSignInDivider, corporateGoogleSignIn } from "../components/GoogleSignIn";
import { LOGO_URL } from "../brand";

const API_URL = import.meta.env.VITE_API_URL || "";

type Role = "EMPLOYEE" | "HR_ADMIN" | "TRAINER" | "CORPORATE_ADMIN" | "SUPER_ADMIN";
type UserType = { id: string; name: string; email: string; role: Role; homePath: string; avatar?: string };
type Course = {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  duration: string;
  format: string;
  price: number;
  certificationAvailable: boolean;
  image: string;
  rating: number;
  enrolledCount: number;
  tags: string[];
  learningOutcomes: string[];
  instructor?: { name: string };
  modules?: { id: string; title: string; description: string; duration: string }[];
};

const categories = [
  "All",
  "Yoga",
  "Breathwork",
  "Nutrition",
  "Mindfulness",
  "Sound Healing",
  "Emotional Intelligence",
  "Somatic Practices",
  "Coaching",
  "Mental Health First Aid",
  "Leadership Wellbeing",
  "Stress Recovery",
  "Sleep & Recovery"
];

const wellnessArchetypes = [
  {
    min: 10,
    max: 20,
    emoji: "🦥",
    title: "Zen Sloth",
    status: "You signed up for inner peace… and immediately needed a nap.",
    traits: ["Occasionally appears in yoga class", "Opens wellness emails for later", "Knows breathwork exists"],
    tone: "cwp-tone-sloth"
  },
  {
    min: 21,
    max: 40,
    emoji: "🐼",
    title: "Calm Panda",
    status: "Soft, friendly, and trying their best.",
    traits: ["Comes when stress becomes critical", "Has a favorite yoga teacher", "Pretends stretching solved all life problems"],
    tone: "cwp-tone-panda"
  },
  {
    min: 41,
    max: 60,
    emoji: "🦦",
    title: "Balanced Otter",
    status: "Your nervous system is officially loading stability.",
    traits: ["Regular class attendee", "Talks about magnesium and sleep quality", "Might recommend breathwork to coworkers"],
    tone: "cwp-tone-otter"
  },
  {
    min: 61,
    max: 75,
    emoji: "🐺",
    title: "Mindful Wolf",
    status: "Disciplined. Focused. Slightly intimidating in plank holds.",
    traits: ["Protects calendar time for wellness", "Understands mobility vs flexibility", "Drinks water voluntarily"],
    tone: "cwp-tone-wolf"
  },
  {
    min: 76,
    max: 90,
    emoji: "🦅",
    image: "/elevated-eagle-final.png",
    title: "Elevated Eagle",
    status: "Peak clarity. Peak posture. Peak calendar discipline.",
    traits: ["Never misses wellness week", "Has favorite meditation track", "Colleagues ask them for stress advice"],
    tone: "cwp-tone-eagle"
  },
  {
    min: 91,
    max: 100,
    emoji: "🐉",
    title: "Corporate Dragon",
    status: "Legendary wellness creature. Possibly enlightened.",
    traits: ["Attends everything", "Breathes through deadlines", "Survives Monday meetings without emotional damage"],
    tone: "cwp-tone-dragon"
  }
];

const departmentCompetitions = [
  { rank: 1, department: "Product", averageAttendance: "91%", totalAttended: 186, mostImproved: "+14%", streak: "22 days" },
  { rank: 2, department: "Operations", averageAttendance: "84%", totalAttended: 164, mostImproved: "+18%", streak: "17 days" },
  { rank: 3, department: "People", averageAttendance: "79%", totalAttended: 142, mostImproved: "+9%", streak: "15 days" },
  { rank: 4, department: "Sales", averageAttendance: "68%", totalAttended: 118, mostImproved: "+21%", streak: "9 days" }
];

const stitchIconMap: Record<string, string> = {
  Dashboard: "home_max",
  "Upcoming Events": "event",
  "My Bookings": "event_available",
  "My Booking": "event_available",
  "Booking History": "history",
  "My Statistics": "monitoring",
  Statistics: "monitoring",
  Courses: "auto_stories",
  Progress: "insights",
  Calendar: "calendar_month",
  "Check-In": "spa",
  Certificates: "workspace_premium",
  Community: "groups",
  Profile: "person",
  Employees: "groups",
  Departments: "apartment",
  Analytics: "monitoring",
  Reports: "lab_profile",
  Challenges: "emoji_events",
  Billing: "payments",
  Marketplace: "storefront",
  Builder: "edit_note",
  Sessions: "event",
  Participants: "groups",
  Certifications: "workspace_premium",
  Revenue: "payments",
  Users: "manage_accounts",
  Subscription: "crown",
  Invoices: "receipt_long",
  Settings: "settings",
  SSO: "lock",
  Companies: "apartment",
  Corporates: "apartment",
  Trainers: "school",
  Coaches: "school",
  Events: "event",
  "Create Event": "add_circle",
  "My Events": "event_note",
  Attendees: "groups",
  "CWP Plans": "tune",
  Inquiries: "mail",
  Overview: "dashboard",
  "Regular Class Schedule": "calendar_month",
  "Education & Events": "menu_book"
};

function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem("hsos_token") || "");
  const [user, setUser] = useState<UserType | null>(() => {
    const stored = localStorage.getItem("hsos_user");
    if (!stored) return null;
    try {
      const parsed = JSON.parse(stored) as UserType;
      if (parsed.role === "SUPER_ADMIN") {
        parsed.homePath = "/hr/dashboard";
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const login = (nextToken: string, nextUser: UserType) => {
    const userWithHome = nextUser.role === "SUPER_ADMIN"
      ? { ...nextUser, homePath: "/hr/dashboard" }
      : nextUser;
    localStorage.setItem("hsos_token", nextToken);
    localStorage.setItem("hsos_user", JSON.stringify(userWithHome));
    setToken(nextToken);
    setUser(userWithHome);
  };

  const logout = () => {
    localStorage.removeItem("hsos_token");
    localStorage.removeItem("hsos_user");
    setToken("");
    setUser(null);
  };

  const updateUser = (patch: Partial<UserType>) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      localStorage.setItem("hsos_user", JSON.stringify(next));
      return next;
    });
  };

  return { token, user, login, logout, updateUser };
}

async function api<T>(path: string, token?: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

function useApi<T>(path: string, token?: string, fallback?: T) {
  const [data, setData] = useState<T | undefined>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api<T>(path, token)
      .then((result) => active && setData(result))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [path, token, tick]);

  const reload = () => setTick((value) => value + 1);
  return { data, loading, error, setData, reload };
}

function Shell({ children, auth }: { children: ReactNode; auth: ReturnType<typeof useAuth> }) {
  const [open, setOpen] = useState(false);
  const nav = navForRole(auth.user?.role);
  const location = useLocation();
  const immersiveRoute = [
    /^\/courses$/,
    /^\/course\//,
    /^\/app\//,
    /^\/hr\//,
    /^\/trainer\//,
    /^\/company\//,
    /^\/admin\//
  ].some((pattern) => pattern.test(location.pathname));

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      {!immersiveRoute && <header className="sticky top-0 z-30 border-b border-white/60 bg-ivory/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link to="/">
            <BrandLogo
              iconClassName="h-11 w-11 object-contain"
              textClassName="text-[11px] font-medium uppercase tracking-[0.2em] text-navy"
            />
          </Link>
          <button className="rounded-full glass p-3 md:hidden" onClick={() => setOpen(!open)}>
            <Menu size={18} />
          </button>
          <nav className="hidden items-center gap-2 md:flex">
            {auth.user ? (
              <>
                <Link className="rounded-full px-4 py-2 text-sm font-medium text-navy hover:bg-white/70" to={auth.user.homePath}>Dashboard</Link>
                <Link className="rounded-full px-4 py-2 text-sm font-medium text-navy hover:bg-white/70" to="/courses">Marketplace</Link>
                <button className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white" onClick={platformLogout}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link className="rounded-full px-4 py-2 text-sm font-medium text-navy hover:bg-white/70" to="/courses">Courses</Link>
                <Link className="rounded-full px-4 py-2 text-sm font-medium text-navy hover:bg-white/70" to="/pricing">Pricing</Link>
                <Link className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white" to="/login">Login</Link>
              </>
            )}
          </nav>
        </div>
        {open && (
          <div className="grid gap-2 border-t border-white/60 px-5 py-4 md:hidden">
            {[...nav, { label: "Marketplace", to: "/courses", icon: BookOpen }].map((item) => (
              <Link key={item.to} to={item.to} className="rounded-3xl px-4 py-3 text-sm font-medium text-navy hover:bg-white/70" onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </header>}
      <main>{children}</main>
    </div>
  );
}

function StitchPage({ children, railLabel, role = "EMPLOYEE" }: { children: ReactNode; railLabel?: string; role?: Role }) {
  return (
    <CwpPlatformShell role={role} userLabel={railLabel}>
      {children}
    </CwpPlatformShell>
  );
}

function Protected({ auth, roles, children }: { auth: ReturnType<typeof useAuth>; roles?: Role[]; children: ReactNode }) {
  if (!auth.user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(auth.user.role)) return <Navigate to={auth.user.homePath || "/admin"} replace />;
  return <>{children}</>;
}

function AppLayout({ auth, children, title, subtitle }: { auth: ReturnType<typeof useAuth>; children: ReactNode; title: string; subtitle: string }) {
  return (
    <StitchPage railLabel={auth.user?.name || "Dharma Space"} role={auth.user?.role || "EMPLOYEE"}>
      <CwpAppLayout title={title} subtitle={subtitle}>{children}</CwpAppLayout>
    </StitchPage>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-5xl glass p-6 ${className}`}>{children}</div>;
}

const demoEvents = [
  { id: "evt-1", name: "Morning Coherence Breathwork", coach: "Talia Trainer", date: "May 20, 2026", time: "09:30", location: "Online", detail: "https://zoom.us/j/dharma-breath", capacity: 30, booked: 19, type: "Breath work" },
  { id: "evt-2", name: "Desk Yoga Reset", coach: "Amara Wells", date: "May 21, 2026", time: "12:00", location: "Dharma Space", detail: "Dharma Space Studio A", capacity: 24, booked: 13, type: "Yoga" },
  { id: "evt-3", name: "Leadership Wellness Talk", coach: "Jonas Reed", date: "May 22, 2026", time: "15:00", location: "Meeting Room", detail: "Asteria HQ, Room 8", capacity: 40, booked: 32, type: "Wellness talk" },
  { id: "evt-4", name: "Team Flow Building", coach: "Nina Patel", date: "May 24, 2026", time: "10:00", location: "Dharma Space", detail: "Dharma Space Garden Room", capacity: 30, booked: 22, type: "Team building" }
];

const demoBookings = [
  { id: "bk-1", name: "Morning Coherence Breathwork", date: "May 20, 2026", time: "09:30", coach: "Talia Trainer", location: "Zoom", detail: "https://zoom.us/j/dharma-breath" },
  { id: "bk-2", name: "Desk Yoga Reset", date: "May 21, 2026", time: "12:00", coach: "Amara Wells", location: "Dharma Space", detail: "Studio A, 22 Baker Street" },
  { id: "bk-3", name: "Leadership Wellness Talk", date: "May 22, 2026", time: "15:00", coach: "Jonas Reed", location: "Meeting Room", detail: "Asteria HQ, Room 8" }
];

const winnersBoard = [
  { name: "Ava Morgan", department: "Product", points: 3120, attended: 18 },
  { name: "Maya Employee", department: "Product", points: 2500, attended: 15 },
  { name: "Theo Malik", department: "Sales", points: 2240, attended: 13 },
  { name: "Priya Shah", department: "Leadership", points: 2110, attended: 12 },
  { name: "Noah Park", department: "Engineering", points: 2050, attended: 12 },
  { name: "Lina Ross", department: "Operations", points: 1980, attended: 11 },
  { name: "Iris Stone", department: "People", points: 1940, attended: 11 },
  { name: "Owen Shaw", department: "Sales", points: 1880, attended: 10 },
  { name: "Elena Cruz", department: "Product", points: 1810, attended: 10 },
  { name: "Kai Bennett", department: "Operations", points: 1760, attended: 9 },
  { name: "Mina Hart", department: "Leadership", points: 1700, attended: 9 },
  { name: "Rowan Lee", department: "Product", points: 1660, attended: 8 },
  { name: "Sofia King", department: "Finance", points: 1620, attended: 8 },
  { name: "Eli Brooks", department: "Engineering", points: 1580, attended: 8 },
  { name: "Nora Lane", department: "People", points: 1510, attended: 7 },
  { name: "Adam Wells", department: "Sales", points: 1460, attended: 7 },
  { name: "Jules Carter", department: "Operations", points: 1400, attended: 7 },
  { name: "Rae Collins", department: "Product", points: 1360, attended: 6 },
  { name: "Samira Noor", department: "Leadership", points: 1310, attended: 6 },
  { name: "Felix Grant", department: "Engineering", points: 1260, attended: 6 },
  { name: "Tessa Bloom", department: "People", points: 1210, attended: 5 },
  { name: "Marco Reyes", department: "Sales", points: 1160, attended: 5 },
  { name: "Anika Sen", department: "Finance", points: 1090, attended: 5 },
  { name: "Milo Hart", department: "Operations", points: 1040, attended: 4 }
];

const employeeStats = [
  { label: "Score", value: "2500 points" },
  { label: "Total steps", value: "50,000" },
  { label: "Wellness talks attended", value: 6 },
  { label: "Yoga classes", value: 9 },
  { label: "Meditation", value: 5 },
  { label: "Breath work", value: 4 },
  { label: "Team building activities", value: 2 }
];

// Demo "journey over time" data so employees can see their improvement.
const journeyAttendance = [
  { month: "Jan", attendance: 38 },
  { month: "Feb", attendance: 47 },
  { month: "Mar", attendance: 58 },
  { month: "Apr", attendance: 66 },
  { month: "May", attendance: 78 },
  { month: "Jun", attendance: 86 }
];

const journeyPoints = [
  { month: "Jan", points: 320 },
  { month: "Feb", points: 540 },
  { month: "Mar", points: 910 },
  { month: "Apr", points: 1480 },
  { month: "May", points: 2010 },
  { month: "Jun", points: 2500 }
];

const journeyActivityMix = [
  { name: "Yoga", value: 9 },
  { name: "Wellness talks", value: 6 },
  { name: "Meditation", value: 5 },
  { name: "Breath work", value: 4 },
  { name: "Team building", value: 2 }
];

const JOURNEY_MIX_COLORS = [
  "var(--cwp-olive)",
  "var(--cwp-terracotta)",
  "var(--cwp-seafoam)",
  "var(--cwp-yellow)",
  "var(--cwp-periwinkle)"
];

const attendanceHistory = [
  { event: "Morning Coherence Breathwork", coach: "Talia Trainer", date: "May 10, 09:30", attended: "Maya, Ava, Theo, Priya" },
  { event: "Desk Yoga Reset", coach: "Amara Wells", date: "May 11, 12:00", attended: "Maya, Noah, Lina, Iris" },
  { event: "Leadership Wellness Talk", coach: "Jonas Reed", date: "May 12, 15:00", attended: "Harper, Priya, Rowan" }
];

// Classes owned by the signed-in trainer (demo). "booked" = signed up, "attended" = actually showed up.
const trainerClasses = [
  { id: "tc-1", name: "Morning Coherence Breathwork", date: "May 20, 2026", time: "09:30", location: "Online", capacity: 30, booked: 24, attended: 21, attendees: ["Maya Employee", "Ava Morgan", "Theo Malik", "Priya Shah", "Noah Park", "Lina Ross"] },
  { id: "tc-2", name: "Breathwork for High-Performance Teams", date: "May 23, 2026", time: "14:00", location: "Dharma Space", capacity: 24, booked: 20, attended: 18, attendees: ["Iris Stone", "Owen Shaw", "Elena Cruz", "Kai Bennett", "Maya Employee"] },
  { id: "tc-3", name: "Evening Wind-Down Breath Lab", date: "May 26, 2026", time: "18:00", location: "Online", capacity: 28, booked: 17, attended: 14, attendees: ["Mina Hart", "Rowan Lee", "Sofia King", "Ava Morgan"] },
  { id: "tc-4", name: "Stress Reset Micro-Session", date: "May 28, 2026", time: "12:30", location: "Meeting Room", capacity: 20, booked: 16, attended: 15, attendees: ["Eli Brooks", "Nora Lane", "Adam Wells", "Theo Malik", "Maya Employee"] }
];

function MSIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: any; label: string; value: ReactNode; detail: string }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-stone">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-navy">{value}</p>
          <p className="mt-2 text-sm text-stone">{detail}</p>
        </div>
        <div className="rounded-full bg-sage/20 p-3 text-navy"><Icon size={20} /></div>
      </div>
    </Card>
  );
}

function WinnersBoard({ clickable = false }: { clickable?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const visibleWinners = expanded ? winnersBoard : winnersBoard.slice(0, 4);
  const medals = [1, 2, 3];
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-4">
        <ChartTitle title="Winners board" />
        <button onClick={() => setExpanded((value) => !value)} className="rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-navy hover:bg-white">
          {expanded ? "View less" : "View more"}
        </button>
      </div>
      <div className="grid gap-3">
        {visibleWinners.map((winner, index) => (
          <div key={winner.name} className="flex items-center justify-between rounded-4xl bg-white/70 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center">
                {index < 3 ? (
                  <MedalRank rank={medals[index]} size="sm" />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--cwp-olive)] text-sm font-bold text-white">
                    {index + 1}
                  </span>
                )}
              </div>
              <div>
                <p className="font-semibold text-navy">{winner.name}</p>
                <p className="text-sm text-stone">{winner.department} · {winner.attended} events</p>
              </div>
            </div>
            <button className={`rounded-full px-4 py-2 text-sm font-semibold ${clickable ? "bg-navy text-white" : "bg-sage/20 text-navy"}`}>{winner.points} pts</button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function EventList({ admin = false, joinedIds = [], onToggleJoin }: { admin?: boolean; joinedIds?: string[]; onToggleJoin?: (event: typeof demoEvents[number]) => void }) {
  return (
    <Card>
      <ChartTitle title="Upcoming events" />
      <div className="grid gap-3">
        {demoEvents.map((event) => {
          const joined = joinedIds.includes(event.id);
          const spotsLeft = event.capacity - event.booked - (joined ? 1 : 0);
          return (
          <div key={event.id} className={`rounded-4xl p-4 transition-colors ${joined ? "bg-[color-mix(in_srgb,var(--cwp-mint)_50%,white)] ring-1 ring-[var(--cwp-seafoam)]/40" : "bg-white/70"}`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-navy">{event.name} {joined && <span className="ml-2 rounded-full bg-[var(--cwp-olive)] px-3 py-1 text-xs text-white">Booked</span>}</p>
                <p className="mt-1 text-sm text-stone">{event.coach} · {event.date} · {event.time}</p>
                <p className="mt-1 text-sm text-stone">{event.location}: {event.detail}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-navy">{spotsLeft}/{event.capacity} spots left</p>
                <button onClick={() => onToggleJoin?.(event)} className={`mt-2 rounded-full px-5 py-2 text-sm font-semibold ${joined ? "bg-white text-navy" : "bg-navy text-white"}`}>{admin ? "View signups" : joined ? "Cancel booking" : "Join"}</button>
              </div>
            </div>
          </div>
        );})}
      </div>
    </Card>
  );
}

function BookingList({ title = "My bookings", extraBookings = [], onCancel }: { title?: string; extraBookings?: typeof demoBookings; onCancel?: (bookingId: string) => void }) {
  const bookings = [...extraBookings, ...demoBookings];
  return (
    <Card>
      <ChartTitle title={title} />
      <div className="grid gap-3">
        {bookings.map((booking) => (
          <div key={booking.id} className="rounded-4xl bg-white/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-navy">{booking.name}</p>
                <p className="mt-1 text-sm text-stone">{booking.date} · {booking.time} · Coach: {booking.coach}</p>
                <p className="mt-1 text-sm text-stone">{booking.location}: {booking.detail}</p>
              </div>
              {onCancel && booking.id.startsWith("joined-") && (
                <button onClick={() => onCancel(booking.id.replace("joined-", ""))} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy shadow-sm hover:bg-sand/60">
                  Cancel booking
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function EmotionalActivityCard({ score }: { score: number }) {
  const [selectedMood, setSelectedMood] = useState("Focused");
  const calm = Math.max(18, Math.min(100, score - 18));
  const focus = Math.max(18, Math.min(100, score));
  const energy = Math.max(18, Math.min(100, score - 32));
  const moods = [
    { label: "Calm", icon: "self_improvement", tint: "bg-[#d6e8d0]", text: "text-[#536350]" },
    { label: "Focused", icon: "center_focus_strong", tint: "bg-[#d2e4fb]", text: "text-[#041627]" },
    { label: "Energized", icon: "bolt", tint: "bg-[#ffdea5]", text: "text-[#5d4201]" },
    { label: "Tired", icon: "bedtime", tint: "bg-[#efeded]", text: "text-[#44474c]" }
  ];
  const week = [
    { day: "M", value: 58 },
    { day: "T", value: 74 },
    { day: "W", value: 68 },
    { day: "T", value: 84 },
    { day: "F", value: score },
    { day: "S", value: 62 },
    { day: "S", value: 76 }
  ];
  return (
    <div className="glass-panel col-span-1 overflow-hidden rounded-[2rem] p-0 md:col-span-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#fffaf2] via-[#f7f8f4] to-[#edf5ea] p-8">
        <div className="absolute right-[-80px] top-[-80px] h-56 w-56 rounded-full bg-[#d6e8d0]/70 blur-3xl" />
        <div className="absolute bottom-[-90px] left-[-80px] h-56 w-56 rounded-full bg-[#d2e4fb]/70 blur-3xl" />
        <div className="relative">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#44474c]/60">Today check-in</p>
              <h3 className="mt-2 text-[30px] font-light tracking-[-0.02em] text-[#041627]">How are you feeling?</h3>
            </div>
            <span className="rounded-full bg-[#d6e8d0] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#596956]">Live tracking</span>
          </div>
          <div className="grid gap-8 xl:grid-cols-[1fr_260px] xl:items-center">
            <div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {moods.map((mood) => (
                  <button
                    key={mood.label}
                    onClick={() => setSelectedMood(mood.label)}
                    className={`rounded-[1.5rem] p-4 text-left transition-all ${selectedMood === mood.label ? "bg-white shadow-[0_20px_50px_rgba(4,22,39,0.10)] ring-1 ring-[#041627]/10" : "bg-white/45 hover:bg-white/70"}`}
                  >
                    <div className={`mb-4 grid h-12 w-12 place-items-center rounded-full ${mood.tint}`}>
                      <MSIcon name={mood.icon} className={mood.text} />
                    </div>
                    <p className="font-semibold text-[#041627]">{mood.label}</p>
                    <p className="mt-1 text-xs text-[#44474c]/70">{selectedMood === mood.label ? "Selected" : "Tap to update"}</p>
                  </button>
                ))}
              </div>
              <div className="mt-6 rounded-[1.5rem] bg-white/60 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-semibold text-[#041627]">Weekly mood rhythm</p>
                  <p className="text-sm font-semibold text-[#536350]">{score}% stable</p>
                </div>
                <div className="flex h-28 items-end gap-3">
                  {week.map((day) => (
                    <div key={`${day.day}-${day.value}`} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-24 w-full items-end rounded-full bg-[#e3e2e2]">
                        <div className="w-full rounded-full bg-[#041627]" style={{ height: `${Math.max(24, day.value)}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-[#44474c]/60">{day.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="relative mx-auto grid h-56 w-56 place-items-center rounded-[2rem] bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,.8),0_24px_70px_rgba(4,22,39,.08)]">
              <div className="ring-progress absolute inset-6 rounded-full" style={{ "--ring-value": focus, "--ring-color": "#041627" } as any} />
              <div className="ring-progress absolute inset-12 rounded-full" style={{ "--ring-value": calm, "--ring-color": "#536350" } as any} />
              <div className="ring-progress absolute inset-[72px] rounded-full" style={{ "--ring-value": energy, "--ring-color": "#d4af37" } as any} />
              <div className="absolute inset-24 grid place-items-center rounded-full bg-[#faf9f9]">
                <div className="text-center">
                  <p className="text-3xl font-light text-[#041627]">{score}</p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#44474c]">{selectedMood}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="relative mt-6 grid gap-3 md:grid-cols-3">
            {[
              { label: "Calm", value: calm, color: "bg-[#536350]" },
              { label: "Focus", value: focus, color: "bg-[#041627]" },
              { label: "Energy", value: energy, color: "bg-[#d4af37]" }
            ].map((item) => (
              <div key={item.label} className="rounded-[1.25rem] bg-white/60 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold text-navy">{item.label}</p>
                  <p className="text-sm font-semibold text-stone">{item.value}%</p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#e3e2e2]">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="relative mt-4 rounded-[1.5rem] bg-[#d6e8d0]/55 p-4 text-sm leading-6 text-[#041627]">Your best focus window is 10:00-13:00. Keep today's breathwork booking to protect recovery and performance.</p>
        </div>
      </div>
    </div>
  );
}

function ReflectionCameraCard() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  const weeklyMood = [
    { day: "M", value: 62, x: 80, y: 60 },
    { day: "T", value: 70, x: 107, y: 160 },
    { day: "W", value: 76, x: 180, y: 233 },
    { day: "T", value: 84, x: 280, y: 260 },
    { day: "F", value: 88, x: 380, y: 233 },
    { day: "S", value: 72, x: 453, y: 160 },
    { day: "S", value: 78, x: 480, y: 60 }
  ];

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function startCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1920 },
          height: { ideal: 2560 }
        },
        audio: false
      });
      streamRef.current = stream;
      setActive(true);
      window.setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 0);
    } catch {
      setError("Camera permission was blocked or is unavailable on this device.");
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = 900;
    canvas.height = 1200;
    const context = canvas.getContext("2d");
    if (!context) return;
    const sourceWidth = video.videoWidth || 720;
    const sourceHeight = video.videoHeight || 960;
    const targetRatio = canvas.width / canvas.height;
    const sourceRatio = sourceWidth / sourceHeight;
    const baseCropWidth = sourceRatio > targetRatio ? sourceHeight * targetRatio : sourceWidth;
    const baseCropHeight = sourceRatio > targetRatio ? sourceHeight : sourceWidth / targetRatio;
    const zoom = 1.18;
    const cropWidth = baseCropWidth / zoom;
    const cropHeight = baseCropHeight / zoom;
    const cropX = Math.max(0, (sourceWidth - cropWidth) / 2);
    const cropY = Math.max(0, (sourceHeight - cropHeight) * 0.32);
    context.filter = "brightness(1.08) contrast(1.08) saturate(1.14) sepia(0.08)";
    context.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
    context.filter = "none";
    context.globalCompositeOperation = "soft-light";
    context.fillStyle = "rgba(255, 139, 0, 0.10)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = "source-over";
    setPhoto(canvas.toDataURL("image/png"));
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
  }

  return (
    <div className="glass-panel overflow-hidden rounded-[2.5rem] p-0">
      <div className="relative min-h-[780px] overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#6f5b58] via-[#d68842] to-[#ff8b00] p-7 text-white">
        {photo && !active && <img src={photo} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-2xl" />}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,.42),transparent_38%),radial-gradient(circle_at_20%_85%,rgba(103,78,131,.30),transparent_34%),linear-gradient(135deg,rgba(40,32,52,.35),transparent_45%)]" />
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[3px]" />
        <div className="relative z-10 flex items-center justify-between">
          <button className="grid h-14 w-14 place-items-center rounded-full bg-white/18 backdrop-blur"><MSIcon name="chevron_left" className="text-3xl" /></button>
          <button className="grid h-16 w-16 place-items-center rounded-full bg-white/22 backdrop-blur"><MSIcon name="open_in_full" className="text-3xl" /></button>
        </div>
        <div className="relative z-10 mx-auto mt-7 grid max-w-3xl place-items-center">
          <div className="relative h-[420px] w-[340px] max-w-[82vw] overflow-hidden rounded-t-[999px] rounded-b-[48px] bg-white/20 shadow-[0_50px_110px_rgba(4,22,39,.28)] md:h-[500px] md:w-[400px]">
            {active ? (
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            ) : photo ? (
              <img src={photo} alt="Reflection capture" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-white/15 text-center">
                <div>
                  <MSIcon name="photo_camera" className="text-6xl" />
                  <p className="mt-3 text-base">Take a reflection photo</p>
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#ff8b00]/55 via-transparent to-white/15 mix-blend-screen" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#ff8b00]/25" />
          </div>
          <div className="relative mt-7 h-[220px] w-[430px] max-w-[86vw]">
            <svg className="h-full w-full overflow-visible" viewBox="0 0 560 310" aria-label="Weekly mood rhythm tracker">
              <path d="M80 60 A200 200 0 0 0 480 60" fill="none" stroke="rgba(255,255,255,.26)" strokeLinecap="round" strokeWidth="9" />
              <path d="M80 60 A200 200 0 0 0 480 60" fill="none" stroke="rgba(255,255,255,.9)" strokeDasharray="628" strokeDashoffset="108" strokeLinecap="round" strokeWidth="9" />
              {weeklyMood.map((point, index) => (
                <g key={`${point.day}-${index}`}>
                  <circle cx={point.x} cy={point.y} fill={index === 4 ? "#fff" : "rgba(255,255,255,.62)"} r={index === 4 ? 13 : 8} />
                  <circle cx={point.x} cy={point.y} fill="transparent" r={index === 4 ? 21 : 15} stroke="rgba(255,255,255,.22)" strokeWidth="3" />
                  <text x={point.x} y={point.y + (point.y > 210 ? 36 : -18)} textAnchor="middle" fill="rgba(255,255,255,.82)" fontSize="14" fontWeight="800">{point.day}</text>
                </g>
              ))}
            </svg>
            <div className="absolute left-1/2 top-[136px] -translate-x-1/2 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Weekly mood</p>
              <p className="text-3xl font-semibold text-white">88%</p>
            </div>
          </div>
          <h3 className="mt-[-10px] max-w-xl text-center text-3xl font-semibold leading-tight drop-shadow md:text-4xl">Deeper understanding of yourself</h3>
          <p className="mt-4 max-w-lg text-center text-base leading-7 text-white/78">Capture a calm check-in moment with a warm Dharma Space effect.</p>
          <canvas ref={canvasRef} className="hidden" />
          <div className="mt-8 flex items-center gap-6">
            <button className="grid h-14 w-14 place-items-center rounded-full bg-white/18 backdrop-blur"><MSIcon name="replay_10" className="text-3xl" /></button>
            {!active ? (
              <button onClick={startCamera} className="grid h-24 w-24 place-items-center rounded-full bg-white text-[#b56a30] shadow-2xl">
                <MSIcon name={photo ? "photo_camera" : "camera"} className="text-5xl" />
              </button>
            ) : (
              <button onClick={capturePhoto} className="grid h-24 w-24 place-items-center rounded-full bg-white text-[#b56a30] shadow-2xl">
                <MSIcon name="radio_button_checked" className="text-5xl" />
              </button>
            )}
            <button className="grid h-14 w-14 place-items-center rounded-full bg-white/18 backdrop-blur"><MSIcon name="forward_10" className="text-3xl" /></button>
          </div>
          {photo && !active && <button onClick={() => setPhoto("")} className="mt-5 rounded-full bg-white/20 px-5 py-2 text-sm font-semibold backdrop-blur">Retake photo</button>}
          {error && <p className="mt-4 rounded-full bg-white/20 px-4 py-2 text-center text-sm backdrop-blur">{error}</p>}
        </div>
      </div>
    </div>
  );
}

const BASE_EMPLOYEE_SCORE = 2500;

function StatsGrid({ corporate = false }: { corporate?: boolean }) {
  const { points: challengePoints } = useChallenges();
  // Buddy Challenge winnings roll into the personal Score stat.
  const personalStats = employeeStats.map((item) =>
    item.label === "Score"
      ? { label: "Score", value: `${(BASE_EMPLOYEE_SCORE + challengePoints).toLocaleString()} points` }
      : item
  );
  const data = corporate
    ? [
      { label: "Wellness improvement", value: "+18%" },
      { label: "Estimated ROI", value: "$1.8M" },
      { label: "Attendance rate", value: "86%" },
      { label: "Active employees", value: "214" },
      ...employeeStats.slice(2)
    ]
    : personalStats;
  return (
    <section className="cwp-stats-section">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--cwp-stat-deep)]/70">
            {corporate ? "Company overview" : "Personal snapshot"}
          </p>
          <h2 className="mb-0 text-2xl font-light text-[var(--cwp-stat-deep)]">
            {corporate ? "Statistics & ROI" : "My statistics"}
          </h2>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-full bg-[var(--cwp-stat-cream)] text-[var(--cwp-stat-deep)]">
          <BarChart3 size={20} strokeWidth={1.75} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.map((item, index) => (
          <div key={item.label} className={`cwp-stat-metric cwp-stat-metric--${index % 12}`}>
            <p className="text-[11px] font-semibold uppercase leading-5 tracking-[0.14em] text-[var(--cwp-stat-deep)]/75">{item.label}</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-[var(--cwp-stat-deep)]">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BuddyInitials({ name, color = "var(--cwp-olive)" }: { name: string; color?: string }) {
  const initials = name === "You"
    ? "Me"
    : name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: color }}>
      {initials}
    </span>
  );
}

function BuddyChallenge() {
  const { duels, points, createDuel, colleagues } = useChallenges();
  const [buddy, setBuddy] = useState("");
  const [typeId, setTypeId] = useState("squats");
  const [target, setTarget] = useState(20);
  const [witnesses, setWitnesses] = useState<string[]>([]);
  const [showAllBuddies, setShowAllBuddies] = useState(false);
  const [toast, setToast] = useState("");

  const BUDDY_PREVIEW = 6;
  const visibleBuddies = showAllBuddies ? colleagues : colleagues.slice(0, BUDDY_PREVIEW);

  const activeType = buddyChallengeTypeMap[typeId];
  const canSubmit = Boolean(buddy) && target > 0 && witnesses.length === 3;
  const nameOf = (id: string) => colleagues.find((c) => c.id === id)?.name || "";

  const pickType = (id: string) => {
    setTypeId(id);
    setTarget(buddyChallengeTypeMap[id].defaultTarget);
  };

  const toggleWitness = (id: string) => {
    setWitnesses((prev) => {
      if (prev.includes(id)) return prev.filter((w) => w !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const sendChallenge = () => {
    if (!canSubmit) return;
    const opponentName = nameOf(buddy);
    void createDuel({ opponentId: buddy, typeId, target, witnessIds: witnesses });
    setToast(`Challenge sent to ${opponentName}! Awaiting their reply and 3 witnesses.`);
    setBuddy("");
    setWitnesses([]);
    pickType("squats");
    window.setTimeout(() => setToast(""), 3200);
  };

  const availableWitnesses = colleagues.filter((c) => c.id !== buddy);
  const stepSize = activeType.unit === "seconds" ? 5 : 1;

  return (
    <div className="grid gap-5">
      {toast && (
        <div className="rounded-4xl bg-[color-mix(in_srgb,var(--cwp-seafoam)_30%,white)] px-5 py-3 text-sm font-medium text-navy shadow-sm">
          {toast}
        </div>
      )}

      {/* Concept + points banner */}
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--cwp-olive)] text-white">
            <Swords size={22} />
          </span>
          <div>
            <h2 className="text-2xl font-light text-navy">Challenge a Buddy</h2>
            <p className="text-sm text-stone">Quick physical breaks, verified by 3 witnesses. Move together, earn together.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--cwp-yellow)_38%,white)] px-5 py-3">
          <Flame size={18} className="text-[var(--cwp-terracotta)]" />
          <span className="text-2xl font-bold text-navy">{points.toLocaleString()}</span>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-stone">points earned</span>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        {/* Create challenge */}
        <Card>
          <ChartTitle title="New challenge" />

          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone">1 · Choose your buddy</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visibleBuddies.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setBuddy(c.id); setWitnesses((w) => w.filter((id) => id !== c.id)); }}
                className={`flex items-center gap-2 rounded-4xl border px-3 py-2 text-left text-sm transition-colors ${
                  buddy === c.id ? "border-[var(--cwp-olive)] bg-[color-mix(in_srgb,var(--cwp-olive)_16%,white)]" : "border-transparent bg-white/70 hover:bg-white"
                }`}
              >
                <BuddyInitials name={c.name} color="var(--cwp-slate)" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-navy">{c.name.split(" ")[0]}</span>
                  <span className="block truncate text-xs text-stone">{c.department}</span>
                </span>
              </button>
            ))}
          </div>
          {colleagues.length === 0 && (
            <p className="mb-5 mt-1 text-sm text-stone">No colleagues found in your company yet.</p>
          )}
          {colleagues.length > BUDDY_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAllBuddies((v) => !v)}
              className="mb-5 mt-2 rounded-full bg-white/70 px-4 py-1.5 text-xs font-semibold text-navy hover:bg-white"
            >
              {showAllBuddies ? "Show less" : `More (${colleagues.length - BUDDY_PREVIEW})`}
            </button>
          )}
          {colleagues.length > 0 && colleagues.length <= BUDDY_PREVIEW && <div className="mb-5" />}

          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone">2 · Pick the exercise</p>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {buddyChallengeTypes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pickType(t.id)}
                className={`flex flex-col items-center gap-1 rounded-4xl border px-2 py-3 transition-colors ${
                  typeId === t.id ? "border-[var(--cwp-olive)] bg-[color-mix(in_srgb,var(--cwp-olive)_16%,white)]" : "border-transparent bg-white/70 hover:bg-white"
                }`}
              >
                <img src={t.icon} alt="" className="h-12 w-12 object-contain" />
                <span className="text-sm font-medium text-navy">{t.label}</span>
                <span className="text-[11px] font-semibold text-[var(--cwp-olive)]">+{t.points} pts</span>
              </button>
            ))}
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone">
            3 · Target {activeType.unit === "seconds" ? "(time)" : "(reps)"}
          </p>
          <div className="mb-5 flex items-center gap-3">
            <button type="button" onClick={() => setTarget((n) => Math.max(stepSize, n - stepSize))} className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-xl font-semibold text-navy hover:bg-white">−</button>
            <div className="flex min-w-[8rem] items-baseline justify-center gap-2 rounded-4xl bg-white/70 px-5 py-2">
              {activeType.unit === "seconds" ? (
                <span className="text-2xl font-bold text-navy">{formatSeconds(target)}</span>
              ) : (
                <>
                  <span className="text-3xl font-bold text-navy">{target}</span>
                  <span className="text-sm text-stone">reps</span>
                </>
              )}
            </div>
            <button type="button" onClick={() => setTarget((n) => n + stepSize)} className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-xl font-semibold text-navy hover:bg-white">+</button>
          </div>
          <p className="-mt-3 mb-5 text-xs text-stone">
            Worth <span className="font-semibold text-[var(--cwp-olive)]">+{pointsForTarget(typeId, target)} pts</span>
            {" "}— or <span className="font-semibold text-[var(--cwp-olive)]">+{pointsForTarget(typeId, target) * 2} pts</span> each if you both finish. Push harder to earn more.
          </p>

          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone">
            4 · Choose 3 witnesses <span className="text-[var(--cwp-olive)]">({witnesses.length}/3)</span>
          </p>
          <div className="mb-5 flex flex-wrap gap-2">
            {availableWitnesses.map((c) => {
              const selected = witnesses.includes(c.id);
              const disabled = !selected && witnesses.length >= 3;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleWitness(c.id)}
                  disabled={disabled}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                    selected
                      ? "bg-[var(--cwp-olive)] text-white"
                      : disabled
                        ? "cursor-not-allowed bg-white/50 text-stone/50"
                        : "bg-white/70 text-navy hover:bg-white"
                  }`}
                >
                  {c.name.split(" ")[0]}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={sendChallenge}
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--cwp-olive)] px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white transition-opacity disabled:opacity-40"
          >
            <Plus size={16} /> Send challenge
          </button>
        </Card>

        {/* Active challenges */}
        <Card>
          <ChartTitle title="Active & completed" />
          <div className="grid gap-3">
            {duels.length === 0 && <p className="text-sm text-stone">No challenges yet — send your first one!</p>}
            {duels.map((duel) => (
              <DuelCard key={duel.id} duel={duel} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function JourneyProgress() {
  const pointsGain = journeyPoints[journeyPoints.length - 1].points - journeyPoints[0].points;
  const attendanceGain = journeyAttendance[journeyAttendance.length - 1].attendance - journeyAttendance[0].attendance;
  return (
    <section className="mt-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone">Progress over time</p>
          <h2 className="mt-1 text-2xl font-light text-navy">My journey progress</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[color-mix(in_srgb,var(--cwp-seafoam)_30%,white)] px-4 py-2 text-sm font-semibold text-navy">
            +{attendanceGain}% attendance
          </span>
          <span className="rounded-full bg-[color-mix(in_srgb,var(--cwp-yellow)_38%,white)] px-4 py-2 text-sm font-semibold text-navy">
            +{pointsGain.toLocaleString()} points
          </span>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <ChartTitle title="Attendance growth" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={journeyAttendance} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="journeyAttendanceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--cwp-seafoam)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--cwp-seafoam)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cwp-border)" />
                <XAxis dataKey="month" tick={{ fill: "var(--cwp-charcoal)", fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--cwp-charcoal)", fontSize: 12 }} unit="%" />
                <Tooltip formatter={(value: number) => [`${value}%`, "Attendance"]} />
                <Area dataKey="attendance" stroke="var(--cwp-olive)" strokeWidth={2.5} fill="url(#journeyAttendanceFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <ChartTitle title="Wellness points earned" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={journeyPoints} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cwp-border)" />
                <XAxis dataKey="month" tick={{ fill: "var(--cwp-charcoal)", fontSize: 12 }} />
                <YAxis tick={{ fill: "var(--cwp-charcoal)", fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [value.toLocaleString(), "Points"]} />
                <Bar dataKey="points" fill="var(--cwp-olive)" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <Card className="mt-5">
        <ChartTitle title="Activity mix" />
        <div className="grid items-center gap-4 md:grid-cols-[1fr_1fr]">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={journeyActivityMix} dataKey="value" nameKey="name" innerRadius={64} outerRadius={108} paddingAngle={2}>
                  {journeyActivityMix.map((_entry, index) => (
                    <Cell key={index} fill={JOURNEY_MIX_COLORS[index % JOURNEY_MIX_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name) => [`${value} sessions`, name as string]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid gap-2">
            {journeyActivityMix.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between rounded-4xl bg-white/70 px-4 py-3">
                <span className="flex items-center gap-3 text-sm font-medium text-navy">
                  <span className="h-3 w-3 rounded-full" style={{ background: JOURNEY_MIX_COLORS[index % JOURNEY_MIX_COLORS.length] }} />
                  {item.name}
                </span>
                <span className="text-sm font-semibold text-navy">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </section>
  );
}

function AttendanceHistory() {
  return (
    <Card>
      <ChartTitle title="Attendance history" />
      <div className="grid gap-3">
        {attendanceHistory.map((row) => (
          <div key={row.event} className="rounded-4xl bg-white/70 p-4">
            <p className="font-semibold text-navy">{row.event}</p>
            <p className="mt-1 text-sm text-stone">Coach: {row.coach} · {row.date}</p>
            <p className="mt-1 text-sm text-stone">Attended: {row.attended}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function WellnessArchetypeCard({ attendance = 82 }: { attendance?: number }) {
  const archetype = wellnessArchetypes.find((level) => attendance >= level.min && attendance <= level.max) || wellnessArchetypes[0];
  return (
    <div className={`cwp-archetype-card overflow-hidden rounded-[2rem] p-5 ${archetype.tone}`}>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-start">
        <div className="flex min-h-[180px] items-start justify-start rounded-[1.75rem] bg-white/70 p-4 shadow-inner">
          {"image" in archetype ? (
            <img src={archetype.image} alt={archetype.title} className="h-44 w-44 origin-top-left object-contain object-left-top" />
          ) : (
            <div className="text-6xl">{archetype.emoji}</div>
          )}
        </div>
        <div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone">Corporate Wellness Journey</p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-5xl font-light tracking-[-0.05em] text-navy">{archetype.title}</h2>
              <div className="rounded-full bg-white/75 px-5 py-3 shadow-sm">
                <span className="text-2xl font-semibold text-navy">{attendance}%</span>
                <span className="ml-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone">attendance</span>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-lg leading-7 text-stone">{archetype.status}</p>
          </div>
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-[0.18em] text-stone">
              <span>0%</span>
              <span>Journey progress</span>
              <span>100%</span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-white/55">
              <div className="h-full rounded-full bg-[var(--cwp-olive)]" style={{ width: `${attendance}%` }} />
            </div>
          </div>
          <div className="mt-5 rounded-[1.5rem] bg-white/55 p-5">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-stone">Traits</p>
            <div className="flex flex-wrap gap-2">
              {archetype.traits.map((trait) => (
                <p key={trait} className="rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-navy">{trait}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DepartmentCompetitionCard() {
  return (
    <Card>
      <ChartTitle title="Team competitions" />
      <div className="grid gap-3">
        {departmentCompetitions.map((row) => (
          <div key={row.department} className="rounded-4xl bg-white/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-navy text-sm font-bold text-white">{row.rank}</div>
                <div>
                  <p className="font-semibold text-navy">{row.department}</p>
                  <p className="text-sm text-stone">{row.totalAttended} classes/events attended</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-right text-sm">
                <div><p className="font-semibold text-navy">{row.averageAttendance}</p><p className="text-xs text-stone">Avg attendance</p></div>
                <div><p className="font-semibold text-navy">{row.mostImproved}</p><p className="text-xs text-stone">Improved</p></div>
                <div><p className="font-semibold text-navy">{row.streak}</p><p className="text-xs text-stone">Streak</p></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ProgressRing({ value, label, color = "#98a994" }: { value: number; label: string; color?: string }) {
  return (
    <div className="grid place-items-center gap-3">
      <div className="ring-progress grid h-28 w-28 place-items-center rounded-full" style={{ "--ring-value": value, "--ring-color": color } as any}>
        <div className="grid h-20 w-20 place-items-center rounded-full bg-ivory text-xl font-semibold text-navy">{value}%</div>
      </div>
      <p className="text-center text-sm font-medium text-navy">{label}</p>
    </div>
  );
}

function CourseCard({ course, compact = false }: { course: Course; compact?: boolean }) {
  return (
    <Link to={`/course/${course.id}`} className="group overflow-hidden rounded-5xl glass transition hover:-translate-y-1 hover:shadow-ambient">
      <div className="relative h-52 overflow-hidden">
        <img src={course.image} alt={course.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/70 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs backdrop-blur">{course.category}</span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs backdrop-blur">{course.rating?.toFixed?.(1) || "4.8"}</span>
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-xl font-semibold text-navy">{course.title}</h3>
        {!compact && <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone">{course.description}</p>}
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-navy">
          <span className="rounded-full bg-sand/60 px-3 py-1">{course.level}</span>
          <span className="rounded-full bg-sand/60 px-3 py-1">{course.duration}</span>
          <span className="rounded-full bg-sand/60 px-3 py-1">{course.format}</span>
        </div>
      </div>
    </Link>
  );
}

function Loading() {
  return <Card><div className="h-24 animate-pulse rounded-4xl bg-white/60" /></Card>;
}

function ErrorState({ message }: { message: string }) {
  return <Card><p className="font-medium text-navy">Something needs attention</p><p className="mt-2 text-sm text-stone">{message}</p></Card>;
}

function Landing() {
  const { data } = useApi<{ courses: Course[] }>("/api/courses", undefined, { courses: [] });
  return (
    <div>
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-[1.08fr_.92fr] lg:items-center">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm uppercase tracking-[0.28em] text-stone">Operating system for the AI era</p>
          <h1 className="mt-5 text-5xl font-light tracking-tight text-navy md:text-7xl">Human skills that scale with the workforce.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-stone">
            A corporate upskilling, wellbeing, certification, and analytics platform for resilient human capability.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/login" className="rounded-full bg-navy px-6 py-3 font-medium text-white shadow-ambient">Enter demo</Link>
            <Link to="/courses" className="rounded-full glass px-6 py-3 font-medium text-navy">Explore courses</Link>
          </div>
        </motion.div>
        <Card className="sand-panel">
          <div className="rounded-5xl bg-white/50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-stone">Workforce transformation</p>
                <p className="mt-1 text-3xl font-semibold text-navy">84%</p>
              </div>
              <Sparkles className="text-gold" />
            </div>
            <div className="mt-8 grid grid-cols-3 gap-4">
              <ProgressRing value={78} label="Recovery" />
              <ProgressRing value={86} label="Presence" color="#c5a059" />
              <ProgressRing value={72} label="Empathy" color="#1a2b3c" />
            </div>
          </div>
        </Card>
      </section>
      <section className="mx-auto max-w-7xl px-5 pb-16">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-stone">Marketplace</p>
            <h2 className="mt-2 text-3xl font-light text-navy">Premium human skills certifications</h2>
          </div>
          <Link to="/courses" className="hidden items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-navy md:flex">View all <ChevronRight size={16} /></Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {(data?.courses || []).slice(0, 3).map((course) => <CourseCard key={course.id} course={course} />)}
        </div>
      </section>
    </div>
  );
}

function Login({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const navigate = useNavigate();
  if (auth.user) return <Navigate to={auth.user.homePath || "/admin"} replace />;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await api<{ token: string; user: UserType; pending?: boolean; message?: string; needsOnboarding?: boolean }>("/api/auth/login", undefined, {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      if (result.needsOnboarding) {
        auth.login(result.token, result.user);
        window.location.href = "/portal";
        return;
      }
      if (result.pending) throw new Error(result.message || "Account pending approval");
      auth.login(result.token, result.user);
      navigate(result.user.homePath || "/app/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function googleSignIn(credential: string) {
    setLoading(true);
    setError("");
    try {
      const result = await corporateGoogleSignIn(credential);
      if (result.needsOnboarding) {
        auth.login(result.token, result.user as UserType);
        window.location.href = "/portal";
        return;
      }
      auth.login(result.token, result.user as UserType);
      navigate((result.user.homePath || "/app/dashboard") as string);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-82px)] max-w-md flex-col justify-center px-5 py-12">
      <Card>
        <h1 className="text-3xl font-light text-navy">Sign in</h1>
        <p className="mt-2 text-sm text-stone">Use your corporate wellness account. New users can sign up at the corporate portal.</p>
        <form onSubmit={submit} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-navy">Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-full border border-sand bg-white/70 px-5 py-3 outline-none focus:border-navy" /></label>
          <label className="grid gap-2 text-sm font-medium text-navy">Password<input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-full border border-sand bg-white/70 px-5 py-3 outline-none focus:border-navy" /></label>
          {error && <p className="rounded-3xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="rounded-full bg-navy px-5 py-3 font-medium text-white disabled:opacity-60">{loading ? "Signing in..." : "Sign in"}</button>
          <GoogleSignInDivider />
          <GoogleSignIn onCredential={googleSignIn} onError={setError} disabled={loading} />
          <a href="/portal" className="text-center text-sm font-medium text-navy">Corporate portal sign up</a>
        </form>
      </Card>
    </div>
  );
}

function Register({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [pendingMessage, setPendingMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setPendingMessage("");
    try {
      const result = await api<{ token?: string; user?: UserType; pending?: boolean; message?: string }>("/api/auth/register", undefined, { method: "POST", body: JSON.stringify(form) });
      if (result.pending) {
        setPendingMessage(result.message || "Account created. A Dharma Space administrator will approve your access.");
        return;
      }
      if (result.token && result.user) {
        auth.login(result.token, result.user);
        navigate(result.user.homePath);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function googleSignIn(credential: string) {
    setLoading(true);
    setError("");
    setPendingMessage("");
    try {
      const result = await corporateGoogleSignIn(credential);
      auth.login(result.token, result.user as UserType);
      navigate((result.user.homePath || "/app/dashboard") as string);
    } catch (err: any) {
      if (err.message?.includes("awaiting approval")) {
        setPendingMessage(err.message);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-16">
      <Card>
        <h1 className="text-3xl font-light text-navy">Create your account</h1>
        <p className="mt-2 text-sm text-stone">New accounts are reviewed by a Dharma Space administrator before access is granted.</p>
        <GoogleSignIn className="mt-6" onCredential={googleSignIn} onError={setError} disabled={loading} />
        <GoogleSignInDivider label="Or register with email" />
        <form onSubmit={submit} className="mt-2 grid gap-4">
          {(["name", "email", "password"] as const).map((field) => (
            <input key={field} type={field === "password" ? "password" : "text"} placeholder={field} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} className="rounded-full border border-sand bg-white/70 px-5 py-3 outline-none" />
          ))}
          {pendingMessage && <p className="rounded-3xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{pendingMessage}</p>}
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="rounded-full bg-navy px-5 py-3 font-medium text-white disabled:opacity-60">{loading ? "Submitting…" : "Request access"}</button>
        </form>
      </Card>
    </div>
  );
}

function SocialLoginButtons() {
  return null;
}

function CoursesPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const { data, loading, error } = useApi<{ courses: Course[] }>(`/api/courses?category=${encodeURIComponent(category)}&search=${encodeURIComponent(search)}`, undefined, { courses: [] });
  const courses = data?.courses || [];
  const featured = courses[0];
  return (
    <div className="stitch-shell min-h-screen pb-32 text-[#1b1c1c]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#faf9f9]/80 shadow-[0_40px_60px_-15px_rgba(4,22,39,0.08)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-5 py-4 md:px-16">
          <Link to="/" className="flex items-center gap-4">
            <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[#041627]"><img src={LOGO_URL} alt="Dharma Space" className="h-full w-full object-contain bg-white" /></div>
            <h1 className="text-[28px] font-light tracking-[-0.03em] text-[#041627]">Dharma Space</h1>
          </Link>
          <div className="hidden max-w-md flex-1 px-8 md:block">
            <div className="relative">
              <MSIcon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#44474c]/70" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-full border border-[#c4c6cd]/30 bg-[#f5f3f3] py-2 pl-12 pr-4 outline-none focus:ring-1 focus:ring-[#041627]" placeholder="Explore wisdom..." />
            </div>
          </div>
          <nav className="hidden items-center gap-8 md:flex"><span className="text-[#44474c]/70">Intelligence</span><span className="font-bold text-[#041627]">Vitality</span><span className="text-[#44474c]/70">Flow</span></nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-5 pt-8 md:px-16">
        <div className="mb-8 md:hidden">
          <div className="relative"><MSIcon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#44474c]/70" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-[2rem] border border-[#c4c6cd]/30 bg-[#f5f3f3] py-4 pl-12 pr-4 outline-none" placeholder="Search Academy..." /></div>
        </div>
        <section className="mb-10 overflow-hidden">
          <div className="flex gap-3 overflow-x-auto pb-4">
            {["All", "Breathwork", "Emotional Intelligence", "Somatic Practices", "Leadership Wellbeing", "Sleep & Recovery"].map((item) => (
              <button key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-6 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${category === item ? "bg-[#041627] text-white" : "border border-white/20 bg-[#d6e8d0] text-[#596956]"}`}>{item === "All" ? "All Wisdom" : item}</button>
            ))}
          </div>
        </section>
        {loading && <Loading />}
        {error && <ErrorState message={error} />}
        {featured && (
          <section className="mb-16">
            <Link to={`/course/${featured.id}`} className="group relative block h-[500px] w-full cursor-pointer overflow-hidden rounded-[2rem] shadow-2xl">
              <img src={featured.image} alt={featured.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#041627]/80 to-transparent" />
              <div className="absolute bottom-0 left-0 flex w-full flex-col justify-between gap-6 p-8 md:flex-row md:items-end md:p-12">
                <div className="max-w-2xl">
                  <span className="mb-4 inline-block rounded-md bg-[#ffdea5] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#261900]">Masterclass</span>
                  <h2 className="mb-4 text-[48px] font-light leading-[1.1] tracking-[-0.02em] text-white">{featured.title}</h2>
                  <p className="text-white/75">{featured.instructor?.name || "Dharma Faculty"} · {featured.category}</p>
                </div>
                <span className="flex items-center gap-2 rounded-full bg-white px-8 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#041627]">Begin Journey <MSIcon name="arrow_forward" /></span>
              </div>
            </Link>
          </section>
        )}
        <section>
          <div className="mb-8 flex items-end justify-between">
            <div><h3 className="text-[32px] font-normal text-[#041627]">Curated Pathways</h3><p className="text-[#44474c]">Precision-engineered for the modern human.</p></div>
            <span className="border-b border-[#041627]/20 pb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#041627]">View All</span>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.slice(1).map((course) => (
              <Link key={course.id} to={`/course/${course.id}`} className="group flex h-full flex-col">
                <div className="relative mb-6 aspect-[4/5] overflow-hidden rounded-[2rem] shadow-lg">
                  <img src={course.image} alt={course.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  {course.certificationAvailable && <div className="glass-panel absolute right-4 top-4 flex items-center gap-1 rounded-full px-3 py-1"><MSIcon name="verified" className="text-sm text-[#041627]" /><span className="text-xs font-semibold uppercase text-[#041627]">Accredited</span></div>}
                </div>
                <div className="flex flex-grow flex-col">
                  <div className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-[0.18em] text-[#44474c]/60"><span>{course.category}</span><span>{course.duration}</span></div>
                  <h4 className="mb-4 text-[20px] font-medium text-[#041627] transition-colors group-hover:text-[#392700]">{course.title}</h4>
                  <div className="mt-auto flex items-center justify-between border-t border-[#c4c6cd]/20 pt-4"><span className="text-xs italic text-[#44474c]/80">{course.rating.toFixed(1)}/5 Rating</span><span className="text-xs text-[#44474c]/60">{course.enrolledCount} enrolled</span></div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function CourseDetail({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const { id } = useParams();
  const { data, loading, error } = useApi<{ course: Course }>(`/api/courses/${id}`, auth.token);
  const [message, setMessage] = useState("");
  async function enroll() {
    if (!auth.user) return setMessage("Login to enroll.");
    await api("/api/enrollments", auth.token, { method: "POST", body: JSON.stringify({ courseId: id }) });
    setMessage("Enrollment created. Your progress path is ready.");
  }
  if (loading) return <div className="mx-auto max-w-5xl px-5 py-10"><Loading /></div>;
  if (error || !data?.course) return <div className="mx-auto max-w-5xl px-5 py-10"><ErrorState message={error || "Missing course"} /></div>;
  const course = data.course;
  return (
    <div className="stitch-shell min-h-screen bg-[#faf9f9] pb-32 text-[#1b1c1c]">
      <nav className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-5 py-6 md:px-16">
        <Link to="/courses" className="grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-[#faf9f9]/40 shadow-sm backdrop-blur-md"><MSIcon name="arrow_back" className="text-[#041627]" /></Link>
        <button className="grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-[#faf9f9]/40 shadow-sm backdrop-blur-md"><MSIcon name="share" className="text-[#041627]" /></button>
      </nav>
      <section className="relative h-[618px] w-full overflow-hidden md:h-[751px]">
        <img src={course.image} alt={course.title} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#faf9f9] via-transparent to-transparent" />
        <div className="relative z-10 mx-auto flex h-full max-w-[1280px] flex-col justify-end px-5 pb-16 md:px-16 md:pb-24">
          <div className="max-w-3xl">
            <span className="mb-4 block text-xs font-semibold uppercase tracking-[0.24em] text-[#041627]/60">{course.category}</span>
            <h1 className="mb-6 text-5xl font-light leading-none tracking-[-0.02em] text-[#041627] md:text-[64px]">{course.title}</h1>
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full border-2 border-white/50 bg-white"><img src={LOGO_URL} alt="Instructor" className="h-full w-full object-contain" /></div>
              <p className="text-[20px] font-medium text-[#536350]">Instructor: {course.instructor?.name || "Dharma Faculty"}</p>
            </div>
          </div>
        </div>
      </section>
      <main className="relative z-20 mx-auto -mt-12 max-w-[1280px] px-5 md:px-16">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <div className="space-y-12 md:col-span-7">
            <div className="glass-panel rounded-[2rem] p-8 md:p-12">
              <h3 className="mb-6 text-[20px] font-medium text-[#041627]">The Somatic Advantage</h3>
              <p className="text-[18px] italic leading-[1.6] text-[#44474c]">"As AI takes over the cognitive, your embodied intelligence becomes your competitive edge."</p>
              <p className="mt-6 text-base leading-[1.6] text-[#44474c]">{course.description}</p>
            </div>
            <div className="space-y-8">
              <h3 className="ml-4 text-[20px] font-medium text-[#041627]">Course Milestones</h3>
              <div className="relative ml-8 space-y-16 border-l-2 border-[#d2e4fb]/50 pl-12">
                {(course.modules || []).map((module, index) => (
                  <div key={module.id} className={`relative ${index > 1 ? "opacity-50" : ""}`}>
                    <div className={`absolute -left-[57px] top-0 grid h-11 w-11 place-items-center rounded-full shadow-lg ${index === 0 ? "bg-[#536350] text-white" : index === 1 ? "bg-[#d2e4fb] text-[#041627]" : "border border-[#c4c6cd] bg-[#efeded] text-[#74777d]"}`}>
                      <MSIcon name={index === 0 ? "check" : index === 1 ? "play_arrow" : "lock"} />
                    </div>
                    <span className="mb-3 inline-block rounded-full bg-[#d2e4fb]/50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#041627]">Module {String(index + 1).padStart(2, "0")}{index === 1 ? " · Currently Active" : ""}</span>
                    <h4 className="mb-2 text-[20px] font-medium text-[#041627]">{module.title}</h4>
                    <p className="max-w-lg text-base leading-[1.6] text-[#44474c]">{module.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-6 md:col-span-5">
            <div className="glass-panel sticky top-24 rounded-[2rem] border border-white/40 p-8 shadow-xl">
              <div className="mb-8 flex items-end justify-between">
                <div><h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#041627]">Course Progress</h4><p className="text-4xl font-light text-[#041627]">50% <span className="text-base text-[#44474c]">Complete</span></p></div>
                <MSIcon name="spa" className="scale-150 animate-pulse text-[#536350]" />
              </div>
              <div className="relative mb-10 h-3 w-full overflow-hidden rounded-full bg-[#e3e2e2]"><div className="h-full w-1/2 rounded-full bg-[#041627]" /></div>
              <div className="space-y-4">
                <button onClick={enroll} className="flex w-full items-center justify-center gap-3 rounded-full bg-[#041627] py-5 text-[20px] font-medium text-white shadow-2xl">Continue Session <MSIcon name="arrow_forward" /></button>
                <button className="w-full rounded-full border border-[#041627]/10 py-5 text-[20px] font-medium text-[#041627]">View Syllabus</button>
              </div>
              {message && <p className="mt-5 rounded-[2rem] bg-[#d6e8d0] p-4 text-sm text-[#041627]">{message}</p>}
              <div className="mt-12 border-t border-[#041627]/5 pt-8"><div className="flex items-center gap-4 text-[#44474c]"><MSIcon name="verified_user" className="text-[#536350]" /><span className="text-xs font-semibold uppercase tracking-[0.18em]">Accredited by Dharma Space</span></div></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function EmployeeDashboard({ auth }: { auth: ReturnType<typeof useAuth> }) {
  return (
    <CwpEmployeeDashboard
      auth={{
        token: auth.token,
        user: auth.user
          ? { id: auth.user.id, name: auth.user.name, role: auth.user.role }
          : null
      }}
    />
  );
}

function CourseProgress({ title, progress }: { title: string; progress: number }) {
  return <Card><ProgressRing value={progress} label={title} /></Card>;
}

function Section({ title, items }: { title: string; items: ReactNode[] }) {
  return (
    <div className="mt-6">
      <h2 className="mb-4 text-2xl font-light text-navy">{title}</h2>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{items}</div>
    </div>
  );
}

function WellbeingCheckin({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const [form, setForm] = useState({ mood: 4, stress: 2, energy: 4, sleep: 3, focus: 4, note: "" });
  const { data, setData } = useApi<any>("/api/wellbeing/me", auth.token);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await api<any>("/api/wellbeing/checkin", auth.token, { method: "POST", body: JSON.stringify(form) });
    setMessage(result.recommendation);
    setData({ ...data, checkins: [result.checkin, ...(data?.checkins || [])] });
  }
  return (
    <AppLayout auth={auth} title="Wellbeing Check-In" subtitle="Private reflections stay personal. HR only receives aggregate, anonymized signals.">
      <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
        <Card>
          <form onSubmit={submit} className="grid gap-5">
            {(["mood", "stress", "energy", "sleep", "focus"] as const).map((field) => (
              <label key={field} className="grid gap-2 text-sm font-medium capitalize text-navy">
                {field}: {form[field]}
                <input type="range" min="1" max="5" value={form[field]} onChange={(event) => setForm({ ...form, [field]: Number(event.target.value) })} />
              </label>
            ))}
            <textarea placeholder="Optional private note" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className="min-h-28 rounded-4xl border border-sand bg-white/70 p-4 outline-none" />
            <button className="rounded-full bg-navy px-5 py-3 font-medium text-white">Save check-in</button>
            {message && <p className="rounded-4xl bg-sage/20 p-4 text-sm text-navy">{message}</p>}
          </form>
        </Card>
        <Card>
          <h2 className="text-2xl font-light text-navy">Personal trend</h2>
          <p className="mt-2 text-sm text-stone">Weekly wellbeing score: {data?.weeklyScore || 0}</p>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={(data?.checkins || []).slice().reverse().map((c: any, i: number) => ({ day: `D${i + 1}`, energy: c.energy, stress: c.stress, focus: c.focus }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d9" /><XAxis dataKey="day" /><YAxis domain={[1, 5]} /><Tooltip />
                <Area dataKey="energy" stroke="#98a994" fill="#98a99455" />
                <Area dataKey="focus" stroke="#1a2b3c" fill="#1a2b3c22" />
                <Area dataKey="stress" stroke="#c5a059" fill="#c5a05933" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

function HRDashboard({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const isAdmin = auth.user?.role === "SUPER_ADMIN";
  const { company } = useSelectedCompany();
  const scopedCompany = isAdmin ? company : null;
  const dashboardPath = scopedCompany ? `/api/hr/dashboard?companyId=${encodeURIComponent(scopedCompany.id)}` : "/api/hr/dashboard";
  const adminSubtitle = scopedCompany ? `${scopedCompany.name} · scoped view` : "All companies · platform-wide";
  const { data, loading, error } = useApi<any>(dashboardPath, auth.token);
  if (loading) return <AppLayout auth={auth} title="HR Analytics" subtitle="Aggregate workforce intelligence."><Loading /></AppLayout>;
  if (error) return <AppLayout auth={auth} title="HR Analytics" subtitle="Aggregate workforce intelligence."><ErrorState message={error} /></AppLayout>;
  const departments = data.departmentEngagement?.length ? data.departmentEngagement : [
    { name: "Engineering", completion: 94, active: 214 },
    { name: "Product/UX", completion: 89, active: 132 },
    { name: "Operations", completion: 78, active: 168 },
    { name: "Sales & GTM", completion: 62, active: 98 }
  ];
  const heatmapRows = [
    ["Engineering", ["cwp-heat-olive-90", "cwp-heat-olive-80", "cwp-heat-olive-95", "cwp-heat-olive-70", "cwp-heat-seafoam-30", "cwp-heat-seafoam-20", "cwp-heat-seafoam-40", "cwp-heat-seafoam-10", "cwp-heat-seafoam-5", "cwp-heat-seafoam-10"]],
    ["Sales & GTM", ["cwp-heat-seafoam-40", "cwp-heat-seafoam-50", "cwp-heat-risk-30", "cwp-heat-risk-50", "cwp-heat-risk-60", "cwp-heat-risk-50", "cwp-heat-risk-40", "cwp-heat-risk-20", "cwp-heat-seafoam-30", "cwp-heat-seafoam-20"]],
    ["Operations", ["cwp-heat-olive-95", "cwp-heat-olive-90", "cwp-heat-olive-90", "cwp-heat-olive-90", "cwp-heat-olive-90", "cwp-heat-olive-80", "cwp-heat-olive-90", "cwp-heat-olive-90", "cwp-heat-olive-95", "cwp-heat-olive-90"]],
    ["Product/UX", ["cwp-heat-olive-80", "cwp-heat-olive-90", "cwp-heat-seafoam-40", "cwp-heat-seafoam-30", "cwp-heat-seafoam-20", "cwp-heat-olive-80", "cwp-heat-olive-90", "cwp-heat-seafoam-50", "cwp-heat-seafoam-20", "cwp-heat-olive-70"]]
  ];
  return (
    <AppLayout auth={auth} title="Organization Resilience & Flow" subtitle={isAdmin ? adminSubtitle : "Mind-gamification analytics · live demo"}>
      <div className="space-y-8">
        {isAdmin && (
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--cwp-border)] bg-[var(--cwp-surface)] px-4 py-3 text-sm">
            <Building2 size={16} className="text-[var(--cwp-olive)]" />
            <span className="text-[var(--cwp-text-muted)]">
              {scopedCompany ? (
                <>Showing data for <span className="font-semibold text-[var(--cwp-charcoal)]">{scopedCompany.name}</span>. Switch companies from the left menu.</>
              ) : (
                <>Aggregated across <span className="font-semibold text-[var(--cwp-charcoal)]">all companies</span>. Pick one in the left menu to scope this view.</>
              )}
            </span>
          </div>
        )}
        <div className="flex justify-end">
          <button type="button" className="cwp-btn-secondary hidden items-center gap-2 md:flex">
            <MSIcon name="file_download" /> Export Executive Summary
          </button>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {[
            ["bolt", "Organizational Energy", "91.4", "Optimal"],
            ["groups", "Mindful Participation", `${data.kpis.wellbeingAdoption || 78}%`, "Target: 85%"],
            ["verified", "Flow State Mastery", data.kpis.activeLearners || 1412, "Active practitioners"],
            ["trending_up", "Wellbeing ROI", "$1.8M", "Reduced absenteeism"]
          ].map(([icon, label, value, detail], index) => (
            <div key={label} className={`cwp-stat-metric cwp-stat-metric--${index % 12} relative overflow-hidden`}>
              <MSIcon name={String(icon)} className="absolute right-4 top-4 text-6xl text-[var(--cwp-olive)]/10" />
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-stone">{label}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-[48px] font-light leading-[1.1] tracking-[-0.02em] text-navy">{value}</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--cwp-seafoam)]">{detail}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="glass-panel rounded-[2rem] p-8 lg:col-span-2">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-[20px] font-medium text-navy">Biometric Burnout Risk Heatmap</h3>
                <p className="mt-1 text-xs text-stone">Cross-departmental stress indicators vs. restorative practices</p>
              </div>
              <div className="flex gap-4 text-xs font-bold uppercase tracking-tight text-stone">
                <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full bg-[var(--cwp-olive)]" />Coherent</span>
                <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full bg-[var(--cwp-seafoam)]/40" />Neutral</span>
                <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full bg-[var(--cwp-terracotta)]/40" />Risk</span>
              </div>
            </div>
            <div className="space-y-4">
              {heatmapRows.map(([department, cells]) => (
                <div key={String(department)} className="grid grid-cols-12 items-center gap-4">
                  <span className="col-span-3 text-xs font-bold uppercase tracking-tight text-stone md:col-span-2">{department}</span>
                  <div className="col-span-9 grid h-10 grid-cols-10 gap-1 md:col-span-10">
                    {(cells as string[]).map((cell, index) => <div key={index} className={`${cell} cursor-pointer rounded hover:ring-2 hover:ring-[var(--cwp-olive)]`} />)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 border-t border-sand pt-8">
              <div className="cwp-insight-panel flex items-start gap-4 rounded-[2rem] p-6">
                <MSIcon name="auto_awesome" className="animate-pulse text-[var(--cwp-yellow)]" />
                <div>
                  <p className="mb-1 font-bold text-white">Dharma Intelligence Recommendation</p>
                  <p className="text-sm leading-relaxed opacity-90">{data.aiRecommendation || "Sales is entering a red-zone fatigue pattern. Schedule Micro-Flow prompts and a Friday digital detox reset."}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="glass-panel flex flex-col overflow-hidden rounded-[2rem] p-8">
            <h3 className="text-[20px] font-medium text-navy">Participation Momentum</h3>
            <p className="mt-1 text-xs text-stone">Real-time engagement velocity</p>
            <div className="space-y-8 py-8">
              {[["Morning Coherence", 85, "ACTIVE NOW"], ["Creative Flow Drills", 42, "42% PEAK"], ["Somatic Reset", 68, "SURGING"]].map(([label, value, status]) => (
                <div key={String(label)}>
                  <div className="mb-2 flex justify-between text-xs font-bold uppercase tracking-widest">
                    <span className="text-navy">{label}</span><span className="text-[var(--cwp-seafoam)]">{status}</span>
                  </div>
                  <div className="relative h-4 rounded-full bg-[var(--cwp-seafoam)]/10">
                    <div className="h-full rounded-full bg-[var(--cwp-seafoam)]" style={{ width: `${value}%` }} />
                    {Number(value) > 60 && <div className="absolute top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[var(--cwp-seafoam)]/20" style={{ left: `${value}%` }}><div className="momentum-dot h-3 w-3 rounded-full bg-[var(--cwp-seafoam)]" /></div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-auto rounded-[2rem] border border-sand bg-[var(--cwp-mint)]/30 p-4 text-xs font-medium text-stone">
              Participation is <span className="font-bold text-navy">12% higher</span> than the same period last week.
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="glass-panel rounded-[2rem] p-8">
            <h3 className="mb-2 text-[20px] font-medium text-navy">Ecosystem Vitality</h3>
            <p className="mb-8 text-xs text-stone">Longitudinal growth of organizational intelligence</p>
            <div className="chart-grid relative h-64">
              <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                <path d="M0 80 Q 20 60, 40 70 T 80 30 T 100 10" fill="none" stroke="var(--cwp-olive)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                <path d="M0 90 Q 20 85, 40 88 T 80 60 T 100 45" fill="none" stroke="var(--cwp-seafoam)" strokeDasharray="6 3" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
          </div>
          <div className="glass-panel rounded-[2rem] p-8">
            <div className="mb-8 flex items-center justify-between">
              <h3 className="text-[20px] font-medium text-navy">Department Mindset Leaderboard</h3>
              <MSIcon name="emoji_events" className="text-[var(--cwp-seafoam)]" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead><tr className="border-b border-sand text-[10px] font-bold uppercase tracking-widest text-stone"><th className="pb-4">Department</th><th className="pb-4">Flow Adoption</th><th className="pb-4">Vitality</th><th className="pb-4 text-right">Tier</th></tr></thead>
                <tbody className="divide-y divide-sand/50">
                  {departments.slice(0, 4).map((department: any, index: number) => (
                    <tr key={department.name} className="hover:bg-[var(--cwp-olive)]/5">
                      <td className="py-4 text-sm font-semibold text-navy">{department.name}</td>
                      <td className="py-4 text-sm text-stone">{department.completion}%</td>
                      <td className="py-4 text-sm text-stone">{(8.9 - index * 0.7).toFixed(1)}</td>
                      <td className="py-4 text-right text-xs font-bold"><span className="rounded-full border border-[var(--cwp-seafoam)]/20 bg-[var(--cwp-seafoam)]/10 px-3 py-1 text-[var(--cwp-olive)]">{index < 2 ? "MASTERY" : index === 2 ? "STEADY" : "ATTENTION"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function HRWorkspacePage({ auth, section }: { auth: ReturnType<typeof useAuth>; section: string }) {
  const title = pathTitle(section);
  const rows: Record<string, Array<Record<string, ReactNode>>> = {
    employees: [
      { Name: "Maya Employee", Department: "Product", Status: "Active learner", Progress: "82%" },
      { Name: "Ava Morgan", Department: "People & Culture", Status: "Certified", Progress: "94%" },
      { Name: "Theo Malik", Department: "Sales", Status: "Needs support", Progress: "48%" },
      { Name: "Priya Shah", Department: "Leadership", Status: "Active learner", Progress: "76%" }
    ],
    events: demoEvents.map((event) => ({ Event: event.name, Coach: event.coach, Date: `${event.date} ${event.time}`, Location: event.location, SignedUp: `${event.booked}/${event.capacity}` })),
    bookings: demoBookings.map((booking) => ({ Booking: booking.name, Coach: booking.coach, Date: `${booking.date} ${booking.time}`, Location: booking.location })),
    "booking-history": attendanceHistory.map((item) => ({ Event: item.event, Coach: item.coach, Date: item.date, Attended: item.attended })),
    statistics: [
      { Metric: "Wellness improvement", Current: "+18%", Trend: "+6%", Recommendation: "Scale yoga and breathwork" },
      { Metric: "ROI", Current: "$1.8M", Trend: "+12%", Recommendation: "Maintain company-wide cadence" },
      { Metric: "Attendance", Current: "86%", Trend: "+9%", Recommendation: "Add larger rooms for peak sessions" }
    ],
    profile: [
      { Field: "Name", Value: "Harper HR", Status: "Corporate HR admin" },
      { Field: "Company", Value: "Asteria Group", Status: "Enterprise plan" },
      { Field: "Permissions", Value: "Events, booking history, statistics", Status: "Active" }
    ],
    departments: [
      { Department: "Engineering", Employees: 214, Adoption: "94%", Tier: "Elite Flow" },
      { Department: "Product/UX", Employees: 132, Adoption: "89%", Tier: "Mastery" },
      { Department: "Operations", Employees: 168, Adoption: "78%", Tier: "Steady" },
      { Department: "Sales & GTM", Employees: 98, Adoption: "62%", Tier: "Attention" }
    ],
    courses: [
      { Course: "Burnout Prevention & Stress Recovery", Enrolled: 142, Completion: "81%", ROI: "High" },
      { Course: "Breathwork for High-Performance Teams", Enrolled: 196, Completion: "74%", ROI: "High" },
      { Course: "Emotional Intelligence for Managers", Enrolled: 88, Completion: "69%", ROI: "Medium" }
    ],
    analytics: [
      { Metric: "Wellbeing adoption", Current: "100%", Trend: "+12%", Recommendation: "Maintain cadence" },
      { Metric: "Burnout risk", Current: "8%", Trend: "-4%", Recommendation: "Support Sales cohort" },
      { Metric: "Certification velocity", Current: "6", Trend: "+2", Recommendation: "Scale leadership path" }
    ],
    reports: [
      { Report: "Q2 Workforce Transformation", Owner: "Harper HR", Status: "Ready", Format: "PDF" },
      { Report: "Anonymous Wellbeing Adoption", Owner: "People Ops", Status: "Draft", Format: "Dashboard" },
      { Report: "Certification ROI Snapshot", Owner: "Finance Partner", Status: "Ready", Format: "CSV" }
    ],
    challenges: [
      { Challenge: "30-Day Stress Recovery", Participation: "78%", Completion: "52%", Badge: "Stress Recovery" },
      { Challenge: "Mindful Leadership Month", Participation: "64%", Completion: "41%", Badge: "Leadership" },
      { Challenge: "Breathwork Week", Participation: "92%", Completion: "71%", Badge: "Breathwork" }
    ],
    billing: [
      { Invoice: "INV-2026-001", Plan: "Enterprise", Amount: "$24,000", Status: "Paid" },
      { Invoice: "INV-2026-002", Plan: "Enterprise", Amount: "$24,000", Status: "Open" },
      { Invoice: "Seats", Plan: "500 seat allocation", Amount: "31 used", Status: "Healthy" }
    ],
    company: [
      { Item: "Plan", Detail: "Enterprise", Status: "Active", Renews: "Jan 2027" },
      { Item: "Seats", Detail: "500 licensed", Status: "31 in use", Renews: "—" },
      { Item: "Subscription", Detail: "$24,000 / yr", Status: "Auto-renew on", Renews: "Jan 2027" },
      { Item: "Latest invoice", Detail: "INV-2026-002", Status: "Open", Renews: "Due Jul 2026" },
      { Item: "Billing contact", Detail: "finance@asteria.group", Status: "Verified", Renews: "—" }
    ]
  };
  const tableRows = rows[section] || rows.analytics;
  const columns = Object.keys(tableRows[0] || {});
  return (
    <AppLayout auth={auth} title={title} subtitle="Enterprise HR workspace · seeded demo data">
      <div className="space-y-8">
        <div className="flex justify-end">
          <Link to="/hr/dashboard" className="cwp-btn-secondary">Back to Intelligence</Link>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="cwp-stat-metric cwp-stat-metric--4"><p className="text-xs uppercase tracking-[0.22em] text-stone">Coverage</p><p className="mt-2 text-4xl font-light text-navy">100%</p><p className="mt-2 text-sm text-[var(--cwp-seafoam)]">Seed data connected</p></div>
          <div className="cwp-stat-metric cwp-stat-metric--7"><p className="text-xs uppercase tracking-[0.22em] text-stone">Privacy</p><p className="mt-2 text-4xl font-light text-navy">Safe</p><p className="mt-2 text-sm text-[var(--cwp-seafoam)]">Aggregated where needed</p></div>
          <div className="cwp-stat-metric cwp-stat-metric--10"><p className="text-xs uppercase tracking-[0.22em] text-stone">Action</p><p className="mt-2 text-4xl font-light text-navy">Ready</p><p className="mt-2 text-sm text-[var(--cwp-seafoam)]">No placeholder menu</p></div>
        </div>
        <div className="glass-panel overflow-hidden rounded-[2rem] p-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-sand text-[10px] uppercase tracking-[0.18em] text-stone">
                <tr>{columns.map((column) => <th key={column} className="pb-4">{column}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-sand/50">
                {tableRows.map((row, index) => (
                  <tr key={index} className="hover:bg-[var(--cwp-olive)]/5">
                    {columns.map((column) => <td key={column} className="py-4 text-navy">{row[column]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function ChartTitle({ title }: { title: string }) {
  return <h2 className="mb-4 text-2xl font-light text-navy">{title}</h2>;
}

function Chart({ data, type, dataKey }: { data: any[]; type: "bar" | "area"; dataKey: string }) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        {type === "bar" ? (
          <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--cwp-border)" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey={dataKey} fill="var(--cwp-olive)" radius={[14, 14, 0, 0]} /></BarChart>
        ) : (
          <AreaChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--cwp-border)" /><XAxis dataKey="week" /><YAxis /><Tooltip /><Area dataKey={dataKey} stroke="var(--cwp-seafoam)" fill="color-mix(in srgb, var(--cwp-seafoam) 35%, transparent)" /></AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function RiskChart({ data }: { data: any[] }) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart><Pie data={data} dataKey="value" nameKey="label" innerRadius={70} outerRadius={115}>{data.map((_entry, index) => <Cell key={index} fill={["var(--cwp-seafoam)", "var(--cwp-yellow)", "var(--cwp-olive)"][index]} />)}</Pie><Tooltip /></PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrainerDashboard({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const { data, loading } = useApi<any>("/api/trainer/dashboard", auth.token);
  if (loading) return <AppLayout auth={auth} title="Trainer Portal" subtitle="Course creation, sessions, certifications, and revenue."><Loading /></AppLayout>;
  return (
    <AppLayout auth={auth} title="Trainer Portal" subtitle="Manage curriculum, live labs, learner progress, certification readiness, and feedback.">
      <div className="grid gap-5 md:grid-cols-4">
        <MetricCard icon={BookOpen} label="Courses" value={data.kpis.courses} detail="Published" />
        <MetricCard icon={Users} label="Learners" value={data.kpis.learners} detail="Participants" />
        <MetricCard icon={CalendarDays} label="Sessions" value={data.kpis.sessions} detail="Scheduled" />
        <MetricCard icon={CircleDollarSign} label="Revenue" value={`$${data.kpis.revenue}`} detail="Course sales" />
      </div>
      <Section title="Your courses" items={data.courses.map((course: Course) => <CourseCard key={course.id} course={course} compact />)} />
      <Card className="mt-6">
        <ChartTitle title="Course builder" />
        <div className="grid gap-3 md:grid-cols-5">
          {["Basic info", "Curriculum modules", "Session schedule", "Certification settings", "Pricing & publish"].map((step) => <div key={step} className="rounded-4xl bg-white/70 p-4 text-sm font-medium text-navy">{step}</div>)}
        </div>
      </Card>
    </AppLayout>
  );
}

function CompanyDashboard({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const { data, loading } = useApi<any>("/api/company/dashboard", auth.token);
  if (loading) return <AppLayout auth={auth} title="Corporate Admin" subtitle="Company controls."><Loading /></AppLayout>;
  return (
    <AppLayout auth={auth} title="Corporate Admin" subtitle="Manage seats, subscription, invoices, SSO placeholders, invitations, and permissions.">
      <div className="grid gap-5 md:grid-cols-4">
        <MetricCard icon={Building2} label="Company" value={data.company?.name || "Company"} detail={data.company?.plan || "Plan"} />
        <MetricCard icon={Users} label="Seats used" value={`${data.seatsUsed}/${data.company?.seats || 0}`} detail="Employee seats" />
        <MetricCard icon={CircleDollarSign} label="Invoices" value={data.company?.invoices?.length || 0} detail="Billing records" />
        <MetricCard icon={Lock} label="SSO" value="Ready" detail="SAML/OIDC placeholder" />
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Card><ChartTitle title="Invitations" />{data.invitations.map((email: string) => <p key={email} className="rounded-full bg-white/70 px-4 py-3 text-sm text-navy">{email}</p>)}</Card>
        <Card><ChartTitle title="Subscription" /><p className="text-stone">Plan: {data.company?.plan}. Seats: {data.company?.seats}. SSO status: {data.sso.status}.</p></Card>
      </div>
    </AppLayout>
  );
}

function AdminDashboard({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const { data, loading, error } = useApi<any>("/api/admin/dashboard", auth.token, {
    kpis: { companies: 0, users: 0, courses: 0, trainers: 0, revenue: 0 },
    subscriptions: []
  });
  const inquiries = useApi<any>("/api/inquiries", auth.token, { submissions: [], mailConfigured: { corporate: false, education: false } });
  if (loading) return <AppLayout auth={auth} title="Platform Admin" subtitle="Global metrics."><Loading /></AppLayout>;
  if (error) return <AppLayout auth={auth} title="Platform Admin" subtitle="Global metrics."><ErrorState message={`${error}. Please log out and log back in if the database was reseeded.`} /></AppLayout>;
  const kpis = data?.kpis || { companies: 0, users: 0, courses: 0, trainers: 0, revenue: 0 };
  const subscriptions = data?.subscriptions || [];
  const recent = inquiries.data?.submissions?.slice(0, 5) || [];
  return (
    <AppLayout auth={auth} title="Platform Super Admin" subtitle="Manage companies, users, trainers, courses, subscriptions, and platform revenue.">
      <Card className="mb-5 border border-[#C4785A]/30 bg-white/90">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <ChartTitle title="Website form inbox" />
            <p className="mt-1 text-sm text-stone">{inquiries.data?.submissions?.length || 0} submissions from contact, booking, and waitlist forms.</p>
          </div>
          <Link to="/admin/inquiries" className="rounded-full bg-navy px-5 py-3 text-sm font-medium text-white">Open Inquiries</Link>
        </div>
        {recent.length > 0 ? (
          <div className="mt-4 divide-y divide-sand/70">
            {recent.map((item: any) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-navy">{item.name} · {item.email}</p>
                  <p className="text-stone">{item.type.replace(/_/g, " ")} — {item.subject || item.message || "No subject"}</p>
                </div>
                <span className="text-xs text-stone">{new Date(item.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-stone">No form submissions yet.</p>
        )}
      </Card>
      <div className="grid gap-5 md:grid-cols-5">
        <MetricCard icon={Building2} label="Companies" value={kpis.companies} detail="Active" />
        <MetricCard icon={Users} label="Users" value={kpis.users} detail="Total" />
        <MetricCard icon={BookOpen} label="Courses" value={kpis.courses} detail="Catalog" />
        <MetricCard icon={GraduationCap} label="Trainers" value={kpis.trainers} detail="Active" />
        <MetricCard icon={CircleDollarSign} label="Revenue" value={`$${kpis.revenue}`} detail="Seed invoices" />
      </div>
      <Card className="mt-5"><ChartTitle title="Subscriptions" /><Chart data={subscriptions} type="bar" dataKey="count" /></Card>
    </AppLayout>
  );
}

function AdminCompaniesPage({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const { data, loading, error } = useApi<any>("/api/admin/companies", auth.token, { companies: [] });
  return (
    <AppLayout auth={auth} title="Companies" subtitle="Live seeded customer companies, subscription plans, seats, revenue, and workforce adoption footprint.">
      {loading && <Loading />}
      {error && <ErrorState message={error} />}
      <div className="grid gap-5 md:grid-cols-2">
        {(data?.companies || []).map((company: any) => (
          <Card key={company.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-stone">{company.industry}</p>
                <h2 className="mt-2 text-2xl font-light text-navy">{company.name}</h2>
              </div>
              <span className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white">{company.plan}</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <StatPill label="Seats" value={`${company.userCount}/${company.seats}`} />
              <StatPill label="Departments" value={company.departmentCount} />
              <StatPill label="Challenges" value={company.challengeCount} />
              <StatPill label="Revenue" value={`$${company.revenue.toLocaleString()}`} />
            </div>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}

function AdminUsersPage({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const { data, loading, error } = useApi<any>("/api/admin/users", auth.token, { users: [] });
  return (
    <AppLayout auth={auth} title="Users" subtitle="Seeded employees, HR admins, trainers, corporate admins, and platform operators.">
      {loading && <Loading />}
      {error && <ErrorState message={error} />}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-stone">
              <tr><th className="pb-3">Name</th><th className="pb-3">Email</th><th className="pb-3">Role</th><th className="pb-3">Company</th><th className="pb-3">Department</th></tr>
            </thead>
            <tbody className="divide-y divide-sand/70">
              {(data?.users || []).map((user: any) => (
                <tr key={user.id}>
                  <td className="py-4 font-medium text-navy">{user.name}</td>
                  <td className="py-4 text-stone">{user.email}</td>
                  <td className="py-4"><span className="rounded-full bg-sage/20 px-3 py-1 text-xs font-medium text-navy">{user.role.replace(/_/g, " ")}</span></td>
                  <td className="py-4 text-stone">{user.company?.name || "Platform"}</td>
                  <td className="py-4 text-stone">{user.department?.name || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <QuickRegisterPanel />
    </AppLayout>
  );
}

function AdminCoursesPage({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const { data, loading, error } = useApi<any>("/api/admin/courses", auth.token, { courses: [] });
  return (
    <AppLayout auth={auth} title="Courses" subtitle="Seeded marketplace programs, trainer ownership, modules, certification status, and enrollment volume.">
      {loading && <Loading />}
      {error && <ErrorState message={error} />}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {(data?.courses || []).map((course: any) => (
          <Card key={course.id}>
            <p className="text-sm uppercase tracking-[0.2em] text-stone">{course.category}</p>
            <h2 className="mt-2 text-xl font-semibold text-navy">{course.title}</h2>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone">{course.description}</p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <StatPill label="Trainer" value={course.instructor?.name || "Unassigned"} />
              <StatPill label="Modules" value={course.moduleCount} />
              <StatPill label="Enrollments" value={course.enrollmentCount} />
              <StatPill label="Price" value={`$${course.price}`} />
            </div>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}

function AdminTrainersPage({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const { data, loading, error } = useApi<any>("/api/admin/trainers", auth.token, { trainers: [] });
  return (
    <AppLayout auth={auth} title="Trainers" subtitle="Trainer roster with dummy seeded course ownership, learner reach, sessions, and revenue.">
      {loading && <Loading />}
      {error && <ErrorState message={error} />}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {(data?.trainers || []).map((trainer: any) => (
          <Card key={trainer.id}>
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-navy text-white">{trainer.avatar || trainer.name.slice(0, 2)}</div>
              <div>
                <h2 className="text-xl font-semibold text-navy">{trainer.name}</h2>
                <p className="text-sm text-stone">{trainer.email}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <StatPill label="Company" value={trainer.company?.name || "Independent"} />
              <StatPill label="Courses" value={trainer.courseCount} />
              <StatPill label="Learners" value={trainer.learnerCount} />
              <StatPill label="Revenue" value={`$${trainer.revenue.toLocaleString()}`} />
            </div>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}

function StatPill({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-4xl bg-white/70 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-stone">{label}</p>
      <p className="mt-1 font-semibold text-navy">{value}</p>
    </div>
  );
}

function QuickRegisterPanel() {
  return (
    <Card className="mt-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_.9fr] lg:items-center">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-stone">Register section</p>
          <h2 className="mt-2 text-2xl font-light text-navy">Invite or register a new user</h2>
          <p className="mt-2 text-sm leading-6 text-stone">This is a UI placeholder for creating a user directly from admin/user surfaces. OAuth buttons are ready for future provider wiring.</p>
        </div>
        <form className="grid gap-3">
          <input placeholder="Email address" className="rounded-full border border-sand bg-white/70 px-5 py-3 outline-none focus:border-navy" />
          <input placeholder="Password" type="password" className="rounded-full border border-sand bg-white/70 px-5 py-3 outline-none focus:border-navy" />
          <button type="button" className="rounded-full bg-navy px-5 py-3 font-medium text-white">Register user placeholder</button>
          <SocialLoginButtons />
        </form>
      </div>
    </Card>
  );
}

function ProgressPage({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const xp = [
    { name: "Wellness XP", value: 78 },
    { name: "Presence XP", value: 62 },
    { name: "Recovery XP", value: 54 },
    { name: "Leadership XP", value: 46 },
    { name: "Empathy XP", value: 51 },
    { name: "Focus XP", value: 70 },
    { name: "Facilitation XP", value: 39 }
  ];
  return (
    <AppLayout auth={auth} title="Mindful Gamification" subtitle="Progress that rewards consistency and care without pressure or public shaming.">
      <div className="grid gap-5 md:grid-cols-3 xl:grid-cols-7">{xp.map((item) => <Card key={item.name}><ProgressRing value={item.value} label={item.name} /></Card>)}</div>
      <Card className="mt-5"><ChartTitle title="Level path" /><div className="grid gap-3 md:grid-cols-7">{["Beginner", "Practitioner", "Facilitator", "Mentor", "Guide", "Certified Professional", "Dharma Space Leader"].map((level, index) => <div key={level} className={`rounded-4xl p-4 text-sm font-medium ${index < 3 ? "bg-navy text-white" : "bg-white/70 text-navy"}`}>{level}</div>)}</div></Card>
    </AppLayout>
  );
}

function CertificatesPage({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const { data } = useApi<any>("/api/certificates/me", auth.token, { certificates: [] });
  return (
    <AppLayout auth={auth} title="Certificates" subtitle="Verified professional credentials for human skills practice and facilitation.">
      <div className="grid gap-5 md:grid-cols-2">
        {(data?.certificates || []).map((certificate: any) => (
          <Card key={certificate.id} className="border border-gold/30">
            <p className="text-sm uppercase tracking-[0.24em] text-gold">Verified Certificate</p>
            <h2 className="mt-4 text-3xl font-light text-navy">{certificate.course.title}</h2>
            <p className="mt-3 text-stone">Awarded to {certificate.user.name} · {new Date(certificate.issuedAt).toLocaleDateString()}</p>
            <p className="mt-3 rounded-full bg-white/70 px-4 py-2 text-sm text-navy">{certificate.certificateNumber}</p>
            <button className="mt-5 rounded-full bg-navy px-5 py-3 text-sm font-medium text-white">Download / LinkedIn placeholder</button>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}

function EmployeeCalendarPage({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const sessions = [
    { time: "Today · 9:30 AM", title: "Nervous System Reset", format: "Live audio", host: "Amara Wells", status: "Registered" },
    { time: "Tomorrow · 2:00 PM", title: "Breathwork for High-Performance Teams", format: "Virtual studio", host: "Talia Trainer", status: "Upcoming" },
    { time: "Fri · 11:00 AM", title: "Manager EI Practice Lab", format: "Hybrid", host: "Nina Patel", status: "Recommended" },
    { time: "Mon · 4:30 PM", title: "Sleep Recovery Office Hours", format: "Online", host: "Jonas Reed", status: "Optional" }
  ];
  const routines = [
    { day: "Mon", focus: "Recovery", minutes: 18, score: 82 },
    { day: "Tue", focus: "Presence", minutes: 12, score: 78 },
    { day: "Wed", focus: "Focus", minutes: 24, score: 88 },
    { day: "Thu", focus: "Empathy", minutes: 16, score: 80 },
    { day: "Fri", focus: "Leadership", minutes: 20, score: 86 }
  ];
  return (
    <AppLayout auth={auth} title="Calendar" subtitle="Your learning sessions, recovery rituals, certification labs, and gentle weekly rhythm.">
      <div className="grid gap-5 md:grid-cols-4">
        <MetricCard icon={CalendarDays} label="This week" value="4" detail="Scheduled sessions" />
        <MetricCard icon={Wind} label="Practice" value="90m" detail="Mindful minutes" />
        <MetricCard icon={CheckCircle2} label="Attendance" value="92%" detail="Live labs" />
        <MetricCard icon={Moon} label="Recovery" value="8:45 PM" detail="Suggested wind-down" />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Card>
          <ChartTitle title="Upcoming sessions" />
          <div className="grid gap-3">
            {sessions.map((session) => (
              <div key={session.title} className="rounded-4xl bg-white/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-stone">{session.time} · {session.format}</p>
                    <p className="mt-1 font-semibold text-navy">{session.title}</p>
                    <p className="mt-1 text-sm text-stone">Hosted by {session.host}</p>
                  </div>
                  <span className="rounded-full bg-sage/20 px-4 py-2 text-sm font-medium text-navy">{session.status}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <ChartTitle title="Weekly rhythm" />
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={routines}><CartesianGrid strokeDasharray="3 3" stroke="#e8e2d9" /><XAxis dataKey="day" /><YAxis hide /><Tooltip /><Bar dataKey="minutes" fill="#98a994" radius={[14, 14, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

function EmployeeCommunityPage({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const circles = [
    { title: "Stress Recovery Circle", members: 48, next: "Reflection prompt opens today", tone: "Recovery" },
    { title: "Mindful Managers", members: 32, next: "Feedback repair practice", tone: "Leadership" },
    { title: "Breathwork Week Cohort", members: 76, next: "Group practice at 3 PM", tone: "Presence" }
  ];
  const posts = [
    { author: "Ava Morgan", text: "Used the 90-second reset before a difficult meeting. Felt much more grounded.", badge: "Mindfulness Consistency Award" },
    { author: "Theo Malik", text: "Our team is trying walking 1:1s this week. Better energy already.", badge: "Dharma Space Pioneer" },
    { author: "Priya Shah", text: "Completed module 2 of Emotional Intelligence for Managers.", badge: "Empathy XP +40" }
  ];
  return (
    <AppLayout auth={auth} title="Community" subtitle="Opt-in circles, peer encouragement, and collective momentum without public shaming.">
      <div className="grid gap-5 md:grid-cols-3">
        {circles.map((circle) => (
          <Card key={circle.title}>
            <p className="text-sm uppercase tracking-[0.2em] text-stone">{circle.tone}</p>
            <h2 className="mt-2 text-xl font-semibold text-navy">{circle.title}</h2>
            <p className="mt-3 text-sm text-stone">{circle.members} members · {circle.next}</p>
            <button className="mt-5 rounded-full bg-navy px-5 py-3 text-sm font-medium text-white">Open circle</button>
          </Card>
        ))}
      </div>
      <Card className="mt-5">
        <ChartTitle title="Recent community signals" />
        <div className="grid gap-3">
          {posts.map((post) => (
            <div key={post.author} className="rounded-4xl bg-white/70 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-navy">{post.author}</p>
                  <p className="mt-1 text-sm leading-6 text-stone">{post.text}</p>
                </div>
                <span className="shrink-0 rounded-full bg-sand/70 px-3 py-1 text-xs font-medium text-navy">{post.badge}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </AppLayout>
  );
}

function EmployeeProfilePage({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const { data: dashboard } = useApi<any>("/api/employee/dashboard", auth.token);
  const roleLabel = auth.user?.role?.replace(/_/g, " ") || "Employee";
  const profileRows = [
    { label: "Company", value: auth.user?.company?.name || "—" },
    { label: "Department", value: auth.user?.department?.name || "—" },
    { label: "Position", value: auth.user?.position || "—" },
    { label: "Role", value: roleLabel }
  ];
  const skillMap = [
    { name: "Recovery", value: 78 },
    { name: "Presence", value: 64 },
    { name: "Empathy", value: 58 },
    { name: "Focus", value: 72 }
  ];
  return (
    <AppLayout auth={auth} title="Profile" subtitle="Your Dharma Space identity, learning path, privacy preferences, and certification progress.">
      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <Card>
          <div className="grid place-items-center text-center">
            <ProfileAvatar
              name={auth.user?.name || "User"}
              avatar={auth.user?.avatar}
              size="lg"
              editable
              token={auth.token}
              onAvatarChange={(avatarUrl) => auth.updateUser({ avatar: avatarUrl })}
            />
            <h2 className="mt-4 text-3xl font-light text-navy">{auth.user?.name}</h2>
            <p className="mt-1 text-stone">{auth.user?.email}</p>
            <span className="mt-4 rounded-full bg-sage/20 px-4 py-2 text-sm font-medium text-navy">{roleLabel}</span>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <StatPill label="Streak" value={`${dashboard?.kpis?.streakDays || 0} days`} />
            <StatPill label="Score" value={dashboard?.kpis?.wellbeingScore || 0} />
            <StatPill label="Certificates" value={dashboard?.kpis?.certificates || 0} />
            <StatPill label="Company" value={auth.user?.company?.name?.split(" ")[0] || "—"} />
          </div>
        </Card>
        <Card>
          <ChartTitle title="Work profile" />
          <div className="grid gap-3">
            {profileRows.map((item) => (
              <div key={item.label} className="rounded-4xl bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone">{item.label}</p>
                <p className="mt-1 font-medium text-navy">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_.9fr]">
        <Card>
          <ChartTitle title="Skill map" />
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="22%" outerRadius="90%" data={skillMap} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" cornerRadius={18} fill="#98a994" />
                <Tooltip />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <ChartTitle title="Privacy & data controls" />
          <div className="grid gap-3">
            {["Private notes are only visible to you", "HR receives aggregate anonymous wellbeing data", "Recommendations use check-ins, progress, and attendance", "Community participation is opt-in"].map((item) => (
              <p key={item} className="flex gap-3 rounded-4xl bg-white/70 p-4 text-sm text-stone"><Shield className="shrink-0 text-sage" size={18} />{item}</p>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

function EmployeeEventsPage({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const token = auth.token || "";
  const [events, setEvents] = useState<WellnessEvent[]>([]);
  const [bookings, setBookings] = useState<WellnessBooking[]>([]);
  const [categories, setCategories] = useState<WellnessCategory[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const bookedEventIds = useMemo(
    () => new Set(bookings.filter((b) => !b.cancelled).map((b) => b.event.id)),
    [bookings]
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [ev, bk, cats] = await Promise.all([
        fetchWellnessEvents(token, { upcoming: true, categoryId: categoryFilter || undefined }),
        fetchMyWellnessBookings(token),
        fetchWellnessCategories(token)
      ]);
      setEvents(ev.events);
      setBookings(bk.bookings);
      setCategories(cats.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
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

  return (
    <AppLayout auth={auth} title="Upcoming Events" subtitle="Book or join your next Dharma Space session.">
      {toast && <div className="cwp-toast">{toast}</div>}
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <>
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
            {events.length === 0 && <p className="text-sm text-stone">No upcoming events — check back soon.</p>}
          </div>
        </>
      )}
    </AppLayout>
  );
}

function EmployeeBookingsPage({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const token = auth.token || "";
  const [bookings, setBookings] = useState<WellnessBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const bk = await fetchMyWellnessBookings(token);
      setBookings(bk.bookings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
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

  const active = bookings.filter((b) => !b.cancelled);

  return (
    <AppLayout auth={auth} title="My Bookings" subtitle="Your confirmed online, meeting room, and Dharma Space bookings.">
      {toast && <div className="cwp-toast">{toast}</div>}
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div className="grid gap-3">
          {active.length === 0 && <p className="text-sm text-stone">No bookings yet — join an event to get started.</p>}
          {active.map((booking) => {
            const past = new Date(booking.event.dateTime) < new Date();
            return (
              <Card key={booking.id} className="flex flex-wrap items-center justify-between gap-3">
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
                        <><CheckCircle2 size={14} strokeWidth={1.75} className="text-[var(--cwp-success)]" /> Attended</>
                      ) : (
                        <><XCircle size={14} strokeWidth={1.75} className="text-[var(--cwp-error)]" /> Missed</>
                      )}
                    </p>
                  )}
                </div>
                {!past && (
                  <button type="button" className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white" onClick={() => handleCancel(booking.id)}>
                    Cancel booking
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}

function EmployeeStatisticsPage({ auth }: { auth: ReturnType<typeof useAuth> }) {
  return (
    <AppLayout auth={auth} title="My Statistics" subtitle="Your personal wellness activity points and attendance progress.">
      <StatsGrid />
      <JourneyProgress />
    </AppLayout>
  );
}

function BuddyChallengePage({ auth }: { auth: ReturnType<typeof useAuth> }) {
  return (
    <AppLayout auth={auth} title="Challenge a Buddy" subtitle="Challenge a colleague to a quick exercise, verified by 3 witnesses, and earn points.">
      <BuddyChallenge />
    </AppLayout>
  );
}

function trainerAttendanceSummary() {
  const totalBooked = trainerClasses.reduce((sum, c) => sum + c.booked, 0);
  const totalAttended = trainerClasses.reduce((sum, c) => sum + c.attended, 0);
  const avgRate = totalBooked ? Math.round((totalAttended / totalBooked) * 100) : 0;
  const uniqueEmployees = new Set(trainerClasses.flatMap((c) => c.attendees)).size;
  return { totalBooked, totalAttended, avgRate, uniqueEmployees };
}

function TrainerEventDashboard({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const { totalAttended, avgRate, uniqueEmployees } = trainerAttendanceSummary();
  const next = trainerClasses[0];
  return (
    <AppLayout auth={auth} title="Coach Dashboard" subtitle="Your classes at a glance — schedule, capacity and how your employees are attending.">
      <div className="grid gap-5 md:grid-cols-4">
        <MetricCard icon={CalendarDays} label="My classes" value={trainerClasses.length} detail="Scheduled" />
        <MetricCard icon={Users} label="Employees reached" value={uniqueEmployees} detail="Unique attendees" />
        <MetricCard icon={CheckCircle2} label="Total attendances" value={totalAttended} detail="Across all classes" />
        <MetricCard icon={Activity} label="Avg attendance" value={`${avgRate}%`} detail="Show-up rate" />
      </div>
      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ChartTitle title="Next class" />
          <Link to="/trainer/events" className="text-sm font-semibold text-navy hover:underline">View all classes</Link>
        </div>
        {next && (
          <div className="rounded-4xl bg-white/70 p-4">
            <p className="font-semibold text-navy">{next.name}</p>
            <p className="mt-1 text-sm text-stone">{next.date} · {next.time} · {next.location}</p>
            <p className="mt-1 text-sm text-stone">{next.booked}/{next.capacity} signed up</p>
          </div>
        )}
      </Card>
      <div className="mt-6"><TrainerAttendanceStats compact /></div>
    </AppLayout>
  );
}

function TrainerWorkspacePage({ auth, section }: { auth: ReturnType<typeof useAuth>; section: string }) {
  if (section === "events") return <AppLayout auth={auth} title="My Classes" subtitle="Your scheduled sessions with date, location and capacity."><TrainerClassList /></AppLayout>;
  if (section === "create-event") return <AppLayout auth={auth} title="Create Class" subtitle="Schedule a new session with title, date, location and capacity."><CreateEventCard /></AppLayout>;
  if (section === "attendance") return <AppLayout auth={auth} title="Attendance" subtitle="Attendance statistics for the employees in your classes."><TrainerAttendanceStats /></AppLayout>;
  return <AppLayout auth={auth} title="Profile" subtitle="Your coach profile and teaching summary."><TrainerProfileCard auth={auth} /></AppLayout>;
}

function CreateEventCard() {
  return (
    <Card>
      <ChartTitle title="Create a class" />
      <div className="grid gap-3">
        {["Class title", "Date and time", "Location or Zoom link", "Capacity (pax)"].map((placeholder) => (
          <input key={placeholder} placeholder={placeholder} className="rounded-full border border-sand bg-white/70 px-5 py-3 outline-none focus:border-navy" />
        ))}
        <button className="rounded-full bg-navy px-5 py-3 font-semibold text-white">Create class placeholder</button>
      </div>
    </Card>
  );
}

function TrainerClassList() {
  return (
    <Card>
      <ChartTitle title="My classes" />
      <div className="grid gap-3">
        {trainerClasses.map((cls) => (
          <div key={cls.id} className="rounded-4xl bg-white/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-navy">{cls.name}</p>
                <p className="mt-1 text-sm text-stone">{cls.date} · {cls.time} · {cls.location}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-navy">{cls.booked}/{cls.capacity} signed up</p>
                <p className="mt-1 text-xs text-stone">{cls.capacity - cls.booked} spots left</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TrainerAttendanceStats({ compact = false }: { compact?: boolean }) {
  const { totalAttended, avgRate, uniqueEmployees } = trainerAttendanceSummary();
  return (
    <section className="grid gap-6">
      {!compact && (
        <div className="grid gap-5 md:grid-cols-3">
          <MetricCard icon={Users} label="Employees reached" value={uniqueEmployees} detail="Unique attendees" />
          <MetricCard icon={CheckCircle2} label="Total attendances" value={totalAttended} detail="Across your classes" />
          <MetricCard icon={Activity} label="Avg attendance" value={`${avgRate}%`} detail="Show-up rate" />
        </div>
      )}
      <Card>
        <ChartTitle title="Attendance by class" />
        <div className="grid gap-3">
          {trainerClasses.map((cls) => {
            const rate = cls.booked ? Math.round((cls.attended / cls.booked) * 100) : 0;
            return (
              <div key={cls.id} className="rounded-4xl bg-white/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy">{cls.name}</p>
                    <p className="mt-1 text-sm text-stone">{cls.date} · {cls.time}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-navy">{cls.attended}/{cls.booked} attended</p>
                    <p className="mt-1 text-xs text-stone">{rate}% show-up rate</p>
                  </div>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-sand/60">
                  <div className="h-full rounded-full bg-[var(--cwp-olive)]" style={{ width: `${rate}%` }} />
                </div>
                {!compact && (
                  <p className="mt-3 text-sm text-stone">Attendees: {cls.attendees.join(", ")}</p>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}

function TrainerProfileCard({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const { totalAttended, avgRate, uniqueEmployees } = trainerAttendanceSummary();
  return (
    <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
      <Card>
        <div className="grid place-items-center text-center">
          <ProfileAvatar
            name={auth.user?.name || "Coach"}
            avatar={auth.user?.avatar}
            size="lg"
            editable
            token={auth.token}
            onAvatarChange={(avatarUrl) => auth.updateUser({ avatar: avatarUrl })}
          />
          <h2 className="mt-4 text-3xl font-light text-navy">{auth.user?.name}</h2>
          <p className="mt-1 text-stone">{auth.user?.email}</p>
          <span className="mt-4 rounded-full bg-sage/20 px-4 py-2 text-sm font-medium text-navy">Trainer · Coach</span>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <StatPill label="Classes" value={trainerClasses.length} />
          <StatPill label="Avg attendance" value={`${avgRate}%`} />
          <StatPill label="Employees reached" value={uniqueEmployees} />
          <StatPill label="Total attendances" value={totalAttended} />
        </div>
      </Card>
      <Card>
        <ChartTitle title="Teaching summary" />
        <p className="text-sm text-stone">Your classes and how employees are attending them. Detailed attendance per class is on the <Link to="/trainer/attendance" className="font-semibold text-navy hover:underline">Attendance</Link> page.</p>
        <div className="mt-4 grid gap-3">
          {trainerClasses.map((cls) => (
            <div key={cls.id} className="flex items-center justify-between rounded-4xl bg-white/70 p-4">
              <p className="font-medium text-navy">{cls.name}</p>
              <p className="text-sm text-stone">{cls.attended}/{cls.booked}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SuperAdminWorkspacePage({ auth, section }: { auth: ReturnType<typeof useAuth>; section: string }) {
  const title = pathTitle(section);
  return (
    <AppLayout auth={auth} title={title} subtitle="Platform-wide setup for corporates, departments, events, coaches, CWP plans and users.">
      <div className="grid gap-6 xl:grid-cols-2">
        <SuperAdminActions />
        {section === "events" ? <EventList admin /> : <CorporateListCard />}
      </div>
    </AppLayout>
  );
}

function SuperAdminActions() {
  return (
    <Card>
      <ChartTitle title="Quick add" />
      <div className="grid gap-3">
        {["Add corporate", "Add department", "Add event", "Add coach", "Add corporate admin", "Add employee"].map((action) => (
          <button key={action} className="rounded-full bg-white/70 px-5 py-3 text-left font-semibold text-navy hover:bg-white">{action}</button>
        ))}
      </div>
    </Card>
  );
}

function CorporateListCard() {
  return (
    <Card>
      <ChartTitle title="Corporates and CWP plans" />
      <div className="grid gap-3">
        {["Asteria Group · Wellness Pro", "Northstar Health · Wellness Advanced", "Meridian Finance · Wellness Pro", "Solace Hotels · Wellness Lite"].map((corp) => (
          <div key={corp} className="rounded-4xl bg-white/70 p-4">
            <p className="font-semibold text-navy">{corp}</p>
            <p className="mt-1 text-sm text-stone">Separate page with events, attendance, departments and edit controls.</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function GenericRolePage({ auth, title, subtitle }: { auth: ReturnType<typeof useAuth>; title: string; subtitle: string }) {
  return (
    <AppLayout auth={auth} title={title} subtitle={subtitle}>
      <div className="grid gap-5 md:grid-cols-3">
        <MetricCard icon={Sparkles} label="AI Placeholder" value="Ready" detail="Mock logic connected" />
        <MetricCard icon={Shield} label="Privacy" value="Role-safe" detail="RBAC protected" />
        <MetricCard icon={Activity} label="Status" value="Demo" detail="Seed data available" />
      </div>
      <Card className="mt-5">
        <p className="text-stone">This page is implemented as a meaningful MVP surface for the selected role. It uses the shared design system, protected routing, and seeded platform data patterns.</p>
      </Card>
      <QuickRegisterPanel />
    </AppLayout>
  );
}

function Pricing() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <h1 className="text-5xl font-light text-navy">Enterprise pricing</h1>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {["Pilot", "Scale", "Enterprise"].map((plan, index) => <Card key={plan}><p className="text-2xl font-light text-navy">{plan}</p><p className="mt-3 text-stone">{index === 0 ? "Launch with one cohort." : index === 1 ? "Scale across departments." : "Full workforce transformation."}</p><p className="mt-6 text-4xl font-semibold text-navy">{index === 0 ? "$4k" : index === 1 ? "$12k" : "$24k"}<span className="text-sm font-normal text-stone"> / yr</span></p></Card>)}
      </div>
    </div>
  );
}

export default function PlatformApp() {
  const auth = useAuth();
  const employee = ["EMPLOYEE"] as Role[];
  const hr = ["HR_ADMIN", "CORPORATE_ADMIN", "SUPER_ADMIN"] as Role[];
  const trainer = ["TRAINER", "SUPER_ADMIN"] as Role[];

  return (
    <ChallengeProvider token={auth.token} userId={auth.user?.id ?? null} userName={auth.user?.name ?? null}>
    <Shell auth={auth}>
      <Routes>
        <Route path="/login" element={<Login auth={auth} />} />
        <Route path="/register" element={<Register auth={auth} />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/course/:id" element={<CourseDetail auth={auth} />} />
        <Route path="/app/dashboard" element={<Protected auth={auth} roles={employee}><EmployeeDashboard auth={auth} /></Protected>} />
        <Route path="/app/events" element={<Protected auth={auth} roles={employee}><EmployeeEventsPage auth={auth} /></Protected>} />
        <Route path="/app/bookings" element={<Protected auth={auth} roles={employee}><EmployeeBookingsPage auth={auth} /></Protected>} />
        <Route path="/app/statistics" element={<Protected auth={auth} roles={employee}><EmployeeStatisticsPage auth={auth} /></Protected>} />
        <Route path="/app/buddy-challenge" element={<Protected auth={auth} roles={employee}><BuddyChallengePage auth={auth} /></Protected>} />
        <Route path="/app/certificates" element={<Protected auth={auth} roles={employee}><CertificatesPage auth={auth} /></Protected>} />
        <Route path="/app/profile" element={<Protected auth={auth} roles={employee}><EmployeeProfilePage auth={auth} /></Protected>} />
        <Route path="/app/courses" element={<Navigate to="/app/events" replace />} />
        <Route path="/app/progress" element={<Navigate to="/app/statistics" replace />} />
        <Route path="/app/calendar" element={<Navigate to="/app/events" replace />} />
        <Route path="/app/community" element={<Navigate to="/app/profile" replace />} />
        <Route path="/app/wellbeing-checkin" element={<Navigate to="/app/statistics" replace />} />
        <Route path="/hr/dashboard" element={<Protected auth={auth} roles={hr}><HRDashboard auth={auth} /></Protected>} />
        {["employees", "events", "bookings", "booking-history", "statistics", "profile"].map((path) => <Route key={path} path={`/hr/${path}`} element={<Protected auth={auth} roles={hr}><HRWorkspacePage auth={auth} section={path} /></Protected>} />)}
        <Route path="/trainer/dashboard" element={<Protected auth={auth} roles={trainer}><TrainerEventDashboard auth={auth} /></Protected>} />
        {["events", "create-event", "attendance", "profile"].map((path) => <Route key={path} path={`/trainer/${path}`} element={<Protected auth={auth} roles={trainer}><TrainerWorkspacePage auth={auth} section={path} /></Protected>} />)}
        <Route path="/trainer/attendees" element={<Navigate to="/trainer/attendance" replace />} />
        <Route path="/hr/company" element={<Protected auth={auth} roles={hr}><HRWorkspacePage auth={auth} section="company" /></Protected>} />
        {/* Corporate Admin is merged into the HR workspace — redirect legacy /company/* routes. */}
        <Route path="/company/dashboard" element={<Navigate to="/hr/dashboard" replace />} />
        <Route path="/company/bookings" element={<Navigate to="/hr/company" replace />} />
        {["events", "booking-history", "statistics", "profile"].map((path) => <Route key={path} path={`/company/${path}`} element={<Navigate to={`/hr/${path}`} replace />} />)}
        <Route path="*" element={<Navigate to={auth.user ? (auth.user.homePath || "/app/dashboard") : "/"} replace />} />
      </Routes>
    </Shell>
    </ChallengeProvider>
  );
}

function pathTitle(path: string) {
  return path.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
