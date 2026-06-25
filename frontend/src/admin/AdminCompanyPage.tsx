import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Building2, RefreshCw } from "lucide-react";
import { adminApi } from "./adminApi";
import { AdminShell } from "./SiteAdminPages";
import type { UserType } from "../auth/useAuth";
import {
  COMPANY_TABS,
  ROLES,
  type CompanyDetail,
  type CompanyTab,
  type DepartmentRow,
  type EventRow,
  type FormOptions,
  type UserRow
} from "./cwp/types";

type Auth = { token: string; user: UserType | null };

export function AdminCompanyPage({ auth }: { auth: Auth }) {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab") as CompanyTab | null;
  const tab: CompanyTab = COMPANY_TABS.some((t) => t.id === rawTab) ? rawTab! : "overview";
  const setTab = (next: CompanyTab) => setSearchParams({ tab: next }, { replace: true });

  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [options, setOptions] = useState<FormOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 3000);
  };

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError("");
    try {
      const [co, opt] = await Promise.all([
        adminApi<{ company: CompanyDetail }>(`/api/admin/cwp/companies/${companyId}`, auth.token),
        adminApi<FormOptions>("/api/admin/cwp/form-options", auth.token)
      ]);
      setCompany(co.company);
      setOptions(opt);
    } catch (e: any) {
      setError(e.message || "Could not load company");
    } finally {
      setLoading(false);
    }
  }, [auth.token, companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!companyId) {
    return <Navigate to="/admin/cwp" replace />;
  }

  return (
    <AdminShell
      auth={auth}
      title={company?.name || "Company"}
      subtitle={company ? `${company.industry} · ${company.plan} plan · manage this client separately` : "Loading company…"}
      icon={Building2}
      toolbar={
        <div className="admin-db-toolbar">
          <Link to="/admin/cwp" className="admin-btn">
            <ArrowLeft style={{ width: 14, height: 14 }} />
            All companies
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
        {COMPANY_TABS.map((t) => (
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

      {loading || !company || !options ? (
        <div className="admin-loading">Loading {company?.name || "company"}…</div>
      ) : (
        <>
          {tab === "overview" && (
            <CompanyOverviewTab company={company} onNavigate={setTab} />
          )}
          {tab === "settings" && (
            <CompanySettingsTab
              company={company}
              token={auth.token}
              onSaved={() => void load()}
              flash={flash}
              setError={setError}
              onDeleted={() => navigate("/admin/cwp")}
            />
          )}
          {tab === "departments" && (
            <CompanyDepartmentsTab
              companyId={company.id}
              token={auth.token}
              onChanged={() => void load()}
              flash={flash}
              setError={setError}
            />
          )}
          {tab === "people" && (
            <CompanyPeopleTab
              companyId={company.id}
              companyName={company.name}
              departments={company.departments}
              token={auth.token}
              onChanged={() => void load()}
              flash={flash}
              setError={setError}
            />
          )}
          {tab === "events" && (
            <CompanyEventsTab
              companyId={company.id}
              options={options}
              token={auth.token}
              onChanged={() => void load()}
              flash={flash}
              setError={setError}
            />
          )}
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

function CompanyOverviewTab({
  company,
  onNavigate
}: {
  company: CompanyDetail;
  onNavigate: (tab: CompanyTab) => void;
}) {
  const pendingPeople = company.users.filter((u) => u.accountStatus === "PENDING").length;
  const pendingSchedules = company.scheduleRequests?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <>
      <StatRow
        items={[
          ["People", company.userCount],
          ["Employees", company.employeeCount],
          ["Seats used", `${company.userCount}/${company.seats}`],
          ["Departments", company.departmentCount],
          ["Upcoming events", company.upcomingEventCount],
          ["Wellness score", company.totalWellnessScore]
        ]}
      />

      {(pendingPeople > 0 || pendingSchedules > 0) && (
        <div className="admin-panel" style={{ marginTop: 20, marginBottom: 20 }}>
          <h3 className="admin-panel-title">Needs attention</h3>
          {pendingPeople > 0 && (
            <p style={{ marginBottom: 8 }}>
              <strong>{pendingPeople}</strong> user{pendingPeople === 1 ? "" : "s"} awaiting approval.{" "}
              <button type="button" className="admin-btn admin-btn-sm" onClick={() => onNavigate("people")}>Review people →</button>
            </p>
          )}
          {pendingSchedules > 0 && (
            <p>
              <strong>{pendingSchedules}</strong> pending schedule request{pendingSchedules === 1 ? "" : "s"}.
            </p>
          )}
        </div>
      )}

      <div className="admin-section-label">Recent events</div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Event</th><th>Date</th><th>Category</th><th>Booked</th><th>Status</th></tr>
          </thead>
          <tbody>
            {company.events.slice(0, 8).map((e) => (
              <tr key={e.id}>
                <td><strong>{e.title}</strong></td>
                <td>{new Date(e.dateTime).toLocaleString()}</td>
                <td>{e.category}</td>
                <td>{e.bookedCount}/{e.maxSpots}</td>
                <td>{e.status}</td>
              </tr>
            ))}
            {company.events.length === 0 && (
              <tr className="admin-table-empty"><td colSpan={5}>No events yet. Schedule one in the Events tab.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <button type="button" className="admin-btn" style={{ marginTop: 12 }} onClick={() => onNavigate("events")}>Manage events →</button>
    </>
  );
}

function CompanySettingsTab({
  company,
  token,
  onSaved,
  flash,
  setError,
  onDeleted
}: {
  company: CompanyDetail;
  token: string;
  onSaved: () => void;
  flash: (m: string) => void;
  setError: (m: string) => void;
  onDeleted: () => void;
}) {
  const [form, setForm] = useState({
    name: company.name,
    industry: company.industry,
    plan: company.plan,
    seats: String(company.seats)
  });

  useEffect(() => {
    setForm({ name: company.name, industry: company.industry, plan: company.plan, seats: String(company.seats) });
  }, [company]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminApi(`/api/admin/cwp/companies/${company.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          industry: form.industry || "General",
          plan: form.plan,
          seats: Number(form.seats) || 50
        })
      });
      flash("Company settings saved.");
      onSaved();
    } catch (e2: any) {
      setError(e2.message || "Could not save company");
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${company.name}? Only works if it has no users or events.`)) return;
    try {
      await adminApi(`/api/admin/cwp/companies/${company.id}`, token, { method: "DELETE" });
      flash("Company deleted.");
      onDeleted();
    } catch (e: any) {
      setError(e.message || "Could not delete company");
    }
  };

  return (
    <div className="admin-panel">
      <h2 className="admin-panel-title">Company settings</h2>
      <form onSubmit={save}>
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
        </div>
        <div className="admin-form-actions">
          <button type="submit" className="admin-btn admin-btn-primary">Save settings</button>
          <button type="button" className="admin-btn" onClick={() => void remove()}>Delete company</button>
        </div>
      </form>
    </div>
  );
}

function CompanyDepartmentsTab({
  companyId,
  token,
  onChanged,
  flash,
  setError
}: {
  companyId: string;
  token: string;
  onChanged: () => void;
  flash: (m: string) => void;
  setError: (m: string) => void;
}) {
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await adminApi<{ departments: DepartmentRow[] }>(`/api/admin/cwp/companies/${companyId}/departments`, token);
      setDepartments(res.departments);
    } catch (e: any) {
      setError(e.message || "Could not load departments");
    }
  }, [token, companyId, setError]);

  useEffect(() => { void load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await adminApi(`/api/admin/cwp/companies/${companyId}/departments`, token, {
        method: "POST",
        body: JSON.stringify({ name: newName.trim() })
      });
      setNewName("");
      flash("Department created.");
      void load();
      onChanged();
    } catch (e2: any) {
      setError(e2.message || "Could not create department");
    }
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await adminApi(`/api/admin/cwp/departments/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim() })
      });
      setEditingId(null);
      flash("Department renamed.");
      void load();
      onChanged();
    } catch (e: any) {
      setError(e.message || "Could not rename department");
    }
  };

  const remove = async (d: DepartmentRow) => {
    if (!window.confirm(`Delete "${d.name}"? People in this department will be unassigned.`)) return;
    try {
      await adminApi(`/api/admin/cwp/departments/${d.id}`, token, { method: "DELETE" });
      flash("Department deleted.");
      void load();
      onChanged();
    } catch (e: any) {
      setError(e.message || "Could not delete department");
    }
  };

  return (
    <>
      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <h2 className="admin-panel-title">Add department</h2>
        <form onSubmit={create} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="admin-input"
            style={{ maxWidth: 320, flex: 1 }}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. People & Culture"
            required
          />
          <button type="submit" className="admin-btn admin-btn-primary">Add department</button>
        </form>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Department</th><th>People</th><th>Employees</th><th /></tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d.id}>
                <td>
                  {editingId === d.id ? (
                    <input className="admin-input" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                  ) : (
                    <strong>{d.name}</strong>
                  )}
                </td>
                <td>{d.userCount}</td>
                <td>{d.employees}</td>
                <td>
                  <div className="admin-table-actions">
                    {editingId === d.id ? (
                      <>
                        <button type="button" className="admin-btn admin-btn-sm admin-btn-primary" onClick={() => void saveEdit(d.id)}>Save</button>
                        <button type="button" className="admin-btn admin-btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="admin-btn admin-btn-sm" onClick={() => { setEditingId(d.id); setEditName(d.name); }}>Rename</button>
                        <button type="button" className="admin-btn admin-btn-sm" onClick={() => void remove(d)}>Delete</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {departments.length === 0 && (
              <tr className="admin-table-empty"><td colSpan={4}>No departments yet. Add one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CompanyPeopleTab({
  companyId,
  companyName,
  departments,
  token,
  onChanged,
  flash,
  setError
}: {
  companyId: string;
  companyName: string;
  departments: Array<{ id: string; name: string }>;
  token: string;
  onChanged: () => void;
  flash: (m: string) => void;
  setError: (m: string) => void;
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const blank = { name: "", email: "", password: "", role: "EMPLOYEE", departmentId: "" };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterRole) params.set("role", filterRole);
      if (filterStatus) params.set("accountStatus", filterStatus);
      const qs = params.toString();
      const res = await adminApi<{ users: UserRow[] }>(
        `/api/admin/cwp/companies/${companyId}/users${qs ? `?${qs}` : ""}`,
        token
      );
      setUsers(res.users);
    } catch (e: any) {
      setError(e.message || "Could not load people");
    }
  }, [token, companyId, filterRole, filterStatus, setError]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const payload: Record<string, unknown> = {
          name: form.name,
          role: form.role,
          companyId,
          departmentId: form.departmentId || null
        };
        if (form.password) payload.password = form.password;
        const editing = users.find((u) => u.id === editingId);
        if (editing?.accountStatus === "PENDING") payload.accountStatus = "APPROVED";
        await adminApi(`/api/admin/cwp/users/${editingId}`, token, { method: "PATCH", body: JSON.stringify(payload) });
        flash(editing?.accountStatus === "PENDING" ? "User approved and updated." : "User updated.");
      } else {
        await adminApi("/api/admin/cwp/users", token, {
          method: "POST",
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            password: form.password,
            role: form.role,
            companyId,
            departmentId: form.departmentId || null
          })
        });
        flash("User added to company.");
      }
      setForm(blank);
      setEditingId(null);
      void load();
      onChanged();
    } catch (e2: any) {
      setError(e2.message || "Could not save user");
    }
  };

  const startEdit = (u: UserRow) => {
    setEditingId(u.id);
    setForm({ name: u.name, email: u.email, password: "", role: u.role, departmentId: u.departmentId || "" });
  };

  const remove = async (u: UserRow) => {
    if (!window.confirm(`Remove ${u.name} from ${companyName}?`)) return;
    try {
      await adminApi(`/api/admin/cwp/users/${u.id}`, token, { method: "DELETE" });
      flash("User removed.");
      void load();
      onChanged();
    } catch (e: any) {
      setError(e.message || "Could not delete user");
    }
  };

  const approveUser = async (u: UserRow) => {
    try {
      await adminApi(`/api/admin/cwp/users/${u.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ accountStatus: "APPROVED", role: u.role || "EMPLOYEE", companyId })
      });
      flash(`${u.name} approved.`);
      void load();
      onChanged();
    } catch (e: any) {
      setError(e.message || "Could not approve user");
    }
  };

  const rejectUser = async (u: UserRow) => {
    if (!window.confirm(`Reject access for ${u.email}?`)) return;
    try {
      await adminApi(`/api/admin/cwp/users/${u.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ accountStatus: "REJECTED" })
      });
      flash(`${u.name} rejected.`);
      void load();
    } catch (e: any) {
      setError(e.message || "Could not reject user");
    }
  };

  return (
    <>
      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <h2 className="admin-panel-title">{editingId ? "Edit person" : `Add person to ${companyName}`}</h2>
        {editingId && users.find((u) => u.id === editingId)?.accountStatus === "PENDING" && (
          <p className="admin-muted" style={{ marginBottom: 12 }}>
            Assign role and department, then save or use Approve in the table.
          </p>
        )}
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
            <label className="admin-field"><span className="admin-field-label">Department</span>
              <select className="admin-input" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">No department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
          </div>
          <div className="admin-form-actions">
            <button type="submit" className="admin-btn admin-btn-primary">{editingId ? "Save changes" : "Add person"}</button>
            {editingId && <button type="button" className="admin-btn" onClick={() => { setEditingId(null); setForm(blank); }}>Cancel</button>}
          </div>
        </form>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <select className="admin-input" style={{ maxWidth: 200 }} value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="admin-input" style={{ maxWidth: 200 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="PENDING">Pending approval</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <button type="button" className="admin-btn admin-btn-sm" onClick={() => setFilterStatus("PENDING")}>Show pending only</button>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Status</th><th>Role</th><th>Department</th><th /></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.name}</strong></td>
                <td>{u.email}</td>
                <td>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: u.accountStatus === "PENDING" ? "#b45309" : u.accountStatus === "REJECTED" ? "#b91c1c" : "#166534"
                  }}>
                    {u.accountStatus || "APPROVED"}
                  </span>
                </td>
                <td>{u.role}</td>
                <td>{u.department?.name || "—"}</td>
                <td>
                  <div className="admin-table-actions">
                    {u.accountStatus === "PENDING" && (
                      <>
                        <button type="button" className="admin-btn admin-btn-sm admin-btn-primary" onClick={() => startEdit(u)}>Assign</button>
                        <button type="button" className="admin-btn admin-btn-sm" onClick={() => void approveUser(u)}>Approve</button>
                        <button type="button" className="admin-btn admin-btn-sm" onClick={() => void rejectUser(u)}>Reject</button>
                      </>
                    )}
                    {u.accountStatus !== "PENDING" && (
                      <button type="button" className="admin-btn admin-btn-sm" onClick={() => startEdit(u)}>Edit</button>
                    )}
                    <button type="button" className="admin-btn admin-btn-sm" onClick={() => void remove(u)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr className="admin-table-empty"><td colSpan={6}>No people in this company yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CompanyEventsTab({
  companyId,
  options,
  token,
  onChanged,
  flash,
  setError
}: {
  companyId: string;
  options: FormOptions;
  token: string;
  onChanged: () => void;
  flash: (m: string) => void;
  setError: (m: string) => void;
}) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const blank = {
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
      const res = await adminApi<{ events: EventRow[] }>(`/api/admin/cwp/companies/${companyId}/events`, token);
      setEvents(res.events);
    } catch (e: any) {
      setError(e.message || "Could not load events");
    }
  }, [token, companyId, setError]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.categoryId || !form.title || !form.dateTime) {
      setError("Category, title and date/time are required.");
      return;
    }
    try {
      await adminApi("/api/admin/cwp/events", token, {
        method: "POST",
        body: JSON.stringify({
          companyId,
          categoryId: form.categoryId,
          title: form.title,
          dateTime: new Date(form.dateTime).toISOString(),
          trainerId: form.trainerId || null,
          locationType: form.locationType,
          locationDetail: form.locationDetail || null,
          maxSpots: Number(form.maxSpots) || 30
        })
      });
      flash("Event scheduled.");
      setForm(blank);
      void load();
      onChanged();
    } catch (e2: any) {
      setError(e2.message || "Could not create event");
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this event?")) return;
    try {
      await adminApi(`/api/admin/cwp/events/${id}`, token, { method: "DELETE" });
      flash("Event deleted.");
      void load();
      onChanged();
    } catch (e: any) {
      setError(e.message || "Could not delete event");
    }
  };

  return (
    <>
      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <h2 className="admin-panel-title">Schedule event</h2>
        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
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

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Event</th><th>Date</th><th>Category</th><th>Trainer</th><th>Booked</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td><strong>{e.title}</strong></td>
                <td>{new Date(e.dateTime).toLocaleString()}</td>
                <td>{e.category}</td>
                <td>{e.trainer || "—"}</td>
                <td>{e.bookedCount}/{e.maxSpots}</td>
                <td>{e.status}</td>
                <td><button type="button" className="admin-btn admin-btn-sm" onClick={() => void remove(e.id)}>Delete</button></td>
              </tr>
            ))}
            {events.length === 0 && <tr className="admin-table-empty"><td colSpan={7}>No events for this company yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
