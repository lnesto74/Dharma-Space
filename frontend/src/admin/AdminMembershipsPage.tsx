import { FormEvent, useCallback, useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { AdminShell } from "./SiteAdminPages";
import { adminApi } from "./adminApi";

type Auth = { token: string; user: { name: string; role: string } | null };

type Tab = "overview" | "members" | "plans";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "members", label: "Members" },
  { id: "plans", label: "Plans & Pricing" }
];

const STATUS_FILTERS = [
  "ALL",
  "ACTIVE",
  "FROZEN",
  "PENDING_CANCEL",
  "PAYMENT_FAILED",
  "CANCELLED"
] as const;

type TierRow = {
  id: string;
  name: string;
  tierGroup: string;
  monthlyPriceCents: number;
  includedSessionsPerMonth: number | null;
  allowedCategories: string[];
  guestPassesPerMonth: number;
  priorityBookingDays: number;
  trainingDiscountCents: number;
  trainingDiscountPercent: number;
  maxMembers: number | null;
  rateHeldMonths: number | null;
  notes: string;
  isActive: boolean;
  sortOrder: number;
  memberCount: number;
  soldOut: boolean;
};

type MembershipRow = {
  id: string;
  status: string;
  member: { id: string; name: string; email: string; phone: string | null };
  tier: TierRow;
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  minimumTermEndsAt: string;
  cancelEffectiveAt: string | null;
  freezeEndsAt: string | null;
  effectivePriceCents: number;
  priceCentsOverride: number | null;
  notes: string;
  currentPeriod: {
    id: string;
    sessionsIncluded: number | null;
    sessionsUsed: number;
    sessionsRolledIn: number;
    guestPassesUsed: number;
    sessionsRemaining: number | null;
  } | null;
};

type MemberOption = { id: string; name: string; email: string; currentTier: string | null };

type Overview = {
  kpis: {
    activeCount: number;
    frozenCount: number;
    pendingCancelCount: number;
    cancelledCount: number;
    paymentFailedCount: number;
    monthlyRevenueCents: number;
    foundingFiftyUsed: number;
    foundingFiftyRemaining: number;
  };
  byTier: Array<{
    id: string;
    name: string;
    tierGroup: string;
    monthlyPriceCents: number;
    activeCount: number;
    totalCount: number;
  }>;
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}

function shortDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function statusPill(status: string) {
  const tone =
    status === "ACTIVE"
      ? "admin-pill-green"
      : status === "FROZEN"
        ? "admin-pill-blue"
        : status === "PENDING_CANCEL"
          ? "admin-pill-orange"
          : status === "PAYMENT_FAILED"
            ? "admin-pill-orange"
            : "admin-pill-gray";
  return (
    <span className={`admin-pill ${tone}`}>
      <span className="admin-pill-dot" />
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}

function groupPill(group: string) {
  const tone =
    group === "FLOW"
      ? "admin-pill-green"
      : group === "EXPERIENCE"
        ? "admin-pill-purple"
        : "admin-pill-blue";
  return <span className={`admin-pill ${tone}`}>{group.replace(/_/g, " ").toLowerCase()}</span>;
}

/** "4 yoga / month", "Unlimited" — what the member actually gets. */
function allowanceLabel(tier: { includedSessionsPerMonth: number | null }) {
  return tier.includedSessionsPerMonth === null
    ? "Unlimited"
    : `${tier.includedSessionsPerMonth} / month`;
}

export function AdminMembershipsPage({ auth }: { auth: Auth }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(""), 4000);
  };

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (search.trim()) params.set("search", search.trim());
    const query = params.toString() ? `?${params.toString()}` : "";

    Promise.all([
      adminApi<Overview>("/api/admin/site/memberships/overview", auth.token),
      adminApi<{ memberships: MembershipRow[] }>(
        `/api/admin/site/memberships${query}`,
        auth.token
      ),
      adminApi<{ tiers: TierRow[] }>("/api/admin/site/membership-tiers", auth.token),
      adminApi<{ members: MemberOption[] }>("/api/admin/site/membership-members", auth.token)
    ])
      .then(([o, m, t, mem]) => {
        setOverview(o);
        setMemberships(m.memberships);
        setTiers(t.tiers);
        setMembers(mem.members);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [auth.token, statusFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (id: string, action: string, freezeMonths?: number) => {
    try {
      await adminApi(`/api/admin/site/memberships/${id}/status`, auth.token, {
        method: "PATCH",
        body: JSON.stringify({ action, freezeMonths })
      });
      flash("Membership updated.");
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const switchTier = async (id: string, tierId: string) => {
    try {
      await adminApi(`/api/admin/site/memberships/${id}/tier`, auth.token, {
        method: "PATCH",
        body: JSON.stringify({ tierId })
      });
      flash("Plan change saved — it takes effect next billing period.");
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const toolbar = (
    <div className="admin-view-tabs">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`admin-view-tab${tab === t.id ? " active" : ""}`}
          onClick={() => setTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <AdminShell
      auth={auth}
      title="Memberships"
      subtitle="Plans, members and their monthly session allowance"
      icon={CreditCard}
      toolbar={toolbar}
    >
      {error && <div className="admin-alert">{error}</div>}
      {notice && <div className="admin-help-banner">{notice}</div>}

      {loading ? (
        <div className="admin-loading">Loading…</div>
      ) : (
        <>
          {tab === "overview" && <OverviewTab overview={overview} />}
          {tab === "members" && (
            <MembersTab
              memberships={memberships}
              tiers={tiers}
              members={members}
              token={auth.token}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              search={search}
              setSearch={setSearch}
              onChangeStatus={changeStatus}
              onSwitchTier={switchTier}
              onSaved={load}
              setError={setError}
              flash={flash}
            />
          )}
          {tab === "plans" && <PlansTab tiers={tiers} />}
        </>
      )}
    </AdminShell>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function OverviewTab({ overview }: { overview: Overview | null }) {
  if (!overview) return <div className="admin-loading">No data yet.</div>;
  const k = overview.kpis;

  const stats = [
    ["Active members", String(k.activeCount)],
    ["Monthly recurring revenue", money(k.monthlyRevenueCents)],
    ["Frozen", String(k.frozenCount)],
    ["Cancelling", String(k.pendingCancelCount)],
    ["Payment failed", String(k.paymentFailedCount)],
    ["Founding 50 left", `${k.foundingFiftyRemaining} of 50`]
  ];

  return (
    <>
      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <h2 className="admin-panel-title">At a glance</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
          {stats.map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
              <div className="admin-field-hint">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-panel">
        <h2 className="admin-panel-title">Members by plan</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Group</th>
                <th>Price / month</th>
                <th>Active</th>
                <th>All time</th>
              </tr>
            </thead>
            <tbody>
              {overview.byTier.map((t) => (
                <tr key={t.id}>
                  <td className="admin-td-name">{t.name}</td>
                  <td>{groupPill(t.tierGroup)}</td>
                  <td>{money(t.monthlyPriceCents)}</td>
                  <td>{t.activeCount}</td>
                  <td>{t.totalCount}</td>
                </tr>
              ))}
              {overview.byTier.length === 0 && (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    No plans yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── Members ───────────────────────────────────────────────────────────────────

function MembersTab({
  memberships,
  tiers,
  members,
  token,
  statusFilter,
  setStatusFilter,
  search,
  setSearch,
  onChangeStatus,
  onSwitchTier,
  onSaved,
  setError,
  flash
}: {
  memberships: MembershipRow[];
  tiers: TierRow[];
  members: MemberOption[];
  token: string;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  search: string;
  setSearch: (s: string) => void;
  onChangeStatus: (id: string, action: string, freezeMonths?: number) => void;
  onSwitchTier: (id: string, tierId: string) => void;
  onSaved: () => void;
  setError: (s: string) => void;
  flash: (s: string) => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [memberId, setMemberId] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [tierId, setTierId] = useState("");
  const [saving, setSaving] = useState(false);

  const addMembership = async (e: FormEvent) => {
    e.preventDefault();
    if (!tierId) {
      setError("Pick a plan.");
      return;
    }
    if (mode === "existing" && !memberId) {
      setError("Pick a member.");
      return;
    }
    if (mode === "new" && (!newName.trim() || !newEmail.trim())) {
      setError("Enter the person's name and email.");
      return;
    }
    setSaving(true);
    try {
      await adminApi("/api/admin/site/memberships", token, {
        method: "POST",
        body: JSON.stringify(
          mode === "existing"
            ? { memberId, tierId }
            : {
                tierId,
                newMember: { name: newName.trim(), email: newEmail.trim(), phone: newPhone.trim() }
              }
        )
      });
      setMemberId("");
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setTierId("");
      flash("Membership created.");
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-layout-split">
      <div className="admin-layout-main">
        <div className="admin-db-toolbar">
          <input
            className="admin-input"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <select
            className="admin-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ maxWidth: 190 }}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "All statuses" : s.replace(/_/g, " ").toLowerCase()}
              </option>
            ))}
          </select>
          <div className="admin-db-toolbar-spacer" />
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Sessions left</th>
                <th>Renews</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((m) => {
                const period = m.currentPeriod;
                const left =
                  !period || period.sessionsIncluded === null
                    ? "Unlimited"
                    : `${period.sessionsRemaining ?? 0} of ${
                        period.sessionsIncluded + period.sessionsRolledIn
                      }`;
                return (
                  <tr key={m.id}>
                    <td className="admin-td-name">
                      {m.member.name}
                      <div className="admin-field-hint">{m.member.email}</div>
                    </td>
                    <td>
                      <select
                        className="admin-input"
                        value={m.tier.id}
                        onChange={(e) => onSwitchTier(m.id, e.target.value)}
                      >
                        {tiers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {statusPill(m.status)}
                      {m.status === "PENDING_CANCEL" && (
                        <div className="admin-field-hint">Ends {shortDate(m.cancelEffectiveAt)}</div>
                      )}
                      {m.status === "FROZEN" && (
                        <div className="admin-field-hint">Until {shortDate(m.freezeEndsAt)}</div>
                      )}
                    </td>
                    <td>{left}</td>
                    <td>{shortDate(m.currentPeriodEnd)}</td>
                    <td>
                      {money(m.effectivePriceCents)}
                      {m.priceCentsOverride !== null && (
                        <div className="admin-field-hint">held rate</div>
                      )}
                    </td>
                    <td className="admin-td-actions">
                      <div className="admin-action-row">
                        {m.status === "FROZEN" ? (
                          <button className="admin-btn" onClick={() => onChangeStatus(m.id, "unfreeze")}>
                            Unfreeze
                          </button>
                        ) : (
                          <button
                            className="admin-btn"
                            onClick={() => onChangeStatus(m.id, "freeze", 1)}
                            disabled={m.status === "CANCELLED"}
                          >
                            Freeze
                          </button>
                        )}
                        {m.status === "ACTIVE" ? (
                          <button
                            className="admin-btn admin-btn-danger"
                            onClick={() => onChangeStatus(m.id, "cancel")}
                          >
                            Cancel
                          </button>
                        ) : (
                          <button className="admin-btn" onClick={() => onChangeStatus(m.id, "reactivate")}>
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {memberships.length === 0 && (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    No memberships yet. Add one on the right.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-panel">
        <h2 className="admin-panel-title">Add a membership</h2>
        <form onSubmit={addMembership}>
          <div className="admin-view-tabs" style={{ marginBottom: 16 }}>
            <button
              type="button"
              className={`admin-view-tab${mode === "existing" ? " active" : ""}`}
              onClick={() => setMode("existing")}
            >
              Existing member
            </button>
            <button
              type="button"
              className={`admin-view-tab${mode === "new" ? " active" : ""}`}
              onClick={() => setMode("new")}
            >
              New person
            </button>
          </div>

          {mode === "existing" ? (
            <label className="admin-field">
              <span className="admin-field-label">Member</span>
              <select
                className="admin-input"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
              >
                <option value="">Select member…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id} disabled={Boolean(m.currentTier)}>
                    {m.name} — {m.email}
                    {m.currentTier ? ` (on ${m.currentTier})` : ""}
                  </option>
                ))}
              </select>
              <span className="admin-field-hint">
                People who already have a website account. Someone already on a plan can't be added twice.
              </span>
            </label>
          ) : (
            <>
              <label className="admin-field">
                <span className="admin-field-label">Full name *</span>
                <input
                  type="text"
                  className="admin-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Jane Tan"
                />
              </label>
              <label className="admin-field">
                <span className="admin-field-label">Email *</span>
                <input
                  type="email"
                  className="admin-input"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="jane@example.com"
                />
                <span className="admin-field-hint">
                  Creates a website account for them. If this email already exists, that account is
                  used instead of making a duplicate.
                </span>
              </label>
              <label className="admin-field">
                <span className="admin-field-label">Phone</span>
                <input
                  type="tel"
                  className="admin-input"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+65 9123 4567"
                />
              </label>
            </>
          )}

          <label className="admin-field">
            <span className="admin-field-label">Plan</span>
            <select className="admin-input" value={tierId} onChange={(e) => setTierId(e.target.value)}>
              <option value="">Select plan…</option>
              {tiers.map((t) => (
                <option key={t.id} value={t.id} disabled={t.soldOut || !t.isActive}>
                  {t.name} — {money(t.monthlyPriceCents)}/mo
                  {t.soldOut ? " (sold out)" : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="admin-form-actions">
            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Create membership"}
            </button>
          </div>
        </form>

        <p className="admin-field-hint" style={{ marginTop: 16 }}>
          New memberships start a 3-month minimum term, then run month to month.
          Cancelling gives 14 days' notice and access continues to the end of the paid period.
          A person added here sets their own password via the website's password reset.
        </p>
      </div>
    </div>
  );
}

// ── Plans ─────────────────────────────────────────────────────────────────────

function PlansTab({ tiers }: { tiers: TierRow[] }) {
  return (
    <div className="admin-panel">
      <h2 className="admin-panel-title">Plans &amp; pricing</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Group</th>
              <th>Price / month</th>
              <th>Included</th>
              <th>Covers</th>
              <th>Guest passes</th>
              <th>Books ahead</th>
              <th>Members</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <tr key={t.id}>
                <td className="admin-td-name">
                  {t.name}
                  {t.notes && <div className="admin-field-hint">{t.notes}</div>}
                </td>
                <td>{groupPill(t.tierGroup)}</td>
                <td>{money(t.monthlyPriceCents)}</td>
                <td>{allowanceLabel(t)}</td>
                <td>
                  {t.allowedCategories.map((c) => (
                    <span key={c} className="admin-tag">
                      {c.toLowerCase()}
                    </span>
                  ))}
                </td>
                <td>{t.guestPassesPerMonth}</td>
                <td>{t.priorityBookingDays} days</td>
                <td>
                  {t.memberCount}
                  {t.maxMembers !== null && ` / ${t.maxMembers}`}
                  {t.soldOut && <div className="admin-field-hint">sold out</div>}
                </td>
              </tr>
            ))}
            {tiers.length === 0 && (
              <tr>
                <td colSpan={8} className="admin-table-empty">
                  No plans yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="admin-field-hint" style={{ marginTop: 16 }}>
        Meditation is free on every plan and never uses an included session. Flow plans cover yoga;
        Experience plans cover aerial, sound and dance; All-Access covers everything.
      </p>
    </div>
  );
}
