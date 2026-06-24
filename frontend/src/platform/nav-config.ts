import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  Gauge,
  GraduationCap,
  Home,
  Shield,
  Swords,
  User,
  Users
} from "lucide-react";

export type PlatformRole = "EMPLOYEE" | "HR_ADMIN" | "TRAINER" | "CORPORATE_ADMIN" | "SUPER_ADMIN";

export type PlatformNavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
};

// HR Admin and Corporate Admin are one merged "company manager" role under /hr.
const MANAGER_NAV: PlatformNavItem[] = [
  { label: "Dashboard", to: "/hr/dashboard", icon: BarChart3 },
  { label: "Employees", to: "/hr/employees", icon: Users },
  { label: "Events", to: "/hr/events", icon: CalendarDays },
  { label: "Booking History", to: "/hr/booking-history", icon: Shield },
  { label: "Statistics", to: "/hr/statistics", icon: Activity },
  { label: "Company", to: "/hr/company", icon: Building2 },
  { label: "Profile", to: "/hr/profile", icon: User }
];

const NAV_BY_ROLE: Record<PlatformRole, PlatformNavItem[]> = {
  EMPLOYEE: [
    { label: "Dashboard", to: "/app/dashboard", icon: Home },
    { label: "Upcoming Events", to: "/app/events", icon: CalendarDays },
    { label: "My Bookings", to: "/app/bookings", icon: BookOpen },
    { label: "My Statistics", to: "/app/statistics", icon: Gauge },
    { label: "Buddy Challenge", to: "/app/buddy-challenge", icon: Swords },
    { label: "Certificates", to: "/app/certificates", icon: Award },
    { label: "Profile", to: "/app/profile", icon: User }
  ],
  HR_ADMIN: MANAGER_NAV,
  TRAINER: [
    { label: "Dashboard", to: "/trainer/dashboard", icon: Gauge },
    { label: "My Classes", to: "/trainer/events", icon: CalendarDays },
    { label: "Create Class", to: "/trainer/create-event", icon: GraduationCap },
    { label: "Attendance", to: "/trainer/attendance", icon: Activity },
    { label: "Profile", to: "/trainer/profile", icon: User }
  ],
  CORPORATE_ADMIN: MANAGER_NAV,
  // Dharma Admin's CWP platform view: full visibility across the manager (HR) and
  // trainer surfaces. Company/inquiry management lives in the website Admin backend.
  SUPER_ADMIN: [
    { label: "Dashboard", to: "/hr/dashboard", icon: BarChart3 },
    { label: "Employees", to: "/hr/employees", icon: Users },
    { label: "Events", to: "/hr/events", icon: CalendarDays },
    { label: "Statistics", to: "/hr/statistics", icon: Activity },
    { label: "Coaching", to: "/trainer/dashboard", icon: GraduationCap },
    { label: "Company", to: "/hr/company", icon: Building2 },
    { label: "Profile", to: "/hr/profile", icon: User }
  ]
};

export function navForRole(role?: PlatformRole): PlatformNavItem[] {
  if (!role) return NAV_BY_ROLE.EMPLOYEE;
  return NAV_BY_ROLE[role] ?? NAV_BY_ROLE.EMPLOYEE;
}

export function readPlatformUser(): { name: string; role: PlatformRole } | null {
  try {
    const raw = localStorage.getItem("hsos_user");
    if (!raw) return null;
    const user = JSON.parse(raw) as { name?: string; role?: PlatformRole };
    if (!user.role) return null;
    return { name: user.name || "User", role: user.role };
  } catch {
    return null;
  }
}
