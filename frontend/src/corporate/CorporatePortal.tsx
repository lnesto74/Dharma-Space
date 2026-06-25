import { FormEvent, useEffect, useState } from "react";
import PlatformApp from "../platform/PlatformApp";
import { BrandLogo } from "../components/BrandLogo";
import { GoogleSignIn, GoogleSignInDivider, corporateGoogleSignIn } from "../components/GoogleSignIn";

const API_URL = import.meta.env.VITE_API_URL || "";
const CORPORATE_ROLES = new Set(["EMPLOYEE", "HR_ADMIN", "CORPORATE_ADMIN", "TRAINER", "SUPER_ADMIN"]);

const DEMO_ACCOUNTS: Array<[string, string, string]> = [
  ["Employee", "employee@demo.com", "/app/dashboard"],
  ["HR Admin", "hr@demo.com", "/hr/dashboard"],
  ["Corporate Admin", "company@demo.com", "/company/dashboard"],
  ["Specialist / Trainer", "trainer@demo.com", "/trainer/dashboard"],
  ["Dharma Admin", "admin@demo.com", "/hr/dashboard (CWP) · use website Admin for /admin"]
];

function storeSession(token: string, user: { homePath?: string; role: string }) {
  if (!CORPORATE_ROLES.has(user.role)) {
    throw new Error("This portal is for corporate wellness accounts only.");
  }
  localStorage.setItem("hsos_token", token);
  localStorage.setItem("hsos_user", JSON.stringify(user));
  window.location.href = user.role === "SUPER_ADMIN" ? "/hr/dashboard" : user.homePath || "/app/dashboard";
}

function CorporateLoginShell({ children, subtitle }: { children: React.ReactNode; subtitle: string }) {
  return (
    <div className="cwp-page flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo
            className="mb-4 flex items-center gap-2"
            iconClassName="h-14 w-14 object-contain"
            textClassName="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--cwp-charcoal)]"
          />
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--cwp-text-muted)]">Corporate Wellness Platform</p>
          <p className="mt-3 text-sm text-[var(--cwp-text-muted)]">{subtitle}</p>
        </div>
        <div className="cwp-card">{children}</div>
      </div>
    </div>
  );
}

function CorporateLogin({
  onGoogleCredential,
  showGoogle
}: {
  onGoogleCredential: (credential: string) => Promise<void>;
  showGoogle: boolean;
}) {
  const [email, setEmail] = useState("employee@demo.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.pending) throw new Error(data.message || "Account pending approval");
        throw new Error(data.message || "Sign-in failed");
      }
      storeSession(data.token, data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitGoogle(credential: string) {
    setLoading(true);
    setError("");
    try {
      await onGoogleCredential(credential);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CorporateLoginShell subtitle="Sign in with Google or your email to access the corporate wellness portal.">
      {showGoogle && (
        <>
          <GoogleSignIn onCredential={submitGoogle} onError={setError} disabled={loading} />
          <GoogleSignInDivider label="Or sign in with email" />
        </>
      )}

      <form onSubmit={submitPassword} className="grid gap-4">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.16em] text-[var(--cwp-text-muted)]">Demo accounts · password123</p>
          <div className="grid gap-2">
            {DEMO_ACCOUNTS.map(([label, account, portal]) => (
              <button
                key={account}
                type="button"
                onClick={() => setEmail(account)}
                className="flex flex-col rounded-xl border border-[var(--cwp-border)] px-4 py-3 text-left text-sm hover:bg-[var(--cwp-bg)] sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium">{label}</span>
                <span className="text-[var(--cwp-text-muted)] text-xs sm:text-sm">{account}</span>
                <span className="text-[10px] text-[var(--cwp-text-muted)] mt-1 sm:mt-0 sm:max-w-[40%] sm:text-right">{portal}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="grid gap-1.5 text-sm">
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-[var(--cwp-border)] px-4 py-3 outline-none focus:border-[var(--cwp-army)]"
            autoComplete="username"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-[var(--cwp-border)] px-4 py-3 outline-none focus:border-[var(--cwp-army)]"
            autoComplete="current-password"
          />
        </label>

        {error && <p className="text-sm text-[var(--cwp-error)]">{error}</p>}

        <button type="submit" disabled={loading} className="cwp-btn-primary w-full disabled:opacity-60">
          {loading ? "Signing in…" : "Sign in with email"}
        </button>

        <p className="text-center text-xs text-[var(--cwp-text-muted)]">
          Website CMS admin: marketing site header → <strong>Admin</strong> (username <code>admin</code>).
        </p>
      </form>
    </CorporateLoginShell>
  );
}

// When the Dharma Admin crosses over from the website admin backend (a different
// origin), the session arrives in the URL hash as "#sso=<base64>". Ingest it into
// localStorage and strip the hash before anything reads the session.
function ingestSsoHash() {
  if (typeof window === "undefined") return;
  const hash = window.location.hash;
  if (!hash.startsWith("#sso=")) return;
  try {
    const decoded = JSON.parse(atob(decodeURIComponent(hash.slice(5)))) as {
      token?: string;
      user?: unknown;
    };
    if (decoded.token && decoded.user) {
      localStorage.setItem("hsos_token", decoded.token);
      localStorage.setItem("hsos_user", JSON.stringify(decoded.user));
    }
  } catch {
    /* malformed handoff — ignore and fall back to login */
  }
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

ingestSsoHash();

function readStoredSession(): { role: string } | null {
  const token = localStorage.getItem("hsos_token");
  const userRaw = localStorage.getItem("hsos_user");
  if (!token || !userRaw) return null;
  try {
    const user = JSON.parse(userRaw);
    if (CORPORATE_ROLES.has(user.role)) return user;
  } catch {
    /* corrupt — treat as no session */
  }
  return null;
}

export default function CorporatePortal() {
  const [clientId, setClientId] = useState<string | null | undefined>(undefined);
  const [session, setSession] = useState<{ role: string } | null | "checking">(() =>
    readStoredSession() ? "checking" : null
  );

  const handleGoogleCredential = async (credential: string) => {
    const data = await corporateGoogleSignIn(credential);
    storeSession(data.token, data.user);
  };

  useEffect(() => {
    fetch(`${API_URL}/api/auth/google/config`)
      .then((r) => r.json())
      .then((d) => setClientId(d.clientId || null))
      .catch(() => setClientId(null));
  }, []);

  useEffect(() => {
    if (session !== "checking") return;
    const token = localStorage.getItem("hsos_token");
    if (!token) {
      setSession(null);
      return;
    }
    let active = true;
    fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!active) return;
        if (res.ok) {
          setSession(readStoredSession());
        } else {
          localStorage.removeItem("hsos_token");
          localStorage.removeItem("hsos_user");
          setSession(null);
        }
      })
      .catch(() => {
        if (active) setSession(readStoredSession());
      });
    return () => {
      active = false;
    };
  }, [session]);

  if (session === "checking") {
    return (
      <div className="cwp-page flex min-h-screen items-center justify-center text-sm text-[var(--cwp-text-muted)]">
        Loading…
      </div>
    );
  }

  if (session) {
    return <PlatformApp />;
  }

  if (clientId === undefined) {
    return (
      <div className="cwp-page flex min-h-screen items-center justify-center text-sm text-[var(--cwp-text-muted)]">
        Loading…
      </div>
    );
  }

  return (
    <CorporateLogin onGoogleCredential={handleGoogleCredential} showGoogle={Boolean(clientId)} />
  );
}

export function CorporateRedirect() {
  return null;
}
