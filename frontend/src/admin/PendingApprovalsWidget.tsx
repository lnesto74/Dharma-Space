import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Check, ExternalLink, X, XCircle } from "lucide-react";
import { adminApi } from "./adminApi";
import type { UserRow } from "./cwp/types";

const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: "Employee",
  HR_ADMIN: "HR Admin",
  CORPORATE_ADMIN: "Corporate Admin",
  TRAINER: "Specialist / Trainer",
  SUPER_ADMIN: "Dharma Admin"
};

function roleLabel(role: string) {
  return ROLE_LABELS[role] || role;
}

type Props = {
  token: string;
};

export function PendingApprovalsWidget({ token }: Props) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const prevCountRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await adminApi<{ users: UserRow[] }>(
        "/api/admin/cwp/users?accountStatus=PENDING",
        token
      );
      const list = Array.isArray(data.users) ? data.users : [];
      setUsers(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load pending approvals");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    const count = users.length;
    if (prevCountRef.current !== null && count > prevCountRef.current) {
      setOpen(true);
    }
    prevCountRef.current = count;
  }, [users.length]);

  const approve = async (user: UserRow) => {
    setActingId(user.id);
    setError("");
    try {
      await adminApi(`/api/admin/cwp/users/${user.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          accountStatus: "APPROVED",
          role: user.role || "EMPLOYEE",
          companyId: user.companyId
        })
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not approve user");
    } finally {
      setActingId(null);
    }
  };

  const reject = async (user: UserRow) => {
    if (!window.confirm(`Reject access for ${user.email}?`)) return;
    setActingId(user.id);
    setError("");
    try {
      await adminApi(`/api/admin/cwp/users/${user.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ accountStatus: "REJECTED" })
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not reject user");
    } finally {
      setActingId(null);
    }
  };

  const count = users.length;

  return (
    <div className="admin-pending-widget">
      {open && (
        <div className="admin-pending-panel">
          <div className="admin-pending-header">
            <div className="admin-pending-header-title">
              <Briefcase size={18} strokeWidth={1.75} />
              <span>Pending approvals</span>
              {count > 0 && <span className="admin-pending-header-count">{count}</span>}
            </div>
            <button
              type="button"
              className="admin-pending-icon-btn"
              onClick={() => setOpen(false)}
              aria-label="Close pending approvals"
            >
              <X size={18} />
            </button>
          </div>

          <div className="admin-pending-body">
            {error && <div className="admin-pending-error">{error}</div>}
            {loading && users.length === 0 ? (
              <p className="admin-pending-empty">Loading…</p>
            ) : users.length === 0 ? (
              <p className="admin-pending-empty">No pending signups. New requests will appear here.</p>
            ) : (
              <ul className="admin-pending-list">
                {users.map((user) => (
                  <li key={user.id} className="admin-pending-card">
                    <div className="admin-pending-card-head">
                      <strong>{user.name}</strong>
                      <span className="admin-pending-pill">{roleLabel(user.role)}</span>
                    </div>
                    <p className="admin-pending-meta">{user.email}</p>
                    {user.position && <p className="admin-pending-meta">Position: {user.position}</p>}
                    <p className="admin-pending-meta">
                      {user.company?.name || "No company"}
                      {user.department?.name ? ` · ${user.department.name}` : ""}
                    </p>
                    <div className="admin-pending-actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm admin-btn-primary"
                        disabled={actingId === user.id}
                        onClick={() => void approve(user)}
                      >
                        <Check size={14} />
                        Approve
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm"
                        disabled={actingId === user.id}
                        onClick={() => void reject(user)}
                      >
                        <XCircle size={14} />
                        Reject
                      </button>
                      {user.companyId && (
                        <Link
                          to={`/admin/cwp/companies/${user.companyId}?tab=people`}
                          className="admin-btn admin-btn-sm"
                          onClick={() => setOpen(false)}
                        >
                          <ExternalLink size={14} />
                          Company
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="admin-pending-footer">
            <Link to="/admin/cwp" className="admin-pending-footer-link" onClick={() => setOpen(false)}>
              Open CWP Platform →
            </Link>
          </div>
        </div>
      )}

      <button
        type="button"
        className="admin-pending-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label={count ? `${count} pending approval(s)` : "Pending approvals"}
        title="Pending user approvals"
      >
        <Briefcase size={22} strokeWidth={1.75} />
        {count > 0 && <span className="admin-pending-fab-badge">{count}</span>}
      </button>
    </div>
  );
}
