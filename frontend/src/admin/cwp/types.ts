export type CompanyRow = {
  id: string;
  name: string;
  industry: string;
  plan: string;
  seats: number;
  employeeCount: number;
  userCount: number;
  departmentCount: number;
  upcomingEventCount: number;
  totalEventCount: number;
  pendingScheduleRequests: number;
  totalWellnessScore: number;
  revenue: number;
};

export type FormOptions = {
  companies: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; scoreValue: number }>;
  trainers: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string; companyId: string }>;
};

export type EventRow = {
  id: string;
  title: string;
  dateTime: string;
  status: string;
  locationType: string;
  company: { id: string; name: string } | null;
  category: string;
  trainer: string | null;
  bookedCount: number;
  attendedCount: number;
  maxSpots: number;
};

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string | null;
  departmentId: string | null;
  company?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  totalWellnessScore?: number;
  accountStatus?: string;
  position?: string | null;
  createdAt?: string;
};

export type DepartmentRow = {
  id: string;
  name: string;
  companyId: string;
  company?: { id: string; name: string };
  userCount: number;
  employees: number;
};

export type CompanyDetail = CompanyRow & {
  departments: Array<{ id: string; name: string; userCount: number; employees: number }>;
  users: UserRow[];
  events: Array<{
    id: string;
    title: string;
    dateTime: string;
    category: string;
    bookedCount: number;
    maxSpots: number;
    status: string;
    trainer?: string | null;
    attendedCount?: number;
  }>;
  scheduleRequests?: Array<{
    id: string;
    status: string;
    createdAt: string;
    submittedBy: { name: string; email: string };
  }>;
};

export const ROLES = ["EMPLOYEE", "HR_ADMIN", "TRAINER", "CORPORATE_ADMIN", "SUPER_ADMIN"];

export type CompanyTab = "overview" | "settings" | "departments" | "people" | "events";

export const COMPANY_TABS: Array<{ id: CompanyTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "settings", label: "Settings" },
  { id: "departments", label: "Departments" },
  { id: "people", label: "People" },
  { id: "events", label: "Events" }
];
