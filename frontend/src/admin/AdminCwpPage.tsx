import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, ExternalLink, Mail, RefreshCw } from "lucide-react";
import { adminApi } from "./adminApi";
import { AdminShell } from "./SiteAdminPages";
import type { UserType } from "../auth/useAuth";
import {
  CATEGORY_GROUPS,
  ROLES,
  type CategoryGroup,
  type CategoryRow,
  type CompanyRow,
  type FormOptions,
  type SessionRow,
  type TrainerRow,
  type UserRow
} from "./cwp/types";

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
  pendingUsers: number;
};

type Overview = { kpis: Kpis; recentCompanies: CompanyRow[] };

type ScheduleRequest = {
  id: string;
  status: string;
  createdAt: string;
  company: { id: string; name: string; plan: string };
  submittedBy: { name: string; email: string };
};

type Analytics = {
  categories: Array<{ name: string; events: number; attendances: number }>;
  attendanceByMonth: Array<{ label: string; attendances: number }>;
  companiesByScore: Array<{ id: string; name: string; score: number; employees: number }>;
  roleDistribution: Array<{ role: string; count: number }>;
};

type Tab = "overview" | "companies" | "programs" | "trainers" | "access" | "analytics";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "companies", label: "Companies" },
  { id: "programs", label: "Programs & Sessions" },
  { id: "trainers", label: "Trainers & Specialists" },
  { id: "access", label: "Access" },
  { id: "analytics", label: "Analytics" }
];

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <div style={{ width: 160, fontSize: 13, color: "var(--admin-text, #333)" }}>{label}</div>
      <div style={{ flex: 1, background: "var(--admin-gray-bg, #eee)", borderRadius: 8, height: 16 }}>
        <div style={{ width: `${pct}%`, background: "var(--admin-accent, #4a5f4d)", height: 16, borderRadius: 8, minWidth: value > 0 ? 4 : 0 }} />
      </div>
      <div style={{ width: 70, textAlign: "right", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

export function AdminCwpPage({ auth }: { auth: Auth }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [requests, setRequests] = useState<ScheduleRequest[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserRow[]>([]);
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
      const [ov, co, sr, pending] = await Promise.all([
        adminApi<Overview>("/api/admin/cwp/overview", auth.token),
        adminApi<{ companies: CompanyRow[] }>("/api/admin/cwp/companies", auth.token),
        adminApi<{ requests: ScheduleRequest[] }>("/api/admin/cwp/schedule-requests?status=pending", auth.token),
        adminApi<{ users: UserRow[] }>("/api/admin/cwp/users?accountStatus=PENDING", auth.token)
      ]);
      setOverview(ov);
      setCompanies(co.companies);
      setRequests(sr.requests);
      setPendingUsers(pending.users || []);
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
      subtitle="Platform overview and company directory. Open a company to manage its departments, people, and events separately."
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
              pendingUsers={pendingUsers}
              token={auth.token}
              onChanged={() => void load()}
              flash={flash}
              setError={setError}
              goCompanies={() => setTab("companies")}
            />
          )}
          {tab === "companies" && (
            <CompaniesTab
              token={auth.token}
              companies={companies}
              onChanged={() => void load()}
              flash={flash}
              setError={setError}
            />
          )}
          {tab === "programs" && (
            <ProgramsTab token={auth.token} flash={flash} setError={setError} />
          )}
          {tab === "trainers" && (
            <TrainersTab token={auth.token} flash={flash} setError={setError} />
          )}
          {tab === "access" && (
            <AccessTab token={auth.token} companies={companies} flash={flash} setError={setError} />
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
  pendingUsers,
  token,
  onChanged,
  flash,
  setError,
  goCompanies
}: {
  kpis?: Kpis;
  companies: CompanyRow[];
  requests: ScheduleRequest[];
  pendingUsers: UserRow[];
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

  const approveUser = async (user: UserRow) => {
    try {
      await adminApi(`/api/admin/cwp/users/${user.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          accountStatus: "APPROVED",
          role: user.role || "EMPLOYEE",
          companyId: user.companyId
        })
      });
      flash(`${user.name} approved.`);
      onChanged();
    } catch (e: any) {
      setError(e.message || "Could not approve user");
    }
  };

  const rejectUser = async (user: UserRow) => {
    if (!window.confirm(`Reject access for ${user.email}?`)) return;
    try {
      await adminApi(`/api/admin/cwp/users/${user.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ accountStatus: "REJECTED" })
      });
      flash(`${user.name} rejected.`);
      onChanged();
    } catch (e: any) {
      setError(e.message || "Could not reject user");
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
          ["Pending user approvals", kpis?.pendingUsers ?? 0],
          ["CWP inquiries", kpis?.cwpInquiries ?? 0]
        ]}
      />

      <div className="admin-section-label">Companies on CWP</div>
      <p className="admin-muted" style={{ marginBottom: 12 }}>Each company has its own workspace for departments, people, and events.</p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Company</th><th>Plan</th><th>Seats</th><th>Depts</th><th>Upcoming</th><th>Wellness score</th><th /></tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.plan}</td>
                <td>{c.employeeCount}/{c.seats}</td>
                <td>{c.departmentCount}</td>
                <td>{c.upcomingEventCount}</td>
                <td>{c.totalWellnessScore}</td>
                <td>
                  <Link to={`/admin/cwp/companies/${c.id}`} className="admin-btn admin-btn-sm admin-btn-primary">Manage</Link>
                </td>
              </tr>
            ))}
            {companies.length === 0 && <tr className="admin-table-empty"><td colSpan={7}>No companies yet. Add one in the Companies tab.</td></tr>}
          </tbody>
        </table>
      </div>
      <button type="button" className="admin-btn" style={{ marginTop: 12 }} onClick={goCompanies}>Add a company →</button>

      <div className="admin-section-label" style={{ marginTop: 24 }}>Pending user approvals</div>
      <p className="admin-muted" style={{ marginBottom: 12 }}>
        Signups waiting for review. Use the briefcase icon (lower right) on any admin page for quick approve/reject.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Position</th>
              <th>Company</th>
              <th>Department</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingUsers.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.name}</strong></td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.position || "—"}</td>
                <td>
                  {u.company ? (
                    <Link to={`/admin/cwp/companies/${u.company.id}?tab=people`}>{u.company.name}</Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{u.department?.name || "—"}</td>
                <td>
                  <div className="admin-table-actions">
                    <button type="button" className="admin-btn admin-btn-sm admin-btn-primary" onClick={() => void approveUser(u)}>
                      Approve
                    </button>
                    <button type="button" className="admin-btn admin-btn-sm" onClick={() => void rejectUser(u)}>
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {pendingUsers.length === 0 && (
              <tr className="admin-table-empty">
                <td colSpan={7}>No pending signups.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-section-label" style={{ marginTop: 24 }}>Pending schedule requests</div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Company</th><th>Submitted by</th><th>Date</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link to={`/admin/cwp/companies/${r.company.id}`}>{r.company.name}</Link>
                </td>
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
  const navigate = useNavigate();
  const blank = { name: "", industry: "", plan: "Starter", seats: "50", departments: "" };
  const [form, setForm] = useState(blank);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const base = {
        name: form.name,
        industry: form.industry || "General",
        plan: form.plan,
        seats: Number(form.seats) || 50
      };
      const departments = form.departments
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const res = await adminApi<{ company: CompanyRow }>("/api/admin/cwp/companies", token, {
        method: "POST",
        body: JSON.stringify({ ...base, departments })
      });
      setForm(blank);
      flash(departments.length ? "Company created with departments." : "Company created.");
      onChanged();
      navigate(`/admin/cwp/companies/${res.company.id}`);
    } catch (e2: any) {
      setError(e2.message || "Could not create company");
    }
  };

  return (
    <>
      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <h2 className="admin-panel-title">Add company</h2>
        <p className="admin-muted" style={{ marginBottom: 12 }}>
          After creating a company you&apos;ll open its workspace to add people, departments, and events.
        </p>
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
                {["Starter", "Growth", "Scale", "Enterprise"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="admin-field"><span className="admin-field-label">Seats</span>
              <input className="admin-input" type="number" min={1} value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} />
            </label>
            <label className="admin-field" style={{ gridColumn: "1 / -1" }}>
              <span className="admin-field-label">Initial departments (one per line, optional)</span>
              <textarea
                className="admin-input"
                rows={3}
                placeholder={"People & Culture\nProduct\nSales"}
                value={form.departments}
                onChange={(e) => setForm({ ...form, departments: e.target.value })}
              />
            </label>
          </div>
          <div className="admin-form-actions">
            <button type="submit" className="admin-btn admin-btn-primary">Create & open company</button>
          </div>
        </form>
      </div>

      <div className="admin-section-label">All companies</div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Company</th><th>Industry</th><th>Plan</th><th>Seats</th><th>Depts</th><th>People</th><th>Events</th><th /></tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.industry}</td>
                <td>{c.plan}</td>
                <td>{c.userCount}/{c.seats}</td>
                <td>{c.departmentCount}</td>
                <td>{c.userCount}</td>
                <td>{c.totalEventCount}</td>
                <td>
                  <Link to={`/admin/cwp/companies/${c.id}`} className="admin-btn admin-btn-sm admin-btn-primary">Manage</Link>
                </td>
              </tr>
            ))}
            {companies.length === 0 && <tr className="admin-table-empty"><td colSpan={8}>No companies yet.</td></tr>}
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
        {data.companiesByScore.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <Link to={`/admin/cwp/companies/${c.id}`} style={{ width: 160, fontSize: 13 }}>{c.name}</Link>
            <div style={{ flex: 1, background: "var(--admin-gray-bg, #eee)", borderRadius: 8, height: 16 }}>
              <div style={{ width: `${Math.round((c.score / maxScore) * 100)}%`, background: "var(--admin-accent, #4a5f4d)", height: 16, borderRadius: 8, minWidth: c.score > 0 ? 4 : 0 }} />
            </div>
            <div style={{ width: 70, textAlign: "right", fontSize: 13 }}>{c.score}</div>
          </div>
        ))}
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

function statusColor(status?: string) {
  if (status === "PENDING") return "#b45309";
  if (status === "REJECTED") return "#b91c1c";
  return "#166534";
}

function StatusText({ status }: { status?: string }) {
  const label = status === "REJECTED" ? "SUSPENDED" : status || "APPROVED";
  return <span style={{ fontSize: 12, fontWeight: 600, color: statusColor(status) }}>{label}</span>;
}

// ---- Programs & Sessions -----------------------------------------------------------
function ProgramsTab({
  token,
  flash,
  setError
}: {
  token: string;
  flash: (m: string) => void;
  setError: (m: string) => void;
}) {
  const [options, setOptions] = useState<FormOptions | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [filterCompany, setFilterCompany] = useState("");
  const [manageTypes, setManageTypes] = useState(false);

  const blankSession = {
    group: "REGULAR" as CategoryGroup,
    categoryId: "",
    companyId: "",
    title: "",
    dateTime: "",
    trainerId: "",
    locationType: "online",
    locationDetail: "",
    maxSpots: "30"
  };
  const [form, setForm] = useState(blankSession);
  const blankType = { name: "", group: "SIGNATURE" as CategoryGroup, scoreValue: "40", icon: "" };
  const [typeForm, setTypeForm] = useState(blankType);

  const load = useCallback(async () => {
    try {
      const [opt, ev, cat] = await Promise.all([
        adminApi<FormOptions>("/api/admin/cwp/form-options", token),
        adminApi<{ events: SessionRow[] }>("/api/admin/cwp/events?limit=200", token),
        adminApi<{ categories: CategoryRow[] }>("/api/admin/cwp/categories", token)
      ]);
      setOptions(opt);
      setSessions(ev.events);
      setCategories(cat.categories);
    } catch (e: any) {
      setError(e.message || "Could not load programs");
    }
  }, [token, setError]);

  useEffect(() => { void load(); }, [load]);

  const groupCategories = useMemo(
    () => (options ? options.categories.filter((c) => c.group === form.group) : []),
    [options, form.group]
  );

  const setGroup = (group: CategoryGroup) => {
    const first = options?.categories.find((c) => c.group === group);
    setForm((f) => ({ ...f, group, categoryId: first?.id || "" }));
  };

  useEffect(() => {
    if (options && !form.categoryId) {
      const first = options.categories.find((c) => c.group === form.group);
      if (first) setForm((f) => ({ ...f, categoryId: first.id }));
    }
  }, [options]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.categoryId || !form.companyId || !form.title || !form.dateTime) {
      setError("Family, offering, company, title and date/time are required.");
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
      flash("Session scheduled.");
      setForm({ ...blankSession, group: form.group, categoryId: form.categoryId, companyId: form.companyId });
      void load();
    } catch (e2: any) {
      setError(e2.message || "Could not create session");
    }
  };

  const removeSession = async (id: string) => {
    if (!window.confirm("Delete this session?")) return;
    try {
      await adminApi(`/api/admin/cwp/events/${id}`, token, { method: "DELETE" });
      flash("Session deleted.");
      void load();
    } catch (e: any) {
      setError(e.message || "Could not delete session");
    }
  };

  const addType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeForm.name.trim()) return;
    try {
      await adminApi("/api/admin/cwp/categories", token, {
        method: "POST",
        body: JSON.stringify({
          name: typeForm.name.trim(),
          group: typeForm.group,
          scoreValue: Number(typeForm.scoreValue) || 40,
          icon: typeForm.icon || null
        })
      });
      flash("Offering type added.");
      setTypeForm(blankType);
      void load();
    } catch (e2: any) {
      setError(e2.message || "Could not add offering type");
    }
  };

  const removeType = async (c: CategoryRow) => {
    if (!window.confirm(`Delete offering type "${c.name}"?`)) return;
    try {
      await adminApi(`/api/admin/cwp/categories/${c.id}`, token, { method: "DELETE" });
      flash("Offering type deleted.");
      void load();
    } catch (e: any) {
      setError(e.message || "Could not delete offering type");
    }
  };

  const visibleSessions = filterCompany
    ? sessions.filter((s) => s.company?.id === filterCompany)
    : sessions;

  if (!options) return <div className="admin-loading">Loading programs…</div>;

  return (
    <>
      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <h2 className="admin-panel-title">Create a session</h2>
        <p className="admin-muted" style={{ marginBottom: 12 }}>
          Pick a family, choose the offering, then assign it to a company and trainer.
        </p>

        <div className="admin-view-tabs" style={{ marginBottom: 16 }}>
          {CATEGORY_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`admin-view-tab${form.group === g.id ? " active" : ""}`}
              onClick={() => setGroup(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
        <p className="admin-muted" style={{ marginTop: -8, marginBottom: 12 }}>
          {CATEGORY_GROUPS.find((g) => g.id === form.group)?.blurb}
        </p>

        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <label className="admin-field"><span className="admin-field-label">Offering</span>
              <select className="admin-input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                {groupCategories.length === 0 && <option value="">No offerings in this family</option>}
                {groupCategories.map((c) => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}
              </select>
            </label>
            <label className="admin-field"><span className="admin-field-label">Company</span>
              <select className="admin-input" value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} required>
                <option value="">Select company…</option>
                {options.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="admin-field"><span className="admin-field-label">Title</span>
              <input className="admin-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Morning Vinyasa Flow" required />
            </label>
            <label className="admin-field"><span className="admin-field-label">Date & time</span>
              <input className="admin-input" type="datetime-local" value={form.dateTime} onChange={(e) => setForm({ ...form, dateTime: e.target.value })} required />
            </label>
            <label className="admin-field"><span className="admin-field-label">Trainer / specialist</span>
              <select className="admin-input" value={form.trainerId} onChange={(e) => setForm({ ...form, trainerId: e.target.value })}>
                <option value="">Unassigned</option>
                {options.trainers.map((t) => <option key={t.id} value={t.id}>{t.name}{t.position ? ` · ${t.position}` : ""}</option>)}
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
            <button type="submit" className="admin-btn admin-btn-primary">Schedule session</button>
          </div>
        </form>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <div className="admin-section-label" style={{ margin: 0 }}>Scheduled sessions</div>
        <select className="admin-input" style={{ maxWidth: 240 }} value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
          <option value="">All companies</option>
          {options.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {CATEGORY_GROUPS.map((g) => {
        const rows = visibleSessions.filter((s) => s.categoryGroup === g.id);
        return (
          <div key={g.id} style={{ marginBottom: 20 }}>
            <div className="admin-booking-group-head">
              <div>
                <div className="admin-booking-group-heading">{g.label}</div>
                <div className="admin-muted" style={{ fontSize: 13 }}>{g.blurb}</div>
              </div>
              <span className="admin-booking-group-count">{rows.length} session{rows.length === 1 ? "" : "s"}</span>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Session</th><th>Company</th><th>Date</th><th>Trainer</th><th>Booked</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id}>
                      <td><strong>{s.categoryIcon ? `${s.categoryIcon} ` : ""}{s.title}</strong><div className="admin-muted" style={{ fontSize: 12 }}>{s.category}</div></td>
                      <td>{s.company ? <Link to={`/admin/cwp/companies/${s.company.id}?tab=events`}>{s.company.name}</Link> : "—"}</td>
                      <td>{new Date(s.dateTime).toLocaleString()}</td>
                      <td>{s.trainer || "—"}</td>
                      <td>{s.bookedCount}/{s.maxSpots}</td>
                      <td>{s.status}</td>
                      <td><button type="button" className="admin-btn admin-btn-sm" onClick={() => void removeSession(s.id)}>Delete</button></td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr className="admin-table-empty"><td colSpan={7}>No {g.label.toLowerCase()} sessions scheduled.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="admin-section-label" style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Offering types</span>
        <button type="button" className="admin-btn admin-btn-sm" onClick={() => setManageTypes((v) => !v)}>
          {manageTypes ? "Hide" : "Manage offerings"}
        </button>
      </div>
      {manageTypes && (
        <div className="admin-panel">
          <p className="admin-muted" style={{ marginBottom: 12 }}>
            Offering types are the bookable classes/activities inside each family. Add your own to extend the catalog.
          </p>
          <form onSubmit={addType} style={{ marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
              <label className="admin-field"><span className="admin-field-label">Name</span>
                <input className="admin-input" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="e.g. Reformer Pilates" required />
              </label>
              <label className="admin-field"><span className="admin-field-label">Family</span>
                <select className="admin-input" value={typeForm.group} onChange={(e) => setTypeForm({ ...typeForm, group: e.target.value as CategoryGroup })}>
                  {CATEGORY_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
              </label>
              <label className="admin-field"><span className="admin-field-label">Points</span>
                <input className="admin-input" type="number" min={1} value={typeForm.scoreValue} onChange={(e) => setTypeForm({ ...typeForm, scoreValue: e.target.value })} />
              </label>
              <label className="admin-field"><span className="admin-field-label">Icon (emoji, optional)</span>
                <input className="admin-input" value={typeForm.icon} onChange={(e) => setTypeForm({ ...typeForm, icon: e.target.value })} maxLength={4} placeholder="🧘" />
              </label>
            </div>
            <div className="admin-form-actions">
              <button type="submit" className="admin-btn admin-btn-primary">Add offering type</button>
            </div>
          </form>

          {CATEGORY_GROUPS.map((g) => {
            const rows = categories.filter((c) => c.group === g.id);
            return (
              <div key={g.id} style={{ marginBottom: 12 }}>
                <div className="admin-section-label" style={{ marginTop: 4 }}>{g.label}</div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Offering</th><th>Points</th><th>Sessions</th><th /></tr></thead>
                    <tbody>
                      {rows.map((c) => (
                        <tr key={c.id}>
                          <td><strong>{c.icon ? `${c.icon} ` : ""}{c.name}</strong></td>
                          <td>{c.scoreValue}</td>
                          <td>{c.eventCount}</td>
                          <td>
                            <button type="button" className="admin-btn admin-btn-sm" disabled={c.eventCount > 0} onClick={() => void removeType(c)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                      {rows.length === 0 && <tr className="admin-table-empty"><td colSpan={4}>No offerings in this family yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ---- Trainers & specialists --------------------------------------------------------
function TrainersTab({
  token,
  flash,
  setError
}: {
  token: string;
  flash: (m: string) => void;
  setError: (m: string) => void;
}) {
  const [trainers, setTrainers] = useState<TrainerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const blank = { name: "", email: "", password: "", specialty: "" };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", specialty: "", password: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi<{ trainers: TrainerRow[] }>("/api/admin/cwp/trainers", token);
      setTrainers(res.trainers);
    } catch (e: any) {
      setError(e.message || "Could not load trainers");
    } finally {
      setLoading(false);
    }
  }, [token, setError]);

  useEffect(() => { void load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminApi("/api/admin/cwp/trainers", token, {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          specialty: form.specialty || null
        })
      });
      flash("Trainer added.");
      setForm(blank);
      void load();
    } catch (e2: any) {
      setError(e2.message || "Could not add trainer");
    }
  };

  const startEdit = (t: TrainerRow) => {
    setEditingId(t.id);
    setEdit({ name: t.name, specialty: t.specialty || "", password: "" });
  };

  const saveEdit = async (id: string) => {
    try {
      const payload: Record<string, unknown> = { name: edit.name, specialty: edit.specialty || null };
      if (edit.password) payload.password = edit.password;
      await adminApi(`/api/admin/cwp/trainers/${id}`, token, { method: "PATCH", body: JSON.stringify(payload) });
      flash("Trainer updated.");
      setEditingId(null);
      void load();
    } catch (e: any) {
      setError(e.message || "Could not update trainer");
    }
  };

  const setStatus = async (t: TrainerRow, accountStatus: "APPROVED" | "REJECTED") => {
    try {
      await adminApi(`/api/admin/cwp/trainers/${t.id}`, token, { method: "PATCH", body: JSON.stringify({ accountStatus }) });
      flash(accountStatus === "APPROVED" ? "Trainer reactivated." : "Trainer suspended.");
      void load();
    } catch (e: any) {
      setError(e.message || "Could not update trainer");
    }
  };

  return (
    <>
      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <h2 className="admin-panel-title">Add trainer or specialist</h2>
        <p className="admin-muted" style={{ marginBottom: 12 }}>
          Trainers can be assigned to any company&apos;s sessions from the Programs &amp; Sessions tab.
        </p>
        <form onSubmit={create}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <label className="admin-field"><span className="admin-field-label">Name</span>
              <input className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label className="admin-field"><span className="admin-field-label">Email</span>
              <input className="admin-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </label>
            <label className="admin-field"><span className="admin-field-label">Specialty</span>
              <input className="admin-input" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="e.g. Yoga · Breathwork" />
            </label>
            <label className="admin-field"><span className="admin-field-label">Temp password</span>
              <input className="admin-input" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={6} required />
            </label>
          </div>
          <div className="admin-form-actions">
            <button type="submit" className="admin-btn admin-btn-primary">Add trainer</button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="admin-loading">Loading trainers…</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Trainer</th><th>Specialty</th><th>Status</th><th>Upcoming</th><th>Total sessions</th><th /></tr>
            </thead>
            <tbody>
              {trainers.map((t) => (
                <tr key={t.id}>
                  <td>
                    {editingId === t.id ? (
                      <input className="admin-input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                    ) : (
                      <><strong>{t.name}</strong><div className="admin-muted" style={{ fontSize: 12 }}>{t.email}</div></>
                    )}
                  </td>
                  <td>
                    {editingId === t.id ? (
                      <input className="admin-input" value={edit.specialty} onChange={(e) => setEdit({ ...edit, specialty: e.target.value })} placeholder="Specialty" />
                    ) : (
                      t.specialty || "—"
                    )}
                  </td>
                  <td><StatusText status={t.accountStatus} /></td>
                  <td>
                    {t.upcomingCount === 0 ? <span className="admin-muted">None</span> : (
                      <div>
                        <strong>{t.upcomingCount}</strong>
                        <div className="admin-muted" style={{ fontSize: 12 }}>
                          {t.upcoming.slice(0, 2).map((u) => `${u.category} · ${new Date(u.dateTime).toLocaleDateString()}`).join(" · ")}
                        </div>
                      </div>
                    )}
                  </td>
                  <td>{t.sessionCount}</td>
                  <td>
                    <div className="admin-table-actions">
                      {editingId === t.id ? (
                        <>
                          <input className="admin-input admin-input-sm" style={{ maxWidth: 150 }} type="text" placeholder="Reset password" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} />
                          <button type="button" className="admin-btn admin-btn-sm admin-btn-primary" onClick={() => void saveEdit(t.id)}>Save</button>
                          <button type="button" className="admin-btn admin-btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="admin-btn admin-btn-sm" onClick={() => startEdit(t)}>Edit</button>
                          {t.accountStatus === "REJECTED" ? (
                            <button type="button" className="admin-btn admin-btn-sm" onClick={() => void setStatus(t, "APPROVED")}>Reactivate</button>
                          ) : (
                            <button type="button" className="admin-btn admin-btn-sm" onClick={() => void setStatus(t, "REJECTED")}>Suspend</button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {trainers.length === 0 && <tr className="admin-table-empty"><td colSpan={6}>No trainers yet. Add one above.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ---- Access control (HR & admins across companies) ---------------------------------
const ACCESS_ROLES = ["HR_ADMIN", "CORPORATE_ADMIN"] as const;

function AccessTab({
  token,
  companies,
  flash,
  setError
}: {
  token: string;
  companies: CompanyRow[];
  flash: (m: string) => void;
  setError: (m: string) => void;
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi<{ users: UserRow[] }>("/api/admin/cwp/users", token);
      setUsers(res.users);
    } catch (e: any) {
      setError(e.message || "Could not load access list");
    } finally {
      setLoading(false);
    }
  }, [token, setError]);

  useEffect(() => { void load(); }, [load]);

  const managers = useMemo(
    () => users.filter((u) => (ACCESS_ROLES as readonly string[]).includes(u.role)),
    [users]
  );

  const filtered = managers.filter((u) => {
    if (filterRole && u.role !== filterRole) return false;
    if (filterCompany && u.company?.id !== filterCompany) return false;
    if (filterStatus && (u.accountStatus || "APPROVED") !== filterStatus) return false;
    return true;
  });

  const patch = async (u: UserRow, body: Record<string, unknown>, msg: string) => {
    try {
      await adminApi(`/api/admin/cwp/users/${u.id}`, token, { method: "PATCH", body: JSON.stringify(body) });
      flash(msg);
      void load();
    } catch (e: any) {
      setError(e.message || "Could not update access");
    }
  };

  const resetPassword = async (u: UserRow) => {
    const pw = window.prompt(`New password for ${u.name}?`);
    if (!pw) return;
    if (pw.length < 6) { setError("Password must be at least 6 characters."); return; }
    await patch(u, { password: pw }, "Password reset.");
  };

  const pendingCount = managers.filter((u) => u.accountStatus === "PENDING").length;

  return (
    <>
      <div className="admin-help-banner">
        Control who can manage each company on the CWP platform. Approve or suspend HR &amp; corporate admins,
        change their role, or reset a password. Employees and trainers are managed in their own areas.
      </div>

      <StatRow
        items={[
          ["HR & admins", managers.length],
          ["Pending approval", pendingCount],
          ["Companies", companies.length]
        ]}
      />

      <div style={{ display: "flex", gap: 12, margin: "16px 0", flexWrap: "wrap" }}>
        <select className="admin-input" style={{ maxWidth: 200 }} value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="">All roles</option>
          {ACCESS_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="admin-input" style={{ maxWidth: 220 }} value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
          <option value="">All companies</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="admin-input" style={{ maxWidth: 200 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Suspended</option>
        </select>
      </div>

      {loading ? (
        <div className="admin-loading">Loading access list…</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Company</th><th>Role</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.email}</td>
                  <td>{u.company ? <Link to={`/admin/cwp/companies/${u.company.id}?tab=people`}>{u.company.name}</Link> : "—"}</td>
                  <td>
                    <select
                      className="admin-input admin-input-sm"
                      style={{ maxWidth: 170 }}
                      value={u.role}
                      onChange={(e) => void patch(u, { role: e.target.value }, "Role updated.")}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td><StatusText status={u.accountStatus} /></td>
                  <td>
                    <div className="admin-table-actions">
                      {u.accountStatus === "PENDING" && (
                        <button type="button" className="admin-btn admin-btn-sm admin-btn-primary" onClick={() => void patch(u, { accountStatus: "APPROVED" }, `${u.name} approved.`)}>Approve</button>
                      )}
                      {u.accountStatus === "REJECTED" ? (
                        <button type="button" className="admin-btn admin-btn-sm" onClick={() => void patch(u, { accountStatus: "APPROVED" }, "Access restored.")}>Restore</button>
                      ) : (
                        <button type="button" className="admin-btn admin-btn-sm" onClick={() => void patch(u, { accountStatus: "REJECTED" }, "Access suspended.")}>Suspend</button>
                      )}
                      <button type="button" className="admin-btn admin-btn-sm" onClick={() => void resetPassword(u)}>Reset password</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr className="admin-table-empty"><td colSpan={6}>No HR or corporate admins match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
