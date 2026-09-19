import { FormEvent, useCallback, useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { AdminShell } from "./SiteAdminPages";
import { adminApi } from "./adminApi";

type Auth = { token: string; user: { name: string; role: string } | null };

type Tab = "packs" | "wallets" | "sell";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "packs", label: "Packs & Pricing" },
  { id: "wallets", label: "Who has credits" },
  { id: "sell", label: "Sell at the desk" }
];

const WALLET_FILTERS = ["ACTIVE", "PENDING", "EXPIRED", "CANCELLED", "ALL"] as const;

type PackRow = {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  price: string;
  validMonths: number;
  perCreditCents: number;
  perCredit: string;
  isActive: boolean;
  sortOrder: number;
  classesPerCategory: Record<string, number>;
};

type WalletRow = {
  id: string;
  packName: string;
  owner: { id: string; name: string; email: string };
  creditsTotal: number;
  creditsUsed: number;
  creditsLeft: number;
  purchasedAt: string;
  expiresAt: string;
  expired: boolean;
  status: string;
  sharedWith: Array<{ id: string; name: string; email: string }>;
  notes: string;
};

type Overview = {
  packs: PackRow[];
  stats: {
    activeWallets: number;
    pendingWallets: number;
    creditsOutstanding: number;
    walletsLapsingIn60Days: number;
    packsSold: number;
    revenue: string;
  };
  costs: Record<string, number>;
};

type MemberOption = { id: string; name: string; email: string };

function shortDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function statusPill(status: string, expired: boolean) {
  const tone =
    expired || status === "EXPIRED"
      ? "admin-pill-gray"
      : status === "ACTIVE"
        ? "admin-pill-green"
        : status === "PENDING"
          ? "admin-pill-orange"
          : "admin-pill-gray";
  return (
    <span className={`admin-pill ${tone}`}>
      <span className="admin-pill-dot" />
      {expired && status === "ACTIVE" ? "expired" : status.toLowerCase()}
    </span>
  );
}

export function AdminCreditPacksPage({ auth }: { auth: Auth }) {
  const [tab, setTab] = useState<Tab>("packs");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [walletFilter, setWalletFilter] = useState<string>("ACTIVE");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(""), 5000);
  };

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (walletFilter !== "ACTIVE") params.set("status", walletFilter);
    if (search.trim()) params.set("search", search.trim());
    const query = params.toString() ? `?${params.toString()}` : "";

    Promise.all([
      adminApi<Overview>("/api/admin/site/credit-packs/overview", auth.token),
      adminApi<{ wallets: WalletRow[] }>(`/api/admin/site/credit-wallets${query}`, auth.token),
      adminApi<{ members: MemberOption[] }>("/api/admin/site/membership-members", auth.token)
    ])
      .then(([o, w, m]) => {
        setOverview(o);
        setWallets(w.wallets);
        setMembers(m.members);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [auth.token, walletFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

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
      title="Credit Packs"
      subtitle="Prepaid class credits — shareable, and valid six months from purchase"
      icon={Coins}
      toolbar={toolbar}
    >
      {error && <div className="admin-alert">{error}</div>}
      {notice && <div className="admin-help-banner">{notice}</div>}

      {loading ? (
        <div className="admin-loading">Loading…</div>
      ) : (
        <>
          {tab === "packs" && (
            <PacksTab
              overview={overview}
              token={auth.token}
              onSaved={load}
              setError={setError}
              flash={flash}
            />
          )}
          {tab === "wallets" && (
            <WalletsTab
              wallets={wallets}
              filter={walletFilter}
              setFilter={setWalletFilter}
              search={search}
              setSearch={setSearch}
            />
          )}
          {tab === "sell" && (
            <SellTab
              packs={overview?.packs || []}
              members={members}
              token={auth.token}
              onSaved={load}
              setError={setError}
              flash={flash}
            />
          )}
        </>
      )}
    </AdminShell>
  );
}

// ── Packs & pricing ──────────────────────────────────────────────────────────

function PacksTab({
  overview,
  token,
  onSaved,
  setError,
  flash
}: {
  overview: Overview | null;
  token: string;
  onSaved: () => void;
  setError: (m: string) => void;
  flash: (m: string) => void;
}) {
  const [editing, setEditing] = useState<PackRow | null>(null);
  const [name, setName] = useState("");
  const [credits, setCredits] = useState("10");
  const [price, setPrice] = useState("170");
  const [validMonths, setValidMonths] = useState("6");
  const [saving, setSaving] = useState(false);

  const startEdit = (pack: PackRow) => {
    setEditing(pack);
    setName(pack.name);
    setCredits(String(pack.credits));
    setPrice(String(pack.priceCents / 100));
    setValidMonths(String(pack.validMonths));
  };

  const startNew = () => {
    setEditing(null);
    setName("");
    setCredits("10");
    setPrice("170");
    setValidMonths("6");
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = JSON.stringify({
        name: name.trim(),
        credits: Number(credits),
        priceCents: Math.round(Number(price) * 100),
        validMonths: Number(validMonths),
        isActive: editing ? editing.isActive : true,
        sortOrder: editing ? editing.sortOrder : (overview?.packs.length || 0) + 1
      });
      if (editing) {
        await adminApi(`/api/admin/site/credit-packs/${editing.id}`, token, { method: "PUT", body });
        flash(`${name} saved.`);
      } else {
        await adminApi("/api/admin/site/credit-packs", token, { method: "POST", body });
        flash(`${name} added.`);
      }
      startNew();
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const retire = async (pack: PackRow) => {
    if (!confirm(`Stop selling ${pack.name}? Credits people already hold are unaffected.`)) return;
    try {
      await adminApi(`/api/admin/site/credit-packs/${pack.id}`, token, { method: "DELETE" });
      flash(`${pack.name} retired.`);
      onSaved();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const stats = overview?.stats;
  const costs = overview?.costs || {};

  return (
    <div className="admin-layout-split">
      <div className="admin-layout-main">
        {stats && (
          <div className="admin-panel" style={{ marginBottom: 20 }}>
            <h2 className="admin-panel-title">At a glance</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 16
              }}
            >
              {[
                ["Credits outstanding", String(stats.creditsOutstanding)],
                ["Packs in use", String(stats.activeWallets)],
                ["Lapsing in 60 days", String(stats.walletsLapsingIn60Days)],
                ["Taken to date", stats.revenue]
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
                  <div className="admin-field-hint">{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Pack</th>
                <th>Price</th>
                <th>Per credit</th>
                <th>Worth</th>
                <th>Valid</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(overview?.packs || []).map((pack) => (
                <tr key={pack.id}>
                  <td>
                    <strong>{pack.name}</strong>
                    <div className="admin-field-hint">{pack.credits} credits</div>
                  </td>
                  <td>{pack.price}</td>
                  <td>{pack.perCredit}</td>
                  <td>
                    <div className="admin-field-hint">
                      {Object.entries(pack.classesPerCategory)
                        .map(([category, classes]) => `${classes} ${category.toLowerCase()}`)
                        .join(" · ")}
                    </div>
                  </td>
                  <td>{pack.validMonths} months</td>
                  <td>
                    <span className={`admin-pill ${pack.isActive ? "admin-pill-green" : "admin-pill-gray"}`}>
                      <span className="admin-pill-dot" />
                      {pack.isActive ? "on sale" : "retired"}
                    </span>
                  </td>
                  <td className="admin-td-actions">
                    <div className="admin-action-row">
                      <button className="admin-btn" onClick={() => startEdit(pack)}>
                        Edit
                      </button>
                      {pack.isActive && (
                        <button className="admin-btn admin-btn-danger" onClick={() => retire(pack)}>
                          Retire
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!overview?.packs.length && (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    No packs yet. Add one on the right.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="admin-field-hint" style={{ marginTop: 14 }}>
          What a class costs in credits:{" "}
          {Object.entries(costs)
            .map(([category, cost]) => `${category.toLowerCase()} ${cost}`)
            .join(" · ")}
          . Meditation is free for anyone holding a pack.
        </p>
      </div>

      <div className="admin-panel">
        <h2 className="admin-panel-title">{editing ? `Edit ${editing.name}` : "Add a pack"}</h2>
        <form onSubmit={save}>
          <label className="admin-field">
            <span className="admin-field-label">Name *</span>
            <input
              className="admin-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="20 credits"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Credits *</span>
            <input
              type="number"
              min={1}
              className="admin-input"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Price (SGD) *</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className="admin-input"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <span className="admin-field-hint">
              {Number(credits) > 0 && Number(price) > 0
                ? `Works out at $${(Number(price) / Number(credits)).toFixed(2)} a credit — a yoga class costs ${
                    costs.YOGA ?? 2
                  }, so $${((Number(price) / Number(credits)) * (costs.YOGA ?? 2)).toFixed(2)} a class.`
                : "Set the credits and price to see the per-class rate."}
            </span>
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Valid for (months)</span>
            <input
              type="number"
              min={1}
              max={36}
              className="admin-input"
              value={validMonths}
              onChange={(e) => setValidMonths(e.target.value)}
            />
            <span className="admin-field-hint">
              Counted from the day it's paid for. Existing packs keep the expiry they were sold with.
            </span>
          </label>

          <div className="admin-action-row" style={{ marginTop: 8 }}>
            <button className="admin-btn admin-btn-primary" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add pack"}
            </button>
            {editing && (
              <button type="button" className="admin-btn" onClick={startNew}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Who has credits ──────────────────────────────────────────────────────────

function WalletsTab({
  wallets,
  filter,
  setFilter,
  search,
  setSearch
}: {
  wallets: WalletRow[];
  filter: string;
  setFilter: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
}) {
  return (
    <>
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
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ maxWidth: 190 }}
        >
          {WALLET_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? "All packs" : s.toLowerCase()}
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
              <th>Pack</th>
              <th>Left</th>
              <th>Used</th>
              <th>Bought</th>
              <th>Expires</th>
              <th>Shared with</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map((wallet) => (
              <tr key={wallet.id}>
                <td>
                  <strong>{wallet.owner.name}</strong>
                  <div className="admin-field-hint">{wallet.owner.email}</div>
                </td>
                <td>{wallet.packName}</td>
                <td>
                  <strong>{wallet.creditsLeft}</strong>
                  <div className="admin-field-hint">of {wallet.creditsTotal}</div>
                </td>
                <td>{wallet.creditsUsed}</td>
                <td>{shortDate(wallet.purchasedAt)}</td>
                <td>{shortDate(wallet.expiresAt)}</td>
                <td>
                  {wallet.sharedWith.length ? (
                    <div className="admin-field-hint">
                      {wallet.sharedWith.map((p) => p.name).join(", ")}
                    </div>
                  ) : (
                    <span className="admin-field-hint">—</span>
                  )}
                </td>
                <td>{statusPill(wallet.status, wallet.expired)}</td>
              </tr>
            ))}
            {!wallets.length && (
              <tr>
                <td colSpan={8} className="admin-table-empty">
                  Nobody is holding credits under this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Selling at the desk ──────────────────────────────────────────────────────

function SellTab({
  packs,
  members,
  token,
  onSaved,
  setError,
  flash
}: {
  packs: PackRow[];
  members: MemberOption[];
  token: string;
  onSaved: () => void;
  setError: (m: string) => void;
  flash: (m: string) => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [memberId, setMemberId] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [packId, setPackId] = useState(packs[0]?.id || "");
  const [provider, setProvider] = useState("QASHIER");
  const [shareEmails, setShareEmails] = useState("");
  const [saving, setSaving] = useState(false);

  const onSale = packs.filter((p) => p.isActive);
  const chosen = onSale.find((p) => p.id === packId);

  const sell = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const emails = shareEmails
        .split(/[,\n]/)
        .map((e) => e.trim())
        .filter(Boolean);

      const result = await adminApi<{ member: { name: string }; reference: string }>(
        "/api/admin/site/credit-packs/sell",
        token,
        {
          method: "POST",
          body: JSON.stringify({
            ...(mode === "existing"
              ? { memberId }
              : { newMember: { name: newName.trim(), email: newEmail.trim(), phone: newPhone.trim() || undefined } }),
            packId,
            provider,
            method: provider === "CASH" ? "CASH" : provider === "PAYNOW" ? "PAYNOW" : "CARD",
            shareEmails: emails
          })
        }
      );
      flash(
        `Sold to ${result.member.name} — credits are usable now, and the receipt is on its way (${result.reference}).`
      );
      setMemberId("");
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setShareEmails("");
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-layout-split">
      <div className="admin-layout-main">
        <div className="admin-panel">
          <h2 className="admin-panel-title">Selling a pack across the counter</h2>
          <p className="admin-field-hint" style={{ marginBottom: 14 }}>
            Take the money first on the terminal, then record it here. The credits are usable
            immediately — there's no waiting on a payment to clear — and the buyer gets the same
            receipt by email as someone who bought online.
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Pack</th>
                  <th>Price</th>
                  <th>Per credit</th>
                  <th>Yoga classes</th>
                </tr>
              </thead>
              <tbody>
                {onSale.map((pack) => (
                  <tr key={pack.id}>
                    <td>
                      <strong>{pack.name}</strong>
                    </td>
                    <td>{pack.price}</td>
                    <td>{pack.perCredit}</td>
                    <td>{pack.classesPerCategory.YOGA ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="admin-panel">
        <h2 className="admin-panel-title">Record a sale</h2>
        <form onSubmit={sell}>
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
              <span className="admin-field-label">Member *</span>
              <select
                className="admin-input"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
              >
                <option value="">Select member…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.email}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="admin-field">
                <span className="admin-field-label">Full name *</span>
                <input
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
                  Creates a website account so they can book with the credits. An existing account
                  with this email is used rather than duplicated.
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
            <span className="admin-field-label">Pack *</span>
            <select className="admin-input" value={packId} onChange={(e) => setPackId(e.target.value)}>
              {onSale.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.name} — {pack.price}
                </option>
              ))}
            </select>
            {chosen && (
              <span className="admin-field-hint">
                {chosen.credits} credits at {chosen.perCredit} each, valid {chosen.validMonths} months.
              </span>
            )}
          </label>

          <label className="admin-field">
            <span className="admin-field-label">Paid by</span>
            <select
              className="admin-input"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="QASHIER">Card on Qashier</option>
              <option value="PAYNOW">PayNow</option>
              <option value="CASH">Cash</option>
              <option value="MANUAL">Other / comp</option>
            </select>
          </label>

          <label className="admin-field">
            <span className="admin-field-label">Share with (optional)</span>
            <textarea
              className="admin-input"
              rows={2}
              value={shareEmails}
              onChange={(e) => setShareEmails(e.target.value)}
              placeholder="partner@example.com, friend@example.com"
            />
            <span className="admin-field-hint">
              Packs are shareable — anyone listed draws from the same balance and is emailed to say so.
            </span>
          </label>

          <button className="admin-btn admin-btn-primary" disabled={saving || !packId}>
            {saving ? "Recording…" : "Record sale"}
          </button>
        </form>
      </div>
    </div>
  );
}
