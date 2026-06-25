import { FormEvent, useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "";

export type CorporateUser = {
  id?: string;
  name: string;
  email: string;
  role: string;
  accountStatus?: string;
  position?: string | null;
  homePath?: string;
  needsOnboarding?: boolean;
  pendingApproval?: boolean;
  company?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
};

type CompanyOption = { id: string; name: string; industry: string };
type DepartmentOption = { id: string; name: string };

const ROLE_OPTIONS = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "HR_ADMIN", label: "HR Admin" },
  { value: "CORPORATE_ADMIN", label: "Corporate Admin" },
  { value: "TRAINER", label: "Specialist / Trainer" }
];

export function CorporateOnboarding({
  token,
  initialName,
  initialEmail,
  onComplete
}: {
  token: string;
  initialName: string;
  initialEmail: string;
  onComplete: (message: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [position, setPosition] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (companyQuery.trim().length < 1) {
      setCompanies([]);
      return;
    }
    const timer = window.setTimeout(() => {
      fetch(`${API_URL}/api/companies/search?q=${encodeURIComponent(companyQuery.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((r) => r.json())
        .then((d) => setCompanies(d.companies || []))
        .catch(() => setCompanies([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [companyQuery, token]);

  useEffect(() => {
    if (!companyId) {
      setDepartments([]);
      setDepartmentId("");
      return;
    }
    fetch(`${API_URL}/api/companies/${companyId}/departments`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((r) => r.json())
      .then((d) => setDepartments(d.departments || []))
      .catch(() => setDepartments([]));
  }, [companyId, token]);

  const pickCompany = (company: CompanyOption) => {
    setCompanyId(company.id);
    setCompanyName(company.name);
    setCompanyQuery(company.name);
    setShowSuggestions(false);
    setDepartmentId("");
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!companyId) {
      setError("Select your company from the suggestions.");
      return;
    }
    if (!departmentId) {
      setError("Select your department.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/auth/onboarding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name, companyId, departmentId, role, position })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not save your profile");
      onComplete(data.message || "Profile submitted for approval.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <p className="text-sm text-[var(--cwp-text-muted)]">
        Complete your profile for <strong>{initialEmail}</strong>. A Dharma Space administrator will review your access after you submit.
      </p>

      <label className="grid gap-1.5 text-sm">
        Full name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-xl border border-[var(--cwp-border)] px-4 py-3 outline-none focus:border-[var(--cwp-army)]"
        />
      </label>

      <label className="grid gap-1.5 text-sm relative">
        Company
        <input
          value={companyQuery}
          onChange={(e) => {
            setCompanyQuery(e.target.value);
            setCompanyId("");
            setCompanyName("");
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Start typing your company name…"
          required
          className="rounded-xl border border-[var(--cwp-border)] px-4 py-3 outline-none focus:border-[var(--cwp-army)]"
        />
        {showSuggestions && companies.length > 0 && (
          <ul className="absolute z-10 top-full mt-1 w-full rounded-xl border border-[var(--cwp-border)] bg-white shadow-lg max-h-48 overflow-y-auto">
            {companies.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => pickCompany(c)}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-[var(--cwp-bg)]"
                >
                  <span className="font-medium">{c.name}</span>
                  {c.industry && <span className="ml-2 text-[var(--cwp-text-muted)]">{c.industry}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {companyName && <span className="text-xs text-[var(--cwp-text-muted)]">Selected: {companyName}</span>}
      </label>

      <label className="grid gap-1.5 text-sm">
        Department
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          required
          disabled={!companyId || departments.length === 0}
          className="rounded-xl border border-[var(--cwp-border)] px-4 py-3 outline-none focus:border-[var(--cwp-army)] disabled:opacity-50"
        >
          <option value="">{companyId ? (departments.length ? "Select department" : "No departments — contact your admin") : "Select company first"}</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm">
        Role
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-xl border border-[var(--cwp-border)] px-4 py-3 outline-none focus:border-[var(--cwp-army)]"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm">
        Position / job title
        <input
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          required
          placeholder="e.g. People Operations Manager"
          className="rounded-xl border border-[var(--cwp-border)] px-4 py-3 outline-none focus:border-[var(--cwp-army)]"
        />
      </label>

      {error && <p className="text-sm text-[var(--cwp-error)]">{error}</p>}

      <button type="submit" disabled={loading} className="cwp-btn-primary w-full disabled:opacity-60">
        {loading ? "Submitting…" : "Submit for approval"}
      </button>
    </form>
  );
}

export function CorporatePendingApproval({ message, onSignOut }: { message: string; onSignOut: () => void }) {
  return (
    <div className="text-center grid gap-4">
      <p className="text-sm text-[var(--cwp-text-muted)]">{message}</p>
      <button type="button" onClick={onSignOut} className="text-sm text-[var(--cwp-army)] underline">
        Sign out
      </button>
    </div>
  );
}
