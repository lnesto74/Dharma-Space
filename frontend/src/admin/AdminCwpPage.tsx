import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, ExternalLink, Mail, RefreshCw } from "lucide-react";
import { adminApi } from "./adminApi";
import { AdminShell } from "./SiteAdminPages";
import type { UserType } from "../auth/useAuth";
import type { CompanyRow } from "./cwp/types";

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

type Tab = "overview" | "companies" | "analytics";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "companies", label: "Companies" },
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
      const [ov, co, sr] = await Promise.all([
        adminApi<Overview>("/api/admin/cwp/overview", auth.token),
        adminApi<{ companies: CompanyRow[] }>("/api/admin/cwp/companies", auth.token),
        adminApi<{ requests: ScheduleRequest[] }>("/api/admin/cwp/schedule-requests?status=pending", auth.token)
      ]);
      setOverview(ov);
      setCompanies(co.companies);
      setRequests(sr.requests);
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
