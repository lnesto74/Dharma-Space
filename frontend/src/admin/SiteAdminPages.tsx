import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  BookOpen,
  Building2,
  CalendarDays,
  ExternalLink,
  GraduationCap,
  LayoutGrid,
  List,
  Mail,
  Plus,
  RefreshCw,
  Shield,
  Ticket,
  Type
} from "lucide-react";
import { adminApi, checkAdminApiHealth } from "./adminApi";
import {
  defaultDurationForCategory,
  durationFieldHint,
  durationPresetsForCategory,
  EVENT_WORKSHOP_DURATIONS,
  TRAINING_DURATIONS
} from "../lib/program-duration";

type Auth = {
  token: string;
  user: { name: string; role: string } | null;
};

type PageIcon = typeof Shield;

function StatusPill({ variant, label }: { variant: "green" | "blue" | "gray" | "orange" | "purple"; label: string }) {
  return (
    <span className={`admin-pill admin-pill-${variant}`}>
      <span className="admin-pill-dot" />
      {label}
    </span>
  );
}

function livePill(published: boolean) {
  return published
    ? <StatusPill variant="green" label="Live" />
    : <StatusPill variant="gray" label="Draft" />;
}

function inquiryStatusPill(status: string) {
  if (status === "NEW") return <StatusPill variant="blue" label="New" />;
  if (status === "READ") return <StatusPill variant="gray" label="Read" />;
  if (status === "ARCHIVED") return <StatusPill variant="orange" label="Archived" />;
  return <StatusPill variant="gray" label={status} />;
}


type InquiryField = { label: string; value: string; href?: string };

function inquiryDetailFields(item: any): InquiryField[] {
  const p = item.payload || {};
  const rows: InquiryField[] = [];
  const add = (label: string, value: unknown, href?: string) => {
    if (value == null || value === "") return;
    rows.push({ label, value: String(value), href });
  };

  add("Email", item.email, `mailto:${item.email}`);
  add("Phone", item.phone, item.phone ? `tel:${String(item.phone).replace(/\s/g, "")}` : undefined);
  add("Subject", item.subject);
  add("Program / class", p.title);
  add("Price", p.price);
  add("Amount", p.amount);
  add("Date", p.date);
  add("Time", p.time);
  add("Location", p.location);
  add("Facilitator", p.facilitator);
  add("Booking type", p.bookingType);
  add("Payment reference", p.reference);
  add("PayNow UEN", p.uen);
  add("Guests", p.guests);
  add("Audience", item.audienceType ? String(item.audienceType).replace(/^./, (c: string) => c.toUpperCase()) : null);
  add("Company", p.companyName);
  add("Team size", p.employeeCount);
  add("Interest", p.interest);
  add("Program ID", item.siteProgramId);
  add("Notes", p.notes);
  if (item.message && item.message !== p.notes) add("Message", item.message);

  return rows;
}

function paymentTagPill(tag: string) {
  const normalized = tag?.toLowerCase() || "";
  if (normalized === "paid") return <StatusPill variant="green" label="Paid" />;
  if (normalized === "not paid") return <StatusPill variant="orange" label="Not paid" />;
  if (normalized === "waitlist") return <StatusPill variant="purple" label="Waitlist" />;
  return <StatusPill variant="gray" label={tag || "—"} />;
}

function segmentPill(label: string) {
  return <StatusPill variant="blue" label={label} />;
}

function typeTag(type: string) {
  const map: Record<string, "purple" | "blue" | "green" | "orange" | "gray"> = {
    CONTACT: "blue",
    CWP_DEMO: "green",
    WAITLIST: "purple",
    CLASS_WAITLIST: "purple",
    CLASS_SCHEDULE_NOTIFY: "purple",
    BOOKING_PAYMENT: "orange",
    BOOKING_INTENT: "orange",
    BOOKING_CONFIRMED: "green"
  };
  const v = map[type] || "gray";
  return <span className={`admin-pill admin-pill-${v}`}>{type.replace(/_/g, " ")}</span>;
}

export function AdminShell({
  auth,
  title,
  subtitle,
  icon: Icon,
  children,
  toolbar
}: {
  auth: Auth;
  title: string;
  subtitle?: string;
  icon: PageIcon;
  children: ReactNode;
  toolbar?: ReactNode;
}) {
  const [apiDown, setApiDown] = useState<string | null>(null);

  useEffect(() => {
    checkAdminApiHealth().then(({ ok, message }) => setApiDown(ok ? null : message || "Backend offline"));
  }, []);

  const nav = [
    ["Overview", "/admin", Shield],
    ["CWP Platform", "/admin/cwp", Building2],
    ["Bookings", "/admin/bookings", Ticket],
    ["Inquiries", "/admin/inquiries", Mail],
    ["Trainers", "/admin/site/trainers", GraduationCap],
    ["Regular Class Schedule", "/admin/site/classes", CalendarDays],
    ["Education & Events", "/admin/site/programs", BookOpen]
  ] as const;

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <Link to="/" className="admin-workspace">
          <div className="admin-workspace-icon">D</div>
          <span className="admin-workspace-name">Dharma Space</span>
        </Link>

        <div className="admin-nav-section">Website</div>
        <nav className="admin-nav">
          {nav.map(([label, to, NavIcon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/admin"}
              className={({ isActive }) => `admin-nav-link${isActive ? " active" : ""}`}
            >
              <NavIcon />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-spacer" />

        <div className="admin-sidebar-footer">
          <Link to="/">
            <ExternalLink style={{ width: 14, height: 14 }} />
            Back to website
          </Link>
        </div>
      </aside>

      <div className="admin-main">
        <div className="admin-topbar">
          <span className="admin-topbar-meta">{auth.user?.name}</span>
        </div>

        <div className="admin-page">
          <div className="admin-page-title">
            <Icon className="admin-page-title-icon" style={{ width: 28, height: 28, opacity: 0.85 }} strokeWidth={1.75} />
            <h1>{title}</h1>
          </div>
          {subtitle && <p className="admin-page-desc">{subtitle}</p>}
          {toolbar}
          <div className="admin-content">
            {apiDown && (
              <div className="admin-alert admin-alert-warn" style={{ marginBottom: 16 }}>
                {apiDown}
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminOverviewPage({ auth }: { auth: Auth }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi<any>("/api/admin/site/overview", auth.token).then(setData).catch((e) => setError(e.message));
  }, [auth.token]);

  const stats = [
    { label: "New inquiries", value: data?.newInquiries ?? "—", to: "/admin/inquiries" },
    { label: "CWP Platform", value: "Manage", to: "/admin/cwp" },
    { label: "Bookings", value: "View roster", to: "/admin/bookings" },
    { label: "Trainers", value: data?.trainers ?? "—", to: "/admin/site/trainers" },
    { label: "Regular classes", value: data?.classes ?? "—", to: "/admin/site/classes" },
    { label: "Education & events", value: data?.programs ?? "—", to: "/admin/site/programs" },
  ];

  const links = [
    ["CWP Platform", "Companies, wellness events, schedule requests", "/admin/cwp"],
    ["Bookings", "Paid / unpaid rosters by class, workshop, or event", "/admin/bookings"],
    ["Inquiries", "Contact form, waitlists, PayNow bookings", "/admin/inquiries"],
    ["Trainers", "Specialist profiles on About page", "/admin/site/trainers"],
    ["Regular class schedule", "Weekly yoga & wellness timetable", "/admin/site/classes"],
    ["Education & events", "YTT, certifications, workshops, events", "/admin/site/programs"]
  ] as const;

  return (
    <AdminShell auth={auth} title="Overview" icon={Shield}>
      {error && <div className="admin-alert">{error}</div>}
      <div className="admin-stat-row">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="admin-stat">
            <div className="admin-stat-label">{s.label}</div>
            <div className="admin-stat-value">{s.value}</div>
          </Link>
        ))}
      </div>
      <div className="admin-section-label">Quick links</div>
      <div className="admin-link-list">
        {links.map(([name, desc, to]) => (
          <Link key={to} to={to} className="admin-link-row">
            <strong>{name}</strong>
            <span>— {desc}</span>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}

function DurationPresetField({
  label,
  value,
  presets,
  hint,
  onChange
}: {
  label: string;
  value: string;
  presets: string[];
  hint?: string;
  onChange: (value: string) => void;
}) {
  const [usePreset, setUsePreset] = useState(() => !value || presets.includes(value));

  useEffect(() => {
    if (value && presets.includes(value)) setUsePreset(true);
  }, [presets, value]);

  return (
    <label className="admin-field">
      <span className="admin-field-label">{label}</span>
      <div className="admin-preset-row">
        <button
          type="button"
          className="admin-preset-toggle"
          title={usePreset ? "Type manually" : "Pick from list"}
          onClick={() => setUsePreset((prev) => !prev)}
        >
          {usePreset ? <List size={14} /> : <Type size={14} />}
        </button>
        {usePreset ? (
          <select value={value} onChange={(e) => onChange(e.target.value)} className="admin-input">
            <option value="">Select…</option>
            {presets.map((item) => <option key={item} value={item}>{item}</option>)}
            {value && !presets.includes(value) ? <option value={value}>{value}</option> : null}
          </select>
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="admin-input"
            placeholder={hint ? "Custom duration" : `Enter ${label.toLowerCase()}`}
          />
        )}
      </div>
      {hint && <span className="admin-field-hint">{hint}</span>}
    </label>
  );
}

function CrudPage({
  auth,
  title,
  subtitle,
  icon,
  endpoint,
  fields,
  columns,
  emptyLabel,
  mapRow,
  defaultItem
}: {
  auth: Auth;
  title: string;
  subtitle: string;
  icon: PageIcon;
  endpoint: string;
  fields: { key: string; label: string; type?: string; options?: string[]; optionsByCategory?: Record<string, string[]> }[];
  columns: string[];
  emptyLabel: string;
  mapRow: (item: any) => ReactNode[];
  defaultItem: Record<string, unknown>;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<Record<string, unknown>>(defaultItem);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminApi<any>(endpoint, auth.token)
      .then((data) => setItems(data.trainers || data.classes || data.programs || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [auth.token]);

  const startNew = () => {
    setEditingId(null);
    const next = { ...defaultItem };
    const category = String(next.category ?? "CERTIFICATION");
    if (!next.duration) next.duration = defaultDurationForCategory(category);
    setForm(next);
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    const next = { ...item };
    if (Array.isArray(next.curriculumItems)) {
      next.curriculumItems = next.curriculumItems.join("\n");
    }
    setForm(next);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (editingId) {
        await adminApi(`${endpoint}/${editingId}`, auth.token, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await adminApi(endpoint, auth.token, { method: "POST", body: JSON.stringify(form) });
      }
      setForm(defaultItem);
      setEditingId(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    await adminApi(`${endpoint}/${id}`, auth.token, { method: "DELETE" });
    if (editingId === id) {
      setEditingId(null);
      setForm(defaultItem);
    }
    load();
  };

  const toolbar = (
    <div className="admin-view-tabs">
      <button type="button" className="admin-view-tab active">
        <LayoutGrid /> Table
      </button>
      <button type="button" className="admin-view-tab">
        <List /> All
      </button>
    </div>
  );

  return (
    <AdminShell auth={auth} title={title} subtitle={subtitle} icon={icon} toolbar={toolbar}>
      {error && <div className="admin-alert">{error}</div>}

      <div className="admin-layout-split">
        <div className="admin-layout-main">
          <div className="admin-db-toolbar">
            <span style={{ fontSize: 13, color: "var(--admin-text-tertiary)" }}>{emptyLabel}</span>
            <div className="admin-db-toolbar-spacer" />
            <button type="button" onClick={load} className="admin-btn">
              <RefreshCw style={{ width: 14, height: 14 }} />
              Refresh
            </button>
            <button type="button" onClick={startNew} className="admin-btn admin-btn-primary">
              <Plus style={{ width: 14, height: 14 }} />
              New
            </button>
          </div>

          {loading ? (
            <div className="admin-loading">Loading…</div>
          ) : (
            <div className="admin-db">
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      {columns.map((c) => <th key={c}>{c}</th>)}
                      <th style={{ width: 80 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className={editingId === item.id ? "admin-row-selected" : undefined}
                        onClick={() => startEdit(item)}
                      >
                        {mapRow(item).map((cell, i) => (
                          <td key={i} className={i === 0 ? "admin-td-name" : undefined}>{cell}</td>
                        ))}
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="admin-table-actions">
                            <button type="button" onClick={() => startEdit(item)} className="admin-btn">Edit</button>
                            <button type="button" onClick={() => remove(item.id)} className="admin-btn admin-btn-danger">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!items.length && (
                      <tr className="admin-table-empty">
                        <td colSpan={columns.length + 1}>No items yet — click New to add one.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="admin-panel">
          <h2 className="admin-panel-title">{editingId ? "Edit properties" : "New item"}</h2>
          <form onSubmit={save}>
            {fields.map(({ key, label, type = "text", options, optionsByCategory }) => {
              const category = String(form.category ?? "");
              const categoryOptions = optionsByCategory?.[category] ?? options;

              if (key === "category" && options) {
                return (
                  <label key={key} className="admin-field">
                    <span className="admin-field-label">{label}</span>
                    <select
                      value={String(form[key] ?? "")}
                      onChange={(e) => {
                        const nextCategory = e.target.value;
                        const presets = durationPresetsForCategory(nextCategory);
                        const currentDuration = String(form.duration ?? "");
                        const next: Record<string, unknown> = { ...form, [key]: nextCategory };
                        if (!currentDuration || !presets.includes(currentDuration)) {
                          next.duration = defaultDurationForCategory(nextCategory);
                        }
                        setForm(next);
                      }}
                      className="admin-input"
                    >
                      {options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>
                );
              }

              if (optionsByCategory) {
                const presets = categoryOptions ?? [];
                const value = String(form[key] ?? "");
                const hint = key === "duration" ? durationFieldHint(category) : undefined;
                return (
                  <DurationPresetField
                    key={key}
                    label={label}
                    value={value}
                    presets={presets}
                    hint={hint}
                    onChange={(nextValue) => setForm({ ...form, [key]: nextValue })}
                  />
                );
              }

              return options ? (
                <label key={key} className="admin-field">
                  <span className="admin-field-label">{label}</span>
                  <select value={String(form[key] ?? "")} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="admin-input">
                    {options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
              ) : type === "checkbox" ? (
                <label key={key} className="admin-field-checkbox">
                  <input type="checkbox" checked={Boolean(form[key])} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
                  {label}
                </label>
              ) : type === "textarea" ? (
                <label key={key} className="admin-field">
                  <span className="admin-field-label">{label}</span>
                  <textarea rows={3} value={String(form[key] ?? "")} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="admin-textarea" />
                </label>
              ) : (
                <label key={key} className="admin-field">
                  <span className="admin-field-label">{label}</span>
                  <input type={type} value={String(form[key] ?? "")} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="admin-input" />
                </label>
              );
            })}
            <div className="admin-form-actions">
              <button type="submit" className="admin-btn admin-btn-primary">Save</button>
              {editingId && (
                <button type="button" onClick={() => { setEditingId(null); setForm(defaultItem); }} className="admin-btn">Cancel</button>
              )}
            </div>
          </form>
        </div>
      </div>
    </AdminShell>
  );
}

export function AdminInquiriesPage({ auth }: { auth: Auth }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [mailTest, setMailTest] = useState("");
  const [mailTesting, setMailTesting] = useState(false);

  const load = () => {
    if (!auth.token) {
      setError("Not signed in. Log out and sign in again from the website Admin menu.");
      setData({ submissions: [], mailConfigured: { corporate: false, education: false } });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    adminApi<any>("/api/inquiries", auth.token)
      .then((result) => setData(result))
      .catch((e) => {
        setError(e.message);
        setData({ submissions: [], mailConfigured: { corporate: false, education: false } });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [auth.token]);

  const allSubmissions = data?.submissions || [];
  const submissions = allSubmissions.filter((item: any) => {
    if (filter !== "ALL" && item.segment !== filter) return false;
    if (paymentFilter === "ALL") return true;
    return item.paymentStatus === paymentFilter;
  });
  const mail = data?.mailConfigured || { corporate: false, education: false };
  const newCount = allSubmissions.filter((s: any) => s.status === "NEW").length;
  const notPaidCount = allSubmissions.filter((s: any) => s.paymentStatus === "NOT_PAID").length;
  const unpaidBookingCount = allSubmissions.filter(
    (s: any) => (s.type === "BOOKING_PAYMENT" || s.type === "BOOKING_INTENT") && s.paymentStatus === "NOT_PAID"
  ).length;

  function canMarkPaid(item: { type?: string; paymentStatus?: string }) {
    return (item.type === "BOOKING_PAYMENT" || item.type === "BOOKING_INTENT") && item.paymentStatus !== "PAID";
  }

  const markStatus = async (id: string, status: string) => {
    await adminApi(`/api/inquiries/${id}`, auth.token, { method: "PATCH", body: JSON.stringify({ status }) });
    load();
  };

  const markPaid = async (id: string) => {
    setMarkingPaidId(id);
    setError("");
    try {
      await adminApi(`/api/inquiries/${id}/mark-paid`, auth.token, { method: "POST" });
      load();
    } catch (e: any) {
      setError(e.message || "Could not mark booking as paid.");
    } finally {
      setMarkingPaidId(null);
    }
  };

  const testMail = async (category: "corporate" | "education" | "both") => {
    setMailTesting(true);
    setMailTest("");
    setError("");
    try {
      const result = await adminApi<{
        results: Array<{ category: string; ok: boolean; inbox?: string; error?: string }>;
        customer?: { ok: boolean; to: string; error?: string };
      }>(
        "/api/admin/test-mail",
        auth.token,
        { method: "POST", body: JSON.stringify({ category, customerEmail: "vera@dharma-space.com" }) }
      );
      const summary = [
        ...result.results.map((r) => `${r.category}: ${r.ok ? `sent to ${r.inbox}` : r.error || "failed"}`),
        result.customer
          ? `customer: ${result.customer.ok ? `confirmation sent to ${result.customer.to}` : result.customer.error || "failed"}`
          : null
      ]
        .filter(Boolean)
        .join(" · ");
      setMailTest(summary);
      load();
    } catch (e: any) {
      setError(e.message || "Mail test failed.");
    } finally {
      setMailTesting(false);
    }
  };

  const filters = [
    ["ALL", "All"],
    ["CORPORATE", "Corporate"],
    ["CWP", "CWP Platform"],
    ["FLAGSHIP", "Flagship Training"],
    ["COURSE", "Courses"],
    ["WORKSHOP", "Workshops"],
    ["EVENT", "Events"],
    ["REGULAR_CLASS", "Regular Classes"]
  ] as const;

  const paymentFilters = [
    ["ALL", "All payments"],
    ["WAITLIST", "Waitlist"],
    ["NOT_PAID", "Not paid"],
    ["PAID", "Paid"]
  ] as const;


  const toolbar = (
    <>
      <div className="admin-view-tabs">
        {filters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`admin-view-tab${filter === key ? " active" : ""}`}
            onClick={() => setFilter(key)}
          >
            <Mail style={{ width: 14, height: 14 }} />
            {label}
          </button>
        ))}
      </div>
      <div className="admin-view-tabs" style={{ marginTop: 8 }}>
        {paymentFilters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`admin-view-tab${paymentFilter === key ? " active" : ""}`}
            onClick={() => setPaymentFilter(key)}
          >
            {label}
            {key === "NOT_PAID" && notPaidCount > 0 ? ` (${notPaidCount})` : ""}
          </button>
        ))}
      </div>
    </>
  );

  return (
    <AdminShell auth={auth} title="Inbox" subtitle={`${submissions.length} submission${submissions.length === 1 ? "" : "s"}${newCount ? ` · ${newCount} unread` : ""}`} icon={Mail} toolbar={toolbar}>
      {(!mail.corporate || !mail.education) && (
        <div className="admin-alert admin-alert-warn">
          <strong>Email not sending.</strong> Submissions are saved to this inbox, but confirmation emails need Google Workspace app passwords in <code>backend/.env</code>:
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            {!mail.education && <li><strong>SMTP_EDUCATION_PASS</strong> for education@dharma-space.com (bookings, waitlists, events)</li>}
            {!mail.corporate && <li><strong>SMTP_CORPORATE_PASS</strong> for corporate@dharma-space.com (contact form)</li>}
          </ul>
          <p style={{ margin: "8px 0 0" }}>Google Account → Security → 2-Step Verification → App passwords → Mail. Restart backend after saving.</p>
        </div>
      )}
      {mailTest && <div className="admin-alert">{mailTest}</div>}
      {error && <div className="admin-alert">{error}</div>}

      <div className="admin-alert" style={{ marginBottom: 16, background: "var(--admin-gray-bg)", border: "none", color: "var(--admin-text-secondary)" }}>
        <strong style={{ color: "var(--admin-text)" }}>Payment tags:</strong>{" "}
        <strong>Waitlist</strong> = Reserve Spot (coming soon, no payment yet).{" "}
        <strong>Not paid</strong> = Stripe checkout started (<strong>BOOKING INTENT</strong>) or PayNow submitted (<strong>BOOKING PAYMENT</strong>) — awaiting verification.{" "}
        <strong>Paid</strong> = confirmed booking.
        {unpaidBookingCount > 0 && (
          <> Use <strong>Mark as paid</strong> after you verify payment ({unpaidBookingCount} pending).</>
        )}
      </div>

      <div className="admin-db-toolbar">
        <div className="admin-db-toolbar-spacer" />
        <button type="button" onClick={() => testMail("education")} disabled={mailTesting} className="admin-btn">
          Test education mail
        </button>
        <button type="button" onClick={() => testMail("corporate")} disabled={mailTesting} className="admin-btn">
          Test corporate mail
        </button>
        <button type="button" onClick={load} className="admin-btn">
          <RefreshCw style={{ width: 14, height: 14 }} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="admin-loading">Loading…</div>
      ) : error ? null : submissions.length === 0 ? (
        <div className="admin-empty">
          {filter === "ALL" && paymentFilter === "ALL"
            ? "No submissions yet."
            : `No submissions match the current filters.`}
        </div>
      ) : (
        <div className="admin-inbox">
          {submissions.map((item: any) => {
            const details = inquiryDetailFields(item);
            const isUnread = item.status === "NEW";
            return (
              <div key={item.id} className={`admin-inbox-row${isUnread ? " unread" : ""}`}>
                <span className={`admin-inbox-dot${isUnread ? "" : " read"}`} />
                <div className="admin-inbox-body">
                  <div className="admin-inbox-title">{item.name}</div>
                  {details.length > 0 && (
                    <dl className="admin-inbox-details">
                      {details.map(({ label, value, href }) => (
                        <div key={label} className="admin-inbox-detail">
                          <dt>{label}</dt>
                          <dd>
                            {href ? (
                              <a href={href} className="admin-inbox-detail-link">{value}</a>
                            ) : (
                              value
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {item.segmentLabel && segmentPill(item.segmentLabel)}
                    {item.paymentTag && paymentTagPill(item.paymentTag)}
                    {typeTag(item.type)}
                    {inquiryStatusPill(item.status)}
                    {item.emailSent ? <StatusPill variant="green" label="Sent" /> : <StatusPill variant="gray" label="Not sent" />}
                  </div>
                </div>
                <div className="admin-inbox-meta">
                  <span className="admin-inbox-time">
                    {new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="admin-tag" title="Team inbox">{item.inbox}</span>
                  <div className="admin-inbox-actions">
                    {canMarkPaid(item) && (
                      <button
                        type="button"
                        onClick={() => markPaid(item.id)}
                        disabled={markingPaidId === item.id}
                        className="admin-btn admin-btn-primary"
                      >
                        {markingPaidId === item.id ? "Marking…" : "Mark as paid"}
                      </button>
                    )}
                    {item.status !== "READ" && (
                      <button type="button" onClick={() => markStatus(item.id, "READ")} className="admin-btn">Mark read</button>
                    )}
                    {item.status !== "ARCHIVED" && (
                      <button type="button" onClick={() => markStatus(item.id, "ARCHIVED")} className="admin-btn">Archive</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}

type BookingRow = {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  guests: number;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  price: string;
  refundable?: boolean;
  refundedAt?: string | null;
  createdAt: string;
};

type OfferingGroup = {
  key: string;
  offeringTitle: string;
  category: string;
  scheduledLabel: string;
  paidCount: number;
  unpaidCount: number;
  guestTotal: number;
  bookings: BookingRow[];
};

export function AdminBookingsPage({ auth }: { auth: Auth }) {
  const [data, setData] = useState<{ totals: { bookings: number; paid: number; awaitingPayment: number }; offerings: OfferingGroup[] } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError("");
    setNotice("");
    adminApi<{ totals: { bookings: number; paid: number; awaitingPayment: number }; offerings: OfferingGroup[] }>(
      "/api/admin/bookings/overview",
      auth.token
    )
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [auth.token]);

  const markPaid = async (id: string) => {
    setMarkingPaidId(id);
    try {
      await adminApi(`/api/admin/bookings/${id}/mark-paid`, auth.token, { method: "POST" });
      load();
    } catch (e: any) {
      setError(e.message || "Could not mark booking as paid.");
    } finally {
      setMarkingPaidId(null);
    }
  };

  const cancelBooking = async (booking: BookingRow) => {
    if (!window.confirm(`Cancel booking ${booking.reference} for ${booking.customerName}?`)) return;
    setActingId(booking.id);
    setError("");
    setNotice("");
    try {
      await adminApi(`/api/admin/bookings/${booking.id}/cancel`, auth.token, { method: "PATCH" });
      load();
    } catch (e: any) {
      setError(e.message || "Could not cancel booking.");
    } finally {
      setActingId(null);
    }
  };

  const refundBooking = async (booking: BookingRow) => {
    const payNowNote =
      booking.paymentMethod === "PAYNOW"
        ? "\n\nPayNow: you will need to send the refund to the customer manually. This only updates the roster."
        : "\n\nStripe will return the payment to the customer's card or PayNow.";
    if (!window.confirm(`Refund booking ${booking.reference} for ${booking.customerName}?${payNowNote}`)) return;
    setActingId(booking.id);
    setError("");
    setNotice("");
    try {
      const result = await adminApi<{ message?: string }>(`/api/admin/bookings/${booking.id}/refund`, auth.token, { method: "POST" });
      if (result.message) setNotice(result.message);
      load();
    } catch (e: any) {
      setError(e.message || "Could not refund booking.");
    } finally {
      setActingId(null);
    }
  };

  const bookingStatusPill = (booking: BookingRow) => {
    if (booking.status === "REFUNDED") return <StatusPill variant="purple" label="Refunded" />;
    if (booking.status === "CANCELLED") return <StatusPill variant="gray" label="Cancelled" />;
    if (booking.status === "PAID") return <StatusPill variant="green" label="Paid" />;
    return <StatusPill variant="orange" label="Not paid" />;
  };

  return (
    <AdminShell
      auth={auth}
      title="Bookings"
      subtitle="Roster by offering — names, guest count, paid / not paid"
      icon={Ticket}
      toolbar={
        <button type="button" className="admin-btn" onClick={load}>
          <RefreshCw style={{ width: 14, height: 14 }} />
          Refresh
        </button>
      }
    >
      {error && <div className="admin-alert">{error}</div>}
      {notice && <div className="admin-alert admin-alert-success">{notice}</div>}
      {loading ? (
        <p className="admin-muted">Loading bookings…</p>
      ) : !data?.offerings.length ? (
        <p className="admin-muted">No bookings yet. New member bookings will appear here once customers sign in and book.</p>
      ) : (
        <>
          <div className="admin-stat-row">
            <div className="admin-stat"><div className="admin-stat-label">Total bookings</div><div className="admin-stat-value">{data.totals.bookings}</div></div>
            <div className="admin-stat"><div className="admin-stat-label">Paid</div><div className="admin-stat-value">{data.totals.paid}</div></div>
            <div className="admin-stat"><div className="admin-stat-label">Awaiting payment</div><div className="admin-stat-value">{data.totals.awaitingPayment}</div></div>
          </div>

          <div className="admin-list">
            {data.offerings.map((offering) => (
              <div key={offering.key} className="admin-card">
                <button
                  type="button"
                  className="admin-card-header admin-card-header-btn"
                  onClick={() => setExpanded(expanded === offering.key ? null : offering.key)}
                >
                  <div>
                    <div className="admin-card-title">{offering.offeringTitle}</div>
                    <div className="admin-card-subtitle">
                      {offering.category.replace(/_/g, " ")} · {offering.scheduledLabel || "Schedule TBC"}
                    </div>
                  </div>
                  <div className="admin-card-meta">
                    <StatusPill variant="green" label={`${offering.paidCount} paid`} />
                    <StatusPill variant="orange" label={`${offering.unpaidCount} unpaid`} />
                    <StatusPill variant="gray" label={`${offering.guestTotal} guests`} />
                  </div>
                </button>

                {expanded === offering.key && (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Guests</th>
                          <th>Status</th>
                          <th>Reference</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {offering.bookings.map((booking) => (
                          <tr key={booking.id}>
                            <td>{booking.customerName}</td>
                            <td>{booking.customerEmail}</td>
                            <td>{booking.guests}</td>
                            <td>{bookingStatusPill(booking)}</td>
                            <td>{booking.reference}</td>
                            <td>
                              <div className="admin-action-row">
                                {booking.status === "AWAITING_PAYMENT" && (
                                  <>
                                    <button
                                      type="button"
                                      className="admin-btn admin-btn-primary"
                                      disabled={markingPaidId === booking.id || actingId === booking.id}
                                      onClick={() => markPaid(booking.id)}
                                    >
                                      {markingPaidId === booking.id ? "Saving…" : "Mark paid"}
                                    </button>
                                    <button
                                      type="button"
                                      className="admin-btn admin-btn-danger"
                                      disabled={actingId === booking.id}
                                      onClick={() => cancelBooking(booking)}
                                    >
                                      {actingId === booking.id ? "…" : "Cancel"}
                                    </button>
                                  </>
                                )}
                                {booking.refundable && (
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn-danger"
                                    disabled={actingId === booking.id}
                                    onClick={() => refundBooking(booking)}
                                  >
                                    {actingId === booking.id ? "Refunding…" : "Refund"}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </AdminShell>
  );
}
