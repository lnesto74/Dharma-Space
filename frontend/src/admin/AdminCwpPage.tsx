import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, CalendarDays, ExternalLink, Mail, RefreshCw, Users } from "lucide-react";
import { adminApi } from "./adminApi";
import { AdminShell } from "./SiteAdminPages";
import type { UserType } from "../auth/useAuth";

// The admin backend and the CWP platform share the same origin (the platform is
// served from the same domain under /hr, /app, /trainer, …), so the Dharma Admin
// session in localStorage carries straight over — just navigate same-origin.
function goToCwpPlatform() {
  window.location.assign("/hr/dashboard");
}

type Auth = { token: string; user: UserType | null };

type Kpis = {
  companies: number;
  employees: number;
  wellnessEvents: number;
  upcomingEvents: number;
  activeBookings: number;
  totalAttendances: number;
  pendingScheduleRequests: number;
  cwpInquiries: number;
};

type CompanyRow = {
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

type Overview = { kpis: Kpis; recentCompanies: CompanyRow[] };

type ScheduleRequest = {
  id: string;
  status: string;
  createdAt: string;
  company: { id: string; name: string; plan: string };
  submittedBy: { name: string; email: string };
};

type FormOptions = {
  companies: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; scoreValue: number }>;
  trainers: Array<{ id: string; name: string }>;
};

type EventRow = {
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

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string | null;
  departmentId: string | null;
  company?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  totalWellnessScore?: number;
};

type CompanyDetail = CompanyRow & {
  departments: Array<{ id: string; name: string; userCount: number; employees: number }>;
  users: UserRow[];
  events: Array<{ id: string; title: string; dateTime: string; category: string; bookedCount: number; maxSpots: number; status: string }>;
};

type Analytics = {
  categories: Array<{ name: string; events: number; attendances: number }>;
  attendanceByMonth: Array<{ label: string; attendances: number }>;
  companiesByScore: Array<{ id: string; name: string; score: number; employees: number }>;
  roleDistribution: Array<{ role: string; count: number }>;
};

type Tab = "overview" | "companies" | "events" | "users" | "analytics";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "companies", label: "Companies" },
  { id: "events", label: "Events" },
  { id: "users", label: "Users" },
  { id: "analytics", label: "Analytics" }
];

const ROLES = ["EMPLOYEE", "HR_ADMIN", "TRAINER", "CORPORATE_ADMIN", "SUPER_ADMIN"];

function Bar({ value, max, label, suffix }: { value: number; max: number; label: string; suffix?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <div style={{ width: 160, fontSize: 13, color: "var(--admin-text, #333)" }}>{label}</div>
      <div style={{ flex: 1, background: "var(--admin-gray-bg, #eee)", borderRadius: 8, height: 16 }}>
        <div style={{ width: `${pct}%`, background: "var(--admin-accent, #4a5f4d)", height: 16, borderRadius: 8, minWidth: value > 0 ? 4 : 0 }} />
      </div>
      <div style={{ width: 70, textAlign: "right", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{value}{suffix || ""}</div>
    </div>
  );
}

export function AdminCwpPage({ auth }: { auth: Auth }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [requests, setRequests] = useState<ScheduleRequest[]>([]);
  const [options, setOptions] = useState<FormOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ov, co, sr, opt] = await Promise.all([
        adminApi<Overview>("/api/admin/cwp/overview", auth.token),
        adminApi<{ companies: CompanyRow[] }>("/api/admin/cwp/companies", auth.token),
        adminApi<{ requests: ScheduleRequest[] }>("/api/admin/cwp/schedule-requests?status=pending", auth.token),
        adminApi<FormOptions>("/api/admin/cwp/form-options", auth.token)
      ]);
      setOverview(ov);
      setCompanies(co.companies);
      setRequests(sr.requests);
      setOptions(opt);
    } catch (e: any) {
      setError(e.message || "Could not load CWP data");
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = overview?.kpis;

  return (
    <AdminShell
      auth={auth}
      title="Corporate Wellness Platform"
      subtitle="Manage companies, departments, events, schedules, people, and analytics across all CWP clients."
      icon={Building2}
      toolbar={
        <div className="admin-db-toolbar">
          <button type="button" onClick={goToCwpPlatform} className="admin-btn admin-btn-primary">
            <ExternalLink style={{ width: 14, height: 14 }} />
            To CWP Platform
          </button>
          <Link to="/admin/inquiries" className="admin-btn">
            <Mail style={{ width: 14, height: 14 }} />
            CWP inquiries{kpis?.cwpInquiries ? ` (${kpis.cwpInquiries})` : ""}
          </Link>
          <button type="button" onClick={() => void load()} className="admin-btn">
            <RefreshCw style={{ width: 14, height: 14 }} />
            Refresh
          </button>
        </div>
      }
    >
      {error && <div className="admin-alert">{error}</div>}
      {notice && <div className="admin-alert" style={{ background: "var(--admin-gray-bg)", border: "none" }}>{notice}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`admin-btn${tab === t.id ? " admin-btn-primary" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="admin-loading">Loading CWP platform data…</div>
      ) : (
        <>
          {tab === "overview" && (
            <OverviewTab
              kpis={kpis}
              companies={companies}
              requests={requests}
              token={auth.token}
              onChanged={() => void load()}
              flash={flash}
              setError={setError}
              goCompanies={() => setTab("companies")}
            />
          )}
          {tab === "companies" && (
            <CompaniesTab token={auth.token} companies={companies} onChanged={() => void load()} flash={flash} setError={setError} />
          )}
          {tab === "events" && options && (
            <EventsTab token={auth.token} options={options} flash={flash} setError={setError} />
          )}
          {tab === "users" && options && (
            <UsersTab token={auth.token} options={options} flash={flash} setError={setError} />
          )}
          {tab === "analytics" && <AnalyticsTab token={auth.token} setError={setError} />}
        </>
      )}
    </AdminShell>
  );
}

function StatRow({ items }: { items: Array<[string, number | string]> }) {
  return (
    <div className="admin-stat-row">
      {items.map(([label, value]) => (
        <div key={label} className="admin-stat">
          <div className="admin-stat-label">{label}</div>
          <div className="admin-stat-value">{value}</div>
        </div>
      ))}
    </div>
  );
}

function OverviewTab({
  kpis,
  companies,
  requests,
  token,
  onChanged,
  flash,
  setError,
  goCompanies
}: {
  kpis?: Kpis;
  companies: CompanyRow[];
  requests: ScheduleRequest[];
  token: string;
  onChanged: () => void;
  flash: (m: string) => void;
  setError: (m: string) => void;
  goCompanies: () => void;
}) {
  const decide = async (id: string, status: "approved" | "declined") => {
    try {
      await adminApi(`/api/wellness/schedule-requests/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      flash(status === "approved" ? "Schedule approved — events created." : "Schedule request declined.");
      onChanged();
    } catch (e: any) {
      setError(e.message || "Could not update request");
    }
  };

  return (
    <>
      <StatRow
        items={[
          ["Companies", kpis?.companies ?? 0],
          ["Employees", kpis?.employees ?? 0],
          ["Upcoming events", kpis?.upcomingEvents ?? 0],
          ["Active bookings", kpis?.activeBookings ?? 0],
          ["Pending schedules", kpis?.pendingScheduleRequests ?? 0],
          ["CWP inquiries", kpis?.cwpInquiries ?? 0]
        ]}
      />

      <div className="admin-section-label">Companies on CWP</div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Company</th><th>Plan</th><th>Seats</th><th>Upcoming</th><th>Wellness score</th><th>Schedules</th></tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.plan}</td>
                <td>{c.employeeCount}/{c.seats}</td>
                <td>{c.upcomingEventCount}</td>
                <td>{c.totalWellnessScore}</td>
                <td>{c.pendingScheduleRequests > 0 ? `${c.pendingScheduleRequests} pending` : "—"}</td>
              </tr>
            ))}
            {companies.length === 0 && <tr className="admin-table-empty"><td colSpan={6}>No companies yet. Add one in the Companies tab.</td></tr>}
          </tbody>
        </table>
      </div>
      <button type="button" className="admin-btn" style={{ marginTop: 12 }} onClick={goCompanies}>Manage companies →</button>

      <div className="admin-section-label" style={{ marginTop: 24 }}>Pending schedule requests</div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Company</th><th>Submitted by</th><th>Date</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td>{r.company.name}</td>
                <td>{r.submittedBy.name} · {r.submittedBy.email}</td>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>
                  <div className="admin-table-actions">
                    <button type="button" className="admin-btn admin-btn-sm admin-btn-primary" onClick={() => void decide(r.id, "approved")}>Approve</button>
                    <button type="button" className="admin-btn admin-btn-sm" onClick={() => void decide(r.id, "declined")}>Decline</button>
                  </div>
                </td>
              </tr>
            ))}
            {requests.length === 0 && <tr className="admin-table-empty"><td colSpan={4}>No pending requests.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CompaniesTab({
  token,
  companies,
  onChanged,
  flash,
  setError
}: {
  token: string;
  companies: CompanyRow[];
  onChanged: () => void;
  flash: (m: string) => void;
  setError: (m: string) => void;
}) {
  const blank = { name: "", industry: "", plan: "Starter", seats: "50" };
  const [form, setForm] = useState<{ name: string; industry: string; plan: string; seats: string }>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [newDept, setNewDept] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { name: form.name, industry: form.industry || "General", plan: form.plan, seats: Number(form.seats) || 50 };
      if (editingId) {
        await adminApi(`/api/admin/cwp/companies/${editingId}`, token, { method: "PATCH", body: JSON.stringify(payload) });
        flash("Company updated.");
      } else {
        await adminApi("/api/admin/cwp/companies", token, { method: "POST", body: JSON.stringify(payload) });
        flash("Company created.");
      }
      setForm(blank);
      setEditingId(null);
      onChanged();
    } catch (e2: any) {
      setError(e2.message || "Could not save company");
    }
  };

  const startEdit = (c: CompanyRow) => {
    setEditingId(c.id);
    setForm({ name: c.name, industry: c.industry, plan: c.plan, seats: String(c.seats) });
  };

  const remove = async (c: CompanyRow) => {
    if (!window.confirm(`Delete ${c.name}? This only works if it has no users or events.`)) return;
    try {
      await adminApi(`/api/admin/cwp/companies/${c.id}`, token, { method: "DELETE" });
      flash("Company deleted.");
      onChanged();
    } catch (e: any) {
      setError(e.message || "Could not delete company");
    }
  };

  const openDetail = async (id: string) => {
    try {
      const res = await adminApi<{ company: CompanyDetail }>(`/api/admin/cwp/companies/${id}`, token);
      setDetail(res.company);
    } catch (e: any) {
      setError(e.message || "Could not load company");
    }
  };

  const addDept = async () => {
    if (!detail || !newDept.trim()) return;
    try {
      await adminApi(`/api/admin/cwp/companies/${detail.id}/departments`, token, { method: "POST", body: JSON.stringify({ name: newDept.trim() }) });
      setNewDept("");
      await openDetail(detail.id);
      onChanged();
    } catch (e: any) {
      setError(e.message || "Could not add department");
    }
  };

  const renameDept = async (id: string, current: string) => {
    const name = window.prompt("Rename department", current);
    if (!name || !detail) return;
    try {
      await adminApi(`/api/admin/cwp/departments/${id}`, token, { method: "PATCH", body: JSON.stringify({ name }) });
      await openDetail(detail.id);
    } catch (e: any) {
      setError(e.message || "Could not rename department");
    }
  };

  const deleteDept = async (id: string) => {
    if (!detail || !window.confirm("Delete this department? Members will be unassigned.")) return;
    try {
      await adminApi(`/api/admin/cwp/departments/${id}`, token, { method: "DELETE" });
      await openDetail(detail.id);
      onChanged();
    } catch (e: any) {
      setError(e.message || "Could not delete department");
    }
  };

  return (
    <>
      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <h2 className="admin-panel-title">{editingId ? "Edit company" : "Add company"}</h2>
        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <label className="admin-field"><span className="admin-field-label">Name</span>
              <input className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label className="admin-field"><span className="admin-field-label">Industry</span>
              <input className="admin-input" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
            </label>
            <label className="admin-field"><span className="admin-field-label">Plan</span>
              <select className="admin-input" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
                {["Starter", "Growth", "Enterprise"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="admin-field"><span className="admin-field-label">Seats</span>
              <input className="admin-input" type="number" min={1} value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} />
            </label>
          </div>
          <div className="admin-form-actions">
            <button type="submit" className="admin-btn admin-btn-primary">{editingId ? "Save changes" : "Create company"}</button>
            {editingId && <button type="button" className="admin-btn" onClick={() => { setEditingId(null); setForm(blank); }}>Cancel</button>}
          </div>
        </form>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Company</th><th>Industry</th><th>Plan</th><th>Seats</th><th>Depts</th><th>Events</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.industry}</td>
                <td>{c.plan}</td>
                <td>{c.userCount}/{c.seats}</td>
                <td>{c.departmentCount}</td>
                <td>{c.totalEventCount}</td>
                <td>
                  <div className="admin-table-actions">
                    <button type="button" className="admin-btn admin-btn-sm" onClick={() => void openDetail(c.id)}>View</button>
                    <button type="button" className="admin-btn admin-btn-sm" onClick={() => startEdit(c)}>Edit</button>
                    <button type="button" className="admin-btn admin-btn-sm" onClick={() => void remove(c)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {companies.length === 0 && <tr className="admin-table-empty"><td colSpan={7}>No companies yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="admin-panel" style={{ marginTop: 24 }}>
          <div className="admin-panel-title-row">
            <h3 className="admin-panel-title">{detail.name} · departments & people</h3>
            <button type="button" className="admin-btn" onClick={() => setDetail(null)}>Close</button>
          </div>

          <div className="admin-section-label" style={{ marginTop: 12 }}>Departments</div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Department</th><th>Members</th><th>Employees</th><th>Actions</th></tr></thead>
              <tbody>
                {detail.departments.map((d) => (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td>{d.userCount}</td>
                    <td>{d.employees}</td>
                    <td>
                      <div className="admin-table-actions">
                        <button type="button" className="admin-btn admin-btn-sm" onClick={() => void renameDept(d.id, d.name)}>Rename</button>
                        <button type="button" className="admin-btn admin-btn-sm" onClick={() => void deleteDept(d.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {detail.departments.length === 0 && <tr className="admin-table-empty"><td colSpan={4}>No departments yet.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input className="admin-input" placeholder="New department name" value={newDept} onChange={(e) => setNewDept(e.target.value)} style={{ maxWidth: 280 }} />
            <button type="button" className="admin-btn admin-btn-primary" onClick={() => void addDept()}>Add department</button>
          </div>

          <div className="admin-section-label" style={{ marginTop: 20 }}>People ({detail.users.length})</div>
          <div className="admin-link-list">
            {detail.users.slice(0, 16).map((u) => (
              <div key={u.id} className="admin-link-row">
                <Users style={{ width: 14, height: 14, marginRight: 8 }} />
                <strong>{u.name}</strong><span> — {u.role}{u.department ? ` · ${u.department.name}` : ""} · {u.email}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function EventsTab({
  token,
  options,
  flash,
  setError
}: {
  token: string;
  options: FormOptions;
  flash: (m: string) => void;
  setError: (m: string) => void;
}) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [filterCompany, setFilterCompany] = useState("");
  const blank = {
    companyId: options.companies[0]?.id || "",
    categoryId: options.categories[0]?.id || "",
    title: "",
    dateTime: "",
    trainerId: "",
    locationType: "online",
    locationDetail: "",
    maxSpots: "30"
  };
  const [form, setForm] = useState(blank);

  const load = useCallback(async () => {
    try {
      const q = filterCompany ? `?companyId=${filterCompany}` : "";
      const res = await adminApi<{ events: EventRow[] }>(`/api/admin/cwp/events${q}`, token);
      setEvents(res.events);
    } catch (e: any) {
      setError(e.message || "Could not load events");
    }
  }, [token, filterCompany, setError]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyId || !form.categoryId || !form.title || !form.dateTime) {
      setError("Company, category, title and date/time are required.");
      return;
    }
    try {
      await adminApi("/api/admin/cwp/events", token, {
        method: "POST",
        body: JSON.stringify({
          companyId: form.companyId,
          categoryId: form.categoryId,
          title: form.title,
          dateTime: new Date(form.dateTime).toISOString(),
          trainerId: form.trainerId || null,
          locationType: form.locationType,
          locationDetail: form.locationDetail || null,
          maxSpots: Number(form.maxSpots) || 30
        })
      });
      flash("Event created.");
      setForm({ ...blank, companyId: form.companyId });
      void load();
    } catch (e2: any) {
      setError(e2.message || "Could not create event");
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this event? Bookings and attendance for it will be removed.")) return;
    try {
      await adminApi(`/api/admin/cwp/events/${id}`, token, { method: "DELETE" });
      flash("Event deleted.");
      void load();
    } catch (e: any) {
      setError(e.message || "Could not delete event");
    }
  };

  return (
    <>
      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <h2 className="admin-panel-title">Schedule an event</h2>
        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <label className="admin-field"><span className="admin-field-label">Company</span>
              <select className="admin-input" value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
                {options.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="admin-field"><span className="admin-field-label">Category</span>
              <select className="admin-input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                {options.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="admin-field"><span className="admin-field-label">Title</span>
              <input className="admin-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </label>
            <label className="admin-field"><span className="admin-field-label">Date & time</span>
              <input className="admin-input" type="datetime-local" value={form.dateTime} onChange={(e) => setForm({ ...form, dateTime: e.target.value })} required />
            </label>
            <label className="admin-field"><span className="admin-field-label">Trainer</span>
              <select className="admin-input" value={form.trainerId} onChange={(e) => setForm({ ...form, trainerId: e.target.value })}>
                <option value="">Unassigned</option>
                {options.trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="admin-field"><span className="admin-field-label">Location type</span>
              <select className="admin-input" value={form.locationType} onChange={(e) => setForm({ ...form, locationType: e.target.value })}>
                {["online", "onsite", "hybrid"].map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            <label className="admin-field"><span className="admin-field-label">Location / link</span>
              <input className="admin-input" value={form.locationDetail} onChange={(e) => setForm({ ...form, locationDetail: e.target.value })} />
            </label>
            <label className="admin-field"><span className="admin-field-label">Max spots</span>
              <input className="admin-input" type="number" min={1} value={form.maxSpots} onChange={(e) => setForm({ ...form, maxSpots: e.target.value })} />
            </label>
          </div>
          <div className="admin-form-actions">
            <button type="submit" className="admin-btn admin-btn-primary">Create event</button>
          </div>
        </form>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span className="admin-field-label">Filter company</span>
        <select className="admin-input" style={{ maxWidth: 260 }} value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
          <option value="">All companies</option>
          {options.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Event</th><th>Company</th><th>Date</th><th>Category</th><th>Trainer</th><th>Booked</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td><strong>{e.title}</strong></td>
                <td>{e.company?.name || "—"}</td>
                <td>{new Date(e.dateTime).toLocaleString()}</td>
                <td>{e.category}</td>
                <td>{e.trainer || "—"}</td>
                <td>{e.bookedCount}/{e.maxSpots}</td>
                <td>{e.status}</td>
                <td><button type="button" className="admin-btn admin-btn-sm" onClick={() => void remove(e.id)}>Delete</button></td>
              </tr>
            ))}
            {events.length === 0 && <tr className="admin-table-empty"><td colSpan={8}>No events.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function UsersTab({
  token,
  options,
  flash,
  setError
}: {
  token: string;
  options: FormOptions;
  flash: (m: string) => void;
  setError: (m: string) => void;
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filterCompany, setFilterCompany] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const blank = { name: "", email: "", password: "", role: "EMPLOYEE", companyId: "", departmentId: "" };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterCompany) params.set("companyId", filterCompany);
      if (filterRole) params.set("role", filterRole);
      const qs = params.toString();
      const res = await adminApi<{ users: UserRow[] }>(`/api/admin/cwp/users${qs ? `?${qs}` : ""}`, token);
      setUsers(res.users);
    } catch (e: any) {
      setError(e.message || "Could not load users");
    }
  }, [token, filterCompany, filterRole, setError]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const payload: Record<string, unknown> = {
          name: form.name,
          role: form.role,
          companyId: form.companyId || null,
          departmentId: form.departmentId || null
        };
        if (form.password) payload.password = form.password;
        await adminApi(`/api/admin/cwp/users/${editingId}`, token, { method: "PATCH", body: JSON.stringify(payload) });
        flash("User updated.");
      } else {
        await adminApi("/api/admin/cwp/users", token, {
          method: "POST",
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            password: form.password,
            role: form.role,
            companyId: form.companyId || null,
            departmentId: form.departmentId || null
          })
        });
        flash("User created.");
      }
      setForm(blank);
      setEditingId(null);
      void load();
    } catch (e2: any) {
      setError(e2.message || "Could not save user");
    }
  };

  const startEdit = (u: UserRow) => {
    setEditingId(u.id);
    setForm({ name: u.name, email: u.email, password: "", role: u.role, companyId: u.companyId || "", departmentId: u.departmentId || "" });
  };

  const remove = async (u: UserRow) => {
    if (!window.confirm(`Delete ${u.name}? This removes their bookings and attendance.`)) return;
    try {
      await adminApi(`/api/admin/cwp/users/${u.id}`, token, { method: "DELETE" });
      flash("User deleted.");
      void load();
    } catch (e: any) {
      setError(e.message || "Could not delete user");
    }
  };

  return (
    <>
      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <h2 className="admin-panel-title">{editingId ? "Edit user" : "Add user"}</h2>
        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <label className="admin-field"><span className="admin-field-label">Name</span>
              <input className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label className="admin-field"><span className="admin-field-label">Email</span>
              <input className="admin-input" type="email" value={form.email} disabled={!!editingId} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </label>
            <label className="admin-field"><span className="admin-field-label">{editingId ? "Reset password (optional)" : "Password"}</span>
              <input className="admin-input" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editingId} minLength={6} />
            </label>
            <label className="admin-field"><span className="admin-field-label">Role</span>
              <select className="admin-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="admin-field"><span className="admin-field-label">Company</span>
              <select className="admin-input" value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
                <option value="">No company</option>
                {options.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <div className="admin-form-actions">
            <button type="submit" className="admin-btn admin-btn-primary">{editingId ? "Save changes" : "Create user"}</button>
            {editingId && <button type="button" className="admin-btn" onClick={() => { setEditingId(null); setForm(blank); }}>Cancel</button>}
          </div>
        </form>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <select className="admin-input" style={{ maxWidth: 240 }} value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
          <option value="">All companies</option>
          {options.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="admin-input" style={{ maxWidth: 200 }} value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Company</th><th>Department</th><th /></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.name}</strong></td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.company?.name || "—"}</td>
                <td>{u.department?.name || "—"}</td>
                <td>
                  <div className="admin-table-actions">
                    <button type="button" className="admin-btn admin-btn-sm" onClick={() => startEdit(u)}>Edit</button>
                    <button type="button" className="admin-btn admin-btn-sm" onClick={() => void remove(u)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr className="admin-table-empty"><td colSpan={6}>No users match.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AnalyticsTab({ token, setError }: { token: string; setError: (m: string) => void }) {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setData(await adminApi<Analytics>("/api/admin/cwp/analytics", token));
      } catch (e: any) {
        setError(e.message || "Could not load analytics");
      }
    })();
  }, [token, setError]);

  if (!data) return <div className="admin-loading">Loading analytics…</div>;

  const maxAttn = Math.max(1, ...data.attendanceByMonth.map((m) => m.attendances));
  const maxCat = Math.max(1, ...data.categories.map((c) => c.attendances));
  const maxScore = Math.max(1, ...data.companiesByScore.map((c) => c.score));

  return (
    <>
      <div className="admin-section-label">Attendance over the last 6 months</div>
      <div className="admin-panel">
        {data.attendanceByMonth.map((m) => <Bar key={m.label} label={m.label} value={m.attendances} max={maxAttn} />)}
      </div>

      <div className="admin-section-label" style={{ marginTop: 20 }}>Attendance by category</div>
      <div className="admin-panel">
        {data.categories.length === 0 && <p>No event data yet.</p>}
        {data.categories.map((c) => <Bar key={c.name} label={c.name} value={c.attendances} max={maxCat} />)}
      </div>

      <div className="admin-section-label" style={{ marginTop: 20 }}>Top companies by wellness score</div>
      <div className="admin-panel">
        {data.companiesByScore.length === 0 && <p>No companies yet.</p>}
        {data.companiesByScore.map((c) => <Bar key={c.id} label={c.name} value={c.score} max={maxScore} />)}
      </div>

      <div className="admin-section-label" style={{ marginTop: 20 }}>Accounts by role</div>
      <div className="admin-stat-row">
        {data.roleDistribution.map((r) => (
          <div key={r.role} className="admin-stat">
            <div className="admin-stat-label">{r.role}</div>
            <div className="admin-stat-value">{r.count}</div>
          </div>
        ))}
      </div>
    </>
  );
}
