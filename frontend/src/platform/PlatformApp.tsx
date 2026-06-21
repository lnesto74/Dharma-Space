import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
  Search,
  Settings,
  Shield,
  Sparkles,
  Trophy,
  User,
  Users,
  Wind
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

const demoAccounts = [
  ["Employee", "employee@demo.com"],
  ["HR Admin", "hr@demo.com"],
  ["Trainer", "trainer@demo.com"],
  ["Corporate Admin", "company@demo.com"],
  ["Super Admin", "admin@demo.com"]
];

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
    tone: "from-[#ead8cf] to-[#fff7db]"
  },
  {
    min: 21,
    max: 40,
    emoji: "🐼",
    title: "Calm Panda",
    status: "Soft, friendly, and trying their best.",
    traits: ["Comes when stress becomes critical", "Has a favorite yoga teacher", "Pretends stretching solved all life problems"],
    tone: "from-[#d6e8d0] to-[#f6f3f0]"
  },
  {
    min: 41,
    max: 60,
    emoji: "🦦",
    title: "Balanced Otter",
    status: "Your nervous system is officially loading stability.",
    traits: ["Regular class attendee", "Talks about magnesium and sleep quality", "Might recommend breathwork to coworkers"],
    tone: "from-[#d2e4fb] to-[#d6e8d0]"
  },
  {
    min: 61,
    max: 75,
    emoji: "🐺",
    title: "Mindful Wolf",
    status: "Disciplined. Focused. Slightly intimidating in plank holds.",
    traits: ["Protects calendar time for wellness", "Understands mobility vs flexibility", "Drinks water voluntarily"],
    tone: "from-[#1a2b3c] to-[#536350]"
  },
  {
    min: 76,
    max: 90,
    emoji: "🦅",
    image: "/elevated-eagle-final.png",
    title: "Elevated Eagle",
    status: "Peak clarity. Peak posture. Peak calendar discipline.",
    traits: ["Never misses wellness week", "Has favorite meditation track", "Colleagues ask them for stress advice"],
    tone: "from-[#ffdea5] to-[#d2e4fb]"
  },
  {
    min: 91,
    max: 100,
    emoji: "🐉",
    title: "Corporate Dragon",
    status: "Legendary wellness creature. Possibly enlightened.",
    traits: ["Attends everything", "Breathes through deadlines", "Survives Monday meetings without emotional damage"],
    tone: "from-[#041627] to-[#ff8b00]"
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
        parsed.homePath = "/admin";
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const login = (nextToken: string, nextUser: UserType) => {
    const userWithHome = nextUser.role === "SUPER_ADMIN"
      ? { ...nextUser, homePath: "/admin" }
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

  return { token, user, login, logout };
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
                <button className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white" onClick={auth.logout}>
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

function navForRole(role?: Role) {
  const base = {
    EMPLOYEE: [
      ["Dashboard", "/app/dashboard", Home],
      ["Upcoming Events", "/app/events", CalendarDays],
      ["My Bookings", "/app/bookings", BookOpen],
      ["My Statistics", "/app/statistics", Gauge],
      ["Certificates", "/app/certificates", Award],
      ["Profile", "/app/profile", User]
    ],
    HR_ADMIN: [
      ["Dashboard", "/hr/dashboard", BarChart3],
      ["Employees", "/hr/employees", Users],
      ["Upcoming Events", "/hr/events", CalendarDays],
      ["My Booking", "/hr/bookings", BookOpen],
      ["Booking History", "/hr/booking-history", Shield],
      ["Statistics", "/hr/statistics", Activity],
      ["Profile", "/hr/profile", User]
    ],
    TRAINER: [
      ["Dashboard", "/trainer/dashboard", Gauge],
      ["My Events", "/trainer/events", CalendarDays],
      ["Create Event", "/trainer/create-event", GraduationCap],
      ["Attendees", "/trainer/attendees", Users],
      ["Profile", "/trainer/profile", User]
    ],
    CORPORATE_ADMIN: [
      ["Dashboard", "/company/dashboard", Building2],
      ["Upcoming Events", "/company/events", CalendarDays],
      ["My Booking", "/company/bookings", BookOpen],
      ["Booking History", "/company/booking-history", Shield],
      ["Statistics", "/company/statistics", Activity],
      ["Profile", "/company/profile", User]
    ],
    SUPER_ADMIN: [
      ["Overview", "/admin", Shield],
      ["Inquiries", "/admin/inquiries", Mail],
      ["Trainers", "/admin/site/trainers", GraduationCap],
      ["Regular Class Schedule", "/admin/site/classes", CalendarDays],
      ["Education & Events", "/admin/site/programs", BookOpen],
      ["Users", "/admin/users", Users],
      ["Settings", "/admin/settings", Settings]
    ]
  };
  return (role ? base[role] : base.EMPLOYEE).map(([label, to, icon]) => ({ label: label as string, to: to as string, icon: icon as any }));
}

function Protected({ auth, roles, children }: { auth: ReturnType<typeof useAuth>; roles?: Role[]; children: ReactNode }) {
  if (!auth.user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(auth.user.role)) return <Navigate to={auth.user.homePath || "/admin"} replace />;
  return <>{children}</>;
}

function AppLayout({ auth, children, title, subtitle }: { auth: ReturnType<typeof useAuth>; children: ReactNode; title: string; subtitle: string }) {
  return (
    <StitchPage railLabel={auth.user?.name || "Dharma Space"} role={auth.user?.role || "EMPLOYEE"}>
      <section className="mx-auto max-w-[1280px]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 rounded-[2rem] bg-[#041627] p-7 text-white shadow-[0_40px_60px_-15px_rgba(4,22,39,0.18)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">Dharma Space</p>
          <h1 className="mt-3 text-3xl font-light tracking-tight md:text-5xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-white/72">{subtitle}</p>
        </motion.div>
        {children}
      </section>
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

const attendanceHistory = [
  { event: "Morning Coherence Breathwork", coach: "Talia Trainer", date: "May 10, 09:30", attended: "Maya, Ava, Theo, Priya" },
  { event: "Desk Yoga Reset", coach: "Amara Wells", date: "May 11, 12:00", attended: "Maya, Noah, Lina, Iris" },
  { event: "Leadership Wellness Talk", coach: "Jonas Reed", date: "May 12, 15:00", attended: "Harper, Priya, Rowan" }
];

function MSIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

function StitchLeftRail({ userLabel = "Executive User", role = "EMPLOYEE" }: { userLabel?: string; role?: Role }) {
  const location = useLocation();
  const items = navForRole(role).filter((item) => {
    if (role === "EMPLOYEE") return true;
    if (role === "HR_ADMIN") return ["Dashboard", "Employees", "Upcoming Events", "My Booking", "Booking History", "Statistics", "Profile"].includes(item.label);
    return true;
  });
  return (
    <aside className="hidden md:flex fixed left-0 top-0 z-40 h-screen w-64 flex-col gap-6 border-r border-white/15 bg-[#f5f3f3]/90 py-8 shadow-2xl backdrop-blur-xl">
      <Link to="/" className="mb-8 block px-6">
        <h1 className="text-[32px] font-light tracking-[-0.03em] text-[#041627]">Dharma</h1>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#44474c]/60">The AI Era OS</p>
      </Link>
      <nav className="flex-1 space-y-2">
        {items.map((item) => (
          <Link key={item.to} to={item.to} className={`flex cursor-pointer items-center py-2 transition-colors ${location.pathname === item.to ? "border-l-4 border-[#1f1300] pl-4 font-medium text-[#041627]" : "pl-5 text-[#44474c]/60 hover:bg-[#e3e2e2]/30"}`}>
            <MSIcon name={stitchIconMap[item.label] || "circle"} className="mr-3" />
            <span className="text-[20px] font-medium leading-[1.4] tracking-[0.01em]">{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="mt-auto border-t border-white/10 px-6 pt-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[#1a2b3c] text-sm font-bold text-white">
            <img src={LOGO_URL} alt="Dharma Space" className="h-full w-full object-contain bg-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#1b1c1c]">Dharma Space</p>
            <p className="text-xs text-[#44474c]/60">{userLabel}</p>
          </div>
        </Link>
        <Link to={role === "EMPLOYEE" ? "/app/profile" : role === "HR_ADMIN" ? "/hr/profile" : role === "TRAINER" ? "/trainer/profile" : role === "CORPORATE_ADMIN" ? "/company/profile" : "/admin/settings"} className="mt-6 flex cursor-pointer items-center rounded-2xl px-2 py-2 text-[#44474c]/60 hover:bg-[#e3e2e2]/30">
          <MSIcon name="settings" className="mr-3" />
          <span className="text-[20px] font-medium">Settings</span>
        </Link>
      </div>
    </aside>
  );
}

function StitchPage({ children, railLabel, role = "EMPLOYEE" }: { children: ReactNode; railLabel?: string; role?: Role }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const items = navForRole(role).filter((item) => {
    if (role === "EMPLOYEE") return true;
    if (role === "HR_ADMIN") return ["Dashboard", "Employees", "Upcoming Events", "My Booking", "Booking History", "Statistics", "Profile"].includes(item.label);
    return true;
  });

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="stitch-shell min-h-screen text-[#1b1c1c]">
      <StitchLeftRail userLabel={railLabel} role={role} />
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#faf9f9]/85 px-5 py-4 shadow-[0_40px_60px_-15px_rgba(4,22,39,0.08)] backdrop-blur-md md:hidden">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-white shadow-sm">
              <img src={LOGO_URL} alt="Dharma Space" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#44474c]/70">Dharma</p>
              <p className="font-semibold text-[#041627]">Space</p>
            </div>
          </Link>
          <button className="grid h-12 w-12 place-items-center rounded-full bg-white/70 shadow-sm" onClick={() => setMobileOpen((value) => !value)} aria-label="Open menu">
            <MSIcon name={mobileOpen ? "close" : "menu"} className="text-[#041627]" />
          </button>
        </div>
        {mobileOpen && (
          <nav className="mt-4 grid gap-2 rounded-[2rem] bg-white/70 p-3 backdrop-blur-xl">
            {items.map((item) => (
              <Link key={item.to} to={item.to} className={`flex items-center gap-3 rounded-full px-4 py-3 text-sm font-semibold ${location.pathname === item.to ? "bg-[#041627] text-white" : "text-[#041627]"}`}>
                <MSIcon name={stitchIconMap[item.label] || "circle"} />
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main className="min-h-screen px-5 py-8 md:ml-64 md:px-16">{children}</main>
    </div>
  );
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
  const medals = ["G", "S", "B"];
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
              <div className={`grid h-10 w-10 place-items-center rounded-full text-sm font-bold ${index === 0 ? "bg-[#d4af37] text-white" : index === 1 ? "bg-[#c4c6cd] text-[#041627]" : index === 2 ? "bg-[#b87333] text-white" : "bg-[#041627] text-white"}`}>
                {medals[index] || index + 1}
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
          <div key={event.id} className={`rounded-4xl p-4 transition-colors ${joined ? "bg-[#d6e8d0]/80 ring-1 ring-[#536350]/30" : "bg-white/70"}`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-navy">{event.name} {joined && <span className="ml-2 rounded-full bg-[#041627] px-3 py-1 text-xs text-white">Booked</span>}</p>
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

function StatsGrid({ corporate = false }: { corporate?: boolean }) {
  const data = corporate
    ? [
      { label: "Wellness improvement", value: "+18%" },
      { label: "Estimated ROI", value: "$1.8M" },
      { label: "Attendance rate", value: "86%" },
      { label: "Active employees", value: "214" },
      ...employeeStats.slice(2)
    ]
    : employeeStats;
  return (
    <div className="rounded-[2rem] bg-[#ead8cf] p-5 shadow-[0_24px_70px_rgba(4,22,39,.06)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#44474c]/60">{corporate ? "Company overview" : "Personal snapshot"}</p>
          <h2 className="mt-1 text-2xl font-semibold text-[#041627]">{corporate ? "Statistics & ROI" : "My statistics"}</h2>
        </div>
        <MSIcon name="monitoring" className="text-3xl text-[#041627]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.map((item, index) => (
          <div key={item.label} className={`rounded-[1.5rem] p-4 ${index % 4 === 0 ? "bg-[#bfcfe8]" : index % 4 === 1 ? "bg-[#f5df83]" : index % 4 === 2 ? "bg-[#c8e0d8]" : "bg-[#f3e7dc]"}`}>
            <p className="text-sm font-semibold leading-5 text-[#041627]">{item.label}</p>
            <p className="mt-4 text-3xl font-light text-[#041627]">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
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
    <div className={`overflow-hidden rounded-[2rem] bg-gradient-to-br ${archetype.tone} p-5 shadow-[0_24px_70px_rgba(4,22,39,.08)]`}>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-center">
        <div className="grid place-items-center rounded-[1.75rem] bg-white/70 p-4 shadow-inner">
          {"image" in archetype ? (
            <img src={archetype.image} alt={archetype.title} className="h-44 w-44 object-contain" />
          ) : (
            <div className="text-6xl">{archetype.emoji}</div>
          )}
        </div>
        <div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#44474c]/70">Corporate Wellness Journey</p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-5xl font-light tracking-[-0.05em] text-[#041627]">{archetype.title}</h2>
              <div className="rounded-full bg-white/75 px-5 py-3 shadow-sm">
                <span className="text-2xl font-semibold text-[#041627]">{attendance}%</span>
                <span className="ml-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#44474c]">attendance</span>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-lg leading-7 text-[#1b1c1c]/75">{archetype.status}</p>
          </div>
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-[0.18em] text-[#44474c]/70">
              <span>0%</span>
              <span>Journey progress</span>
              <span>100%</span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-white/55">
              <div className="h-full rounded-full bg-[#041627]" style={{ width: `${attendance}%` }} />
            </div>
          </div>
          <div className="mt-5 rounded-[1.5rem] bg-white/55 p-5">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#44474c]/70">Traits</p>
            <div className="flex flex-wrap gap-2">
              {archetype.traits.map((trait) => (
                <p key={trait} className="rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-[#041627]">{trait}</p>
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
  const [email, setEmail] = useState("employee@demo.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await api<{ token: string; user: UserType }>("/api/auth/login", undefined, {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      auth.login(result.token, result.user);
      navigate(result.user.homePath);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-82px)] max-w-6xl gap-8 px-5 py-12 lg:grid-cols-[1fr_.9fr] lg:items-center">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-stone">Demo access</p>
        <h1 className="mt-4 text-5xl font-light text-navy">Enter Dharma Space.</h1>
        <p className="mt-4 text-stone">Use any demo account. Password for all roles is <span className="font-semibold text-navy">password123</span>.</p>
        <div className="mt-6 grid gap-3">
          {demoAccounts.map(([label, account]) => (
            <button key={account} onClick={() => setEmail(account)} className="flex items-center justify-between rounded-full glass px-5 py-3 text-left text-sm">
              <span className="font-medium text-navy">{label}</span><span className="text-stone">{account}</span>
            </button>
          ))}
        </div>
      </div>
      <Card>
        <form onSubmit={submit} className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-navy">Email<input value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-full border border-sand bg-white/70 px-5 py-3 outline-none focus:border-navy" /></label>
          <label className="grid gap-2 text-sm font-medium text-navy">Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-full border border-sand bg-white/70 px-5 py-3 outline-none focus:border-navy" /></label>
          {error && <p className="rounded-3xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="rounded-full bg-navy px-5 py-3 font-medium text-white disabled:opacity-60">{loading ? "Signing in..." : "Login"}</button>
          <Link to="/register" className="text-center text-sm font-medium text-navy">Create a new employee account</Link>
        </form>
      </Card>
    </div>
  );
}

function Register({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await api<{ token: string; user: UserType }>("/api/auth/register", undefined, { method: "POST", body: JSON.stringify(form) });
      auth.login(result.token, result.user);
      navigate(result.user.homePath);
    } catch (err: any) {
      setError(err.message);
    }
  }
  return (
    <div className="mx-auto max-w-xl px-5 py-16">
      <Card>
        <h1 className="text-3xl font-light text-navy">Create your account</h1>
        <form onSubmit={submit} className="mt-6 grid gap-4">
          {(["name", "email", "password"] as const).map((field) => (
            <input key={field} type={field === "password" ? "password" : "text"} placeholder={field} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} className="rounded-full border border-sand bg-white/70 px-5 py-3 outline-none" />
          ))}
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className="rounded-full bg-navy px-5 py-3 font-medium text-white">Register</button>
          <SocialLoginButtons />
        </form>
      </Card>
    </div>
  );
}

function SocialLoginButtons() {
  return (
    <div className="mt-2 grid gap-3 border-t border-sand/70 pt-4">
      <p className="text-center text-xs uppercase tracking-[0.2em] text-stone">Or continue with</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {["Google", "Facebook", "Instagram"].map((provider) => (
          <button key={provider} type="button" className="rounded-full bg-white/70 px-4 py-3 text-sm font-medium text-navy hover:bg-white">
            {provider}
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-stone">Social login is a frontend placeholder for future OAuth setup.</p>
    </div>
  );
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
  const { data, loading, error } = useApi<any>("/api/employee/dashboard", auth.token);
  const [joinedEventIds, setJoinedEventIds] = useState<string[]>([]);
  const [eventMessage, setEventMessage] = useState("");
  if (loading) return <AppLayout auth={auth} title="Employee Dashboard" subtitle="Your calm operating rhythm for learning, recovery, and human skills progress."><Loading /></AppLayout>;
  if (error) return <AppLayout auth={auth} title="Employee Dashboard" subtitle="Your calm operating rhythm."><ErrorState message={error} /></AppLayout>;
  const kpis = data.kpis;
  const joinedBookings = demoEvents
    .filter((event) => joinedEventIds.includes(event.id))
    .map((event) => ({
      id: `joined-${event.id}`,
      name: event.name,
      date: event.date,
      time: event.time,
      coach: event.coach,
      location: event.location === "Online" ? "Zoom" : event.location,
      detail: event.detail
    }));
  const toggleJoin = (event: typeof demoEvents[number]) => {
    const joined = joinedEventIds.includes(event.id);
    setJoinedEventIds((ids) => joined ? ids.filter((id) => id !== event.id) : [event.id, ...ids]);
    setEventMessage(joined ? `Booking cancelled for ${event.name}. Your spot has been released.` : `You joined ${event.name}. It was added to My Bookings.`);
    window.setTimeout(() => setEventMessage(""), 3500);
  };
  return (
    <StitchPage railLabel={auth.user?.name || "Executive User"}>
      <div className="mx-auto max-w-[1280px] rounded-[2.5rem] bg-[#ead8cf]/55 p-5 md:p-8">
        <header className="mb-10 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-4">
            <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[#d2e4fb] ring-2 ring-white">
              <img src={LOGO_URL} alt="Dharma Space" className="h-full w-full object-contain bg-white" />
            </div>
            <span className="text-[28px] font-light tracking-[-0.03em] text-[#041627]">Dharma Space</span>
          </Link>
          <MSIcon name="analytics" className="text-[#041627]" />
        </header>
        <section className="mb-8 rounded-[2rem] bg-[#ead8cf] p-8">
          <h1 className="mb-2 max-w-2xl text-[44px] font-light leading-[1.05] tracking-[-0.04em] text-[#041627]">Hello, {auth.user?.name.split(" ")[0] || "Maya"}. How do you feel about today?</h1>
          <p className="max-w-2xl text-base leading-7 text-[#44474c]">Track mood, book sessions, and keep your wellness momentum visible.</p>
        </section>
        <div className="mb-8">
          <WellnessArchetypeCard attendance={82} />
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[.55fr_1.45fr]">
          <div className="flex items-center justify-between rounded-[2rem] bg-[#041627] p-8 text-white shadow-xl">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.22em] opacity-70">Streak</p>
                <h4 className="text-[48px] font-light leading-none">{kpis.streakDays || 14}</h4>
                <p className="mt-1 text-base">Days of Mastery</p>
              </div>
              <MSIcon name="auto_stories" className="text-5xl opacity-40" />
          </div>
          <div className="glass-panel flex flex-col items-center gap-8 rounded-[2rem] bg-[#f5f3f3]/40 p-8 md:flex-row">
            <div className="relative aspect-video w-full overflow-hidden rounded-[2rem] md:w-1/3">
              <img alt="Breathing session" className="h-full w-full object-cover" src="https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80" />
              <div className="absolute inset-0 grid place-items-center bg-[#041627]/20">
                <button className="grid h-12 w-12 place-items-center rounded-full bg-white text-[#041627] shadow-lg"><MSIcon name="play_arrow" /></button>
              </div>
            </div>
            <div className="flex-grow">
              <div className="mb-2 flex items-center gap-3"><MSIcon name="spa" className="text-[#536350]" /><span className="text-xs font-semibold uppercase tracking-[0.24em] text-[#536350]">Today's Routine</span></div>
              <h3 className="mb-2 text-[32px] font-normal tracking-[-0.01em] text-[#041627]">Somatic Recalibration</h3>
              <p className="max-w-xl text-base leading-[1.6] text-[#44474c]">A 5-minute guided breathing session designed to lower cortisol and heighten executive focus.</p>
            </div>
            <div className="flex flex-col items-center gap-2 md:items-end">
              <div className="flex items-center gap-2 text-[#ba1a1a]"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ba1a1a] opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#ba1a1a]" /></span><span className="text-xs font-semibold uppercase tracking-[0.18em]">Live in 15m</span></div>
              <button className="rounded-full bg-[#041627] px-8 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white">Join now</button>
            </div>
          </div>
        </div>
        <section className="mt-16">
          {eventMessage && <div className="mb-6 rounded-full bg-[#041627] px-6 py-4 text-sm font-semibold text-white shadow-xl">{eventMessage}</div>}
          <div className="mb-6">
            <WinnersBoard />
          </div>
          <div className="mb-6 grid gap-6 xl:grid-cols-2">
            <EventList joinedIds={joinedEventIds} onToggleJoin={toggleJoin} />
            <BookingList extraBookings={joinedBookings} onCancel={(eventId) => {
              const event = demoEvents.find((item) => item.id === eventId);
              if (event) toggleJoin(event);
            }} />
          </div>
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-[32px] font-normal text-[#041627]">Recommended for You</h2>
            <Link className="border-b border-[#44474c] pb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#44474c]" to="/courses">Explore all sessions</Link>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {data.recommended.slice(0, 2).map((course: Course) => (
              <Link key={course.id} to={`/course/${course.id}`} className="group">
                <div className="relative mb-4 aspect-video overflow-hidden rounded-[2rem]">
                  <img src={course.image} alt={course.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#041627]">{course.level}</span>
                </div>
                <h4 className="mb-1 text-[20px] font-medium text-[#041627]">{course.title}</h4>
                <p className="text-base leading-[1.6] text-[#44474c]">{course.description}</p>
              </Link>
            ))}
          </div>
          <div className="mt-6">
            <StatsGrid />
          </div>
        </section>
      </div>
    </StitchPage>
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
  const { data, loading, error } = useApi<any>("/api/hr/dashboard", auth.token);
  if (loading) return <AppLayout auth={auth} title="HR Analytics" subtitle="Aggregate workforce intelligence."><Loading /></AppLayout>;
  if (error) return <AppLayout auth={auth} title="HR Analytics" subtitle="Aggregate workforce intelligence."><ErrorState message={error} /></AppLayout>;
  const departments = data.departmentEngagement?.length ? data.departmentEngagement : [
    { name: "Engineering", completion: 94, active: 214 },
    { name: "Product/UX", completion: 89, active: 132 },
    { name: "Operations", completion: 78, active: 168 },
    { name: "Sales & GTM", completion: 62, active: 98 }
  ];
  const heatmapRows = [
    ["Engineering", ["bg-[#041627]/90", "bg-[#041627]/80", "bg-[#041627]/95", "bg-[#041627]/70", "bg-[#536350]/30", "bg-[#536350]/20", "bg-[#536350]/40", "bg-[#536350]/10", "bg-[#536350]/5", "bg-[#536350]/10"]],
    ["Sales & GTM", ["bg-[#536350]/40", "bg-[#536350]/50", "bg-[#ba1a1a]/30", "bg-[#ba1a1a]/50", "bg-[#ba1a1a]/60", "bg-[#ba1a1a]/50", "bg-[#ba1a1a]/40", "bg-[#ba1a1a]/20", "bg-[#536350]/30", "bg-[#536350]/20"]],
    ["Operations", ["bg-[#041627]/95", "bg-[#041627]/90", "bg-[#041627]/90", "bg-[#041627]/90", "bg-[#041627]/90", "bg-[#041627]/80", "bg-[#041627]/90", "bg-[#041627]/90", "bg-[#041627]/95", "bg-[#041627]/90"]],
    ["Product/UX", ["bg-[#041627]/80", "bg-[#041627]/90", "bg-[#536350]/40", "bg-[#536350]/30", "bg-[#536350]/20", "bg-[#041627]/80", "bg-[#041627]/90", "bg-[#536350]/50", "bg-[#536350]/20", "bg-[#041627]/70"]]
  ];
  return (
    <StitchPage railLabel="Executive HR" role="HR_ADMIN">
      <header className="mx-auto mb-12 flex w-full max-w-[1280px] items-center justify-between">
        <div>
          <h2 className="text-[28px] font-normal tracking-[-0.01em] text-[#041627] md:text-[32px]">Organization Resilience & Flow</h2>
          <div className="mt-1 flex items-center gap-2 text-[#44474c]/70">
            <MSIcon name="insights" className="text-sm" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">Mind-gamification analytics · live demo</span>
          </div>
        </div>
        <button className="hidden items-center gap-2 rounded-full border border-[#c4c6cd]/30 bg-[#faf9f9] px-6 py-3 text-sm font-bold text-[#041627] shadow-sm transition-all hover:bg-[#efeded] md:flex">
          <MSIcon name="file_download" /> Export Executive Summary
        </button>
      </header>
      <div className="mx-auto max-w-[1280px] space-y-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {[
            ["bolt", "Organizational Energy", "91.4", "Optimal"],
            ["groups", "Mindful Participation", `${data.kpis.wellbeingAdoption || 78}%`, "Target: 85%"],
            ["verified", "Flow State Mastery", data.kpis.activeLearners || 1412, "Active practitioners"],
            ["trending_up", "Wellbeing ROI", "$1.8M", "Reduced absenteeism"]
          ].map(([icon, label, value, detail]) => (
            <div key={label} className="glass-panel relative overflow-hidden rounded-[2rem] p-8">
              <MSIcon name={String(icon)} className="absolute right-4 top-4 text-6xl text-[#041627]/10" />
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#44474c]/60">{label}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-[48px] font-light leading-[1.1] tracking-[-0.02em] text-[#041627]">{value}</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-[#536350]">{detail}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="glass-panel rounded-[2rem] p-8 lg:col-span-2">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-[20px] font-medium text-[#041627]">Biometric Burnout Risk Heatmap</h3>
                <p className="mt-1 text-xs text-[#44474c]/60">Cross-departmental stress indicators vs. restorative practices</p>
              </div>
              <div className="flex gap-4 text-xs font-bold uppercase tracking-tight text-[#44474c]/60">
                <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full bg-[#041627]" />Coherent</span>
                <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full bg-[#536350]/40" />Neutral</span>
                <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full bg-[#ba1a1a]/40" />Risk</span>
              </div>
            </div>
            <div className="space-y-4">
              {heatmapRows.map(([department, cells]) => (
                <div key={String(department)} className="grid grid-cols-12 items-center gap-4">
                  <span className="col-span-3 text-xs font-bold uppercase tracking-tight text-[#44474c]/80 md:col-span-2">{department}</span>
                  <div className="col-span-9 grid h-10 grid-cols-10 gap-1 md:col-span-10">
                    {(cells as string[]).map((cell, index) => <div key={index} className={`${cell} cursor-pointer rounded hover:ring-2 hover:ring-[#041627]`} />)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 border-t border-[#44474c]/10 pt-8">
              <div className="flex items-start gap-4 rounded-[2rem] border border-white/5 bg-[#1a2b3c] p-6 text-[#8192a7]">
                <MSIcon name="auto_awesome" className="animate-pulse text-[#ffdea5]" />
                <div>
                  <p className="mb-1 font-bold text-white">Dharma Intelligence Recommendation</p>
                  <p className="text-sm leading-relaxed opacity-80">{data.aiRecommendation || "Sales is entering a red-zone fatigue pattern. Schedule Micro-Flow prompts and a Friday digital detox reset."}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="glass-panel flex flex-col overflow-hidden rounded-[2rem] p-8">
            <h3 className="text-[20px] font-medium text-[#041627]">Participation Momentum</h3>
            <p className="mt-1 text-xs text-[#44474c]/60">Real-time engagement velocity</p>
            <div className="space-y-8 py-8">
              {[["Morning Coherence", 85, "ACTIVE NOW"], ["Creative Flow Drills", 42, "42% PEAK"], ["Somatic Reset", 68, "SURGING"]].map(([label, value, status]) => (
                <div key={String(label)}>
                  <div className="mb-2 flex justify-between text-xs font-bold uppercase tracking-widest">
                    <span className="text-[#041627]">{label}</span><span className="text-[#536350]">{status}</span>
                  </div>
                  <div className="relative h-4 rounded-full bg-[#536350]/10">
                    <div className="h-full rounded-full bg-[#536350]" style={{ width: `${value}%` }} />
                    {Number(value) > 60 && <div className="absolute top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#536350]/20" style={{ left: `${value}%` }}><div className="momentum-dot h-3 w-3 rounded-full bg-[#536350]" /></div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-auto rounded-[2rem] border border-[#c4c6cd]/20 bg-[#efeded] p-4 text-xs font-medium text-[#44474c]">
              Participation is <span className="font-bold text-[#041627]">12% higher</span> than the same period last week.
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="glass-panel rounded-[2rem] p-8">
            <h3 className="mb-2 text-[20px] font-medium text-[#041627]">Ecosystem Vitality</h3>
            <p className="mb-8 text-xs text-[#44474c]/60">Longitudinal growth of organizational intelligence</p>
            <div className="chart-grid relative h-64">
              <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                <path d="M0 80 Q 20 60, 40 70 T 80 30 T 100 10" fill="none" stroke="#041627" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                <path d="M0 90 Q 20 85, 40 88 T 80 60 T 100 45" fill="none" stroke="#536350" strokeDasharray="6 3" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
          </div>
          <div className="glass-panel rounded-[2rem] p-8">
            <div className="mb-8 flex items-center justify-between">
              <h3 className="text-[20px] font-medium text-[#041627]">Department Mindset Leaderboard</h3>
              <MSIcon name="emoji_events" className="text-[#536350]" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead><tr className="border-b border-[#e3e2e2] text-[10px] font-bold uppercase tracking-widest text-[#44474c]/40"><th className="pb-4">Department</th><th className="pb-4">Flow Adoption</th><th className="pb-4">Vitality</th><th className="pb-4 text-right">Tier</th></tr></thead>
                <tbody className="divide-y divide-[#e3e2e2]/50">
                  {departments.slice(0, 4).map((department: any, index: number) => (
                    <tr key={department.name} className="hover:bg-[#041627]/5">
                      <td className="py-4 text-sm font-semibold text-[#041627]">{department.name}</td>
                      <td className="py-4 text-sm">{department.completion}%</td>
                      <td className="py-4 text-sm">{(8.9 - index * 0.7).toFixed(1)}</td>
                      <td className="py-4 text-right text-xs font-bold"><span className="rounded-full border border-[#536350]/20 bg-[#536350]/10 px-3 py-1 text-[#536350]">{index < 2 ? "MASTERY" : index === 2 ? "STEADY" : "ATTENTION"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </StitchPage>
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
    ]
  };
  const tableRows = rows[section] || rows.analytics;
  const columns = Object.keys(tableRows[0] || {});
  return (
    <StitchPage railLabel={auth.user?.name || "Executive HR"} role="HR_ADMIN">
      <div className="mx-auto max-w-[1280px] space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[28px] font-normal tracking-[-0.01em] text-[#041627] md:text-[32px]">{title}</h2>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#44474c]/70">Enterprise HR workspace · seeded demo data</p>
          </div>
          <Link to="/hr/dashboard" className="rounded-full border border-[#c4c6cd]/30 bg-[#faf9f9] px-5 py-3 text-sm font-bold text-[#041627] shadow-sm">Back to Intelligence</Link>
        </header>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="glass-panel rounded-[2rem] p-6"><p className="text-xs uppercase tracking-[0.22em] text-[#44474c]/60">Coverage</p><p className="mt-2 text-4xl font-light text-[#041627]">100%</p><p className="mt-2 text-sm text-[#536350]">Seed data connected</p></div>
          <div className="glass-panel rounded-[2rem] p-6"><p className="text-xs uppercase tracking-[0.22em] text-[#44474c]/60">Privacy</p><p className="mt-2 text-4xl font-light text-[#041627]">Safe</p><p className="mt-2 text-sm text-[#536350]">Aggregated where needed</p></div>
          <div className="glass-panel rounded-[2rem] p-6"><p className="text-xs uppercase tracking-[0.22em] text-[#44474c]/60">Action</p><p className="mt-2 text-4xl font-light text-[#041627]">Ready</p><p className="mt-2 text-sm text-[#536350]">No placeholder menu</p></div>
        </div>
        <div className="glass-panel overflow-hidden rounded-[2rem] p-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-[#e3e2e2] text-[10px] uppercase tracking-[0.18em] text-[#44474c]/50">
                <tr>{columns.map((column) => <th key={column} className="pb-4">{column}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[#e3e2e2]/50">
                {tableRows.map((row, index) => (
                  <tr key={index} className="hover:bg-[#041627]/5">
                    {columns.map((column) => <td key={column} className="py-4 text-[#041627]">{row[column]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </StitchPage>
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
          <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e8e2d9" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey={dataKey} fill="#1a2b3c" radius={[14, 14, 0, 0]} /></BarChart>
        ) : (
          <AreaChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e8e2d9" /><XAxis dataKey="week" /><YAxis /><Tooltip /><Area dataKey={dataKey} stroke="#98a994" fill="#98a99455" /></AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function RiskChart({ data }: { data: any[] }) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart><Pie data={data} dataKey="value" nameKey="label" innerRadius={70} outerRadius={115}>{data.map((_entry, index) => <Cell key={index} fill={["#98a994", "#c5a059", "#1a2b3c"][index]} />)}</Pie><Tooltip /></PieChart>
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
  const preferences = [
    { label: "Learning goal", value: "Become a certified mindful leadership facilitator" },
    { label: "Preferred practice window", value: "Morning, 9:00-10:00 AM" },
    { label: "Focus areas", value: "Recovery, emotional intelligence, leadership wellbeing" },
    { label: "Notification tone", value: "Gentle nudges only" }
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
            <div className="grid h-24 w-24 place-items-center rounded-full navy-gradient text-3xl font-semibold text-white">{auth.user?.avatar || auth.user?.name.slice(0, 2)}</div>
            <h2 className="mt-4 text-3xl font-light text-navy">{auth.user?.name}</h2>
            <p className="mt-1 text-stone">{auth.user?.email}</p>
            <span className="mt-4 rounded-full bg-sage/20 px-4 py-2 text-sm font-medium text-navy">Employee · Practitioner Path</span>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <StatPill label="Streak" value={`${dashboard?.kpis?.streakDays || 16} days`} />
            <StatPill label="Score" value={dashboard?.kpis?.wellbeingScore || 84} />
            <StatPill label="Certificates" value={dashboard?.kpis?.certificates || 2} />
            <StatPill label="Level" value="Practitioner" />
          </div>
        </Card>
        <Card>
          <ChartTitle title="Profile preferences" />
          <div className="grid gap-3">
            {preferences.map((item) => (
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
  return <AppLayout auth={auth} title="Upcoming Events" subtitle="Book or join your next Dharma Space session."><EventList /></AppLayout>;
}

function EmployeeBookingsPage({ auth }: { auth: ReturnType<typeof useAuth> }) {
  return <AppLayout auth={auth} title="My Bookings" subtitle="Your confirmed online, meeting room, and Dharma Space bookings."><BookingList /></AppLayout>;
}

function EmployeeStatisticsPage({ auth }: { auth: ReturnType<typeof useAuth> }) {
  return <AppLayout auth={auth} title="My Statistics" subtitle="Your personal wellness activity points and attendance progress."><StatsGrid /></AppLayout>;
}

function CorporateDashboardPage({ auth }: { auth: ReturnType<typeof useAuth> }) {
  return (
    <AppLayout auth={auth} title="Corporate Dashboard" subtitle="Company winners, events, bookings, ROI, and attendance history.">
      <div className="mb-6 grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
        <WellnessArchetypeCard attendance={78} />
        <DepartmentCompetitionCard />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <WinnersBoard clickable />
        <EventList admin />
        <BookingList title="My bookings" />
        <StatsGrid corporate />
      </div>
      <div className="mt-6"><AttendanceHistory /></div>
    </AppLayout>
  );
}

function CorporateWorkspacePage({ auth, section }: { auth: ReturnType<typeof useAuth>; section: string }) {
  const title = pathTitle(section);
  if (section === "events") return <AppLayout auth={auth} title="Upcoming Events" subtitle="Company events and signed-up employees."><EventList admin /></AppLayout>;
  if (section === "bookings") return <AppLayout auth={auth} title="My Booking" subtitle="Corporate bookings and locations."><BookingList /></AppLayout>;
  if (section === "booking-history") return <AppLayout auth={auth} title="Booking History" subtitle="Attendance by event, coach, date/time and attendees."><AttendanceHistory /></AppLayout>;
  if (section === "statistics") return <AppLayout auth={auth} title="Statistics" subtitle="Wellness improvement, ROI and engagement diagrams."><div className="grid gap-6"><DepartmentCompetitionCard /><StatsGrid corporate /></div></AppLayout>;
  return <AppLayout auth={auth} title={title} subtitle="Corporate admin profile and settings."><StatsGrid corporate /></AppLayout>;
}

function TrainerEventDashboard({ auth }: { auth: ReturnType<typeof useAuth> }) {
  return (
    <AppLayout auth={auth} title="Coach Dashboard" subtitle="Manage your upcoming events, capacity and attendee lists.">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <EventList admin />
        <CreateEventCard />
      </div>
      <div className="mt-6"><AttendeesCard /></div>
    </AppLayout>
  );
}

function TrainerWorkspacePage({ auth, section }: { auth: ReturnType<typeof useAuth>; section: string }) {
  if (section === "events") return <AppLayout auth={auth} title="My Events" subtitle="Your assigned sessions with capacity and signups."><EventList admin /></AppLayout>;
  if (section === "create-event") return <AppLayout auth={auth} title="Create Event" subtitle="Create a new event with title, date, location and pax."><CreateEventCard /></AppLayout>;
  if (section === "attendees") return <AppLayout auth={auth} title="Attendees" subtitle="See attendee lists by event."><AttendeesCard /></AppLayout>;
  return <AppLayout auth={auth} title="Profile" subtitle="Coach profile and event statistics."><StatsGrid /></AppLayout>;
}

function CreateEventCard() {
  return (
    <Card>
      <ChartTitle title="Create an event" />
      <div className="grid gap-3">
        {["Event title", "Date and time", "Location or Zoom link", "Amount of pax"].map((placeholder) => (
          <input key={placeholder} placeholder={placeholder} className="rounded-full border border-sand bg-white/70 px-5 py-3 outline-none focus:border-navy" />
        ))}
        <button className="rounded-full bg-navy px-5 py-3 font-semibold text-white">Create event placeholder</button>
      </div>
    </Card>
  );
}

function AttendeesCard() {
  return (
    <Card>
      <ChartTitle title="Attendee lists" />
      <div className="grid gap-3">
        {demoEvents.map((event) => (
          <div key={event.id} className="rounded-4xl bg-white/70 p-4">
            <p className="font-semibold text-navy">{event.name}</p>
            <p className="mt-1 text-sm text-stone">{event.booked} signed up · {event.capacity - event.booked} spots left</p>
            <p className="mt-1 text-sm text-stone">Attendees: Maya, Ava, Theo, Priya, Noah, Lina</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SuperAdminWorkspacePage({ auth, section }: { auth: ReturnType<typeof useAuth>; section: string }) {
  const title = pathTitle(section);
  return (
    <AppLayout auth={auth} title={title} subtitle="Platform-wide setup for corporates, departments, events, coaches, CWP plans and users.">
      <div className="grid gap-6 xl:grid-cols-2">
        <SuperAdminActions />
        {section === "events" ? <EventList admin /> : section === "coaches" ? <AttendeesCard /> : <CorporateListCard />}
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
  const company = ["CORPORATE_ADMIN", "SUPER_ADMIN"] as Role[];

  return (
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
        {["events", "create-event", "attendees", "profile"].map((path) => <Route key={path} path={`/trainer/${path}`} element={<Protected auth={auth} roles={trainer}><TrainerWorkspacePage auth={auth} section={path} /></Protected>} />)}
        <Route path="/company/dashboard" element={<Protected auth={auth} roles={company}><CorporateDashboardPage auth={auth} /></Protected>} />
        {["events", "bookings", "booking-history", "statistics", "profile"].map((path) => <Route key={path} path={`/company/${path}`} element={<Protected auth={auth} roles={company}><CorporateWorkspacePage auth={auth} section={path} /></Protected>} />)}
        <Route path="*" element={<Navigate to={auth.user ? (auth.user.homePath || "/app/dashboard") : "/"} replace />} />
      </Routes>
    </Shell>
  );
}

function pathTitle(path: string) {
  return path.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
