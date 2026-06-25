import { FormEvent, useEffect, useState } from "react";
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from "@react-oauth/google";
import PlatformApp from "../platform/PlatformApp";
import { BrandLogo } from "../components/BrandLogo";

const API_URL = import.meta.env.VITE_API_URL || "";
const CORPORATE_ROLES = new Set(["EMPLOYEE", "HR_ADMIN", "CORPORATE_ADMIN", "TRAINER", "SUPER_ADMIN"]);

const DEMO_ACCOUNTS: Array<[string, string]> = [
  ["Employee", "employee@demo.com"],
  ["HR Admin", "hr@demo.com"],
  ["Corporate Admin", "company@demo.com"],
  ["Specialist / Trainer", "trainer@demo.com"],
  ["Dharma Admin", "admin@demo.com"]
];

function storeSession(token: string, user: { homePath?: string; role: string }) {
  if (!CORPORATE_ROLES.has(user.role)) {
    throw new Error("This portal is for corporate wellness accounts only.");
  }
  localStorage.setItem("hsos_token", token);
  localStorage.setItem("hsos_user", JSON.stringify(user));
  // Inside the CWP portal everyone (including the Dharma Admin) goes to the platform,
  // not the website admin backend. The admin backend is reached from the website.
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

function CorporatePasswordLogin({ googleClientId }: { googleClientId?: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isLocal = typeof window !== "undefined" && /localhost|127\.0\.0\.1/.test(window.location.hostname);

  async function submit(event: FormEvent) {
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
      if (!res.ok) throw new Error(data.message || "Sign-in failed");
      storeSession(data.token, data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CorporateLoginShell subtitle="Sign in with your corporate email and password.">
      <form onSubmit={submit} className="grid gap-4">
        {isLocal && (
          <div className="grid gap-2">
            {DEMO_ACCOUNTS.map(([label, account]) => (
              <button
                key={account}
                type="button"
                onClick={() => {
                  setEmail(account);
                  setPassword("password123");
                }}
                className="flex items-center justify-between rounded-xl border border-[var(--cwp-border)] px-4 py-3 text-left text-sm hover:bg-[var(--cwp-bg)]"
              >
                <span className="font-medium">{label}</span>
                <span className="text-[var(--cwp-text-muted)]">{account}</span>
              </button>
            ))}
          </div>
        )}
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
        <p className="text-xs text-[var(--cwp-text-muted)]">
          {isLocal ? "Demo password for all accounts: " : "Use the password set by your HR admin or Dharma Space."}
          {isLocal && <strong> password123</strong>}
        </p>
        {error && <p className="text-sm text-[var(--cwp-error)]">{error}</p>}
        <button type="submit" disabled={loading} className="cwp-btn-primary w-full disabled:opacity-60">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {googleClientId && (
        <div className="mt-6 border-t border-[var(--cwp-border)] pt-6">
          <p className="mb-3 text-center text-xs text-[var(--cwp-text-muted)]">Or continue with Google</p>
          <GoogleOAuthProvider clientId={googleClientId}>
            <CorporateGoogleLogin compact />
          </GoogleOAuthProvider>
        </div>
      )}
    </CorporateLoginShell>
  );
}

function CorporateGoogleLogin({ compact = false }: { compact?: boolean }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: response.credential })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Google sign-in failed");
      storeSession(data.token, data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <div>
        {error && <p className="mb-3 text-sm text-[var(--cwp-error)]">{error}</p>}
        {loading ? (
          <p className="text-center text-sm text-[var(--cwp-text-muted)]">Signing in…</p>
        ) : (
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={() => setError("Google sign-in was cancelled or failed")}
              useOneTap={false}
              theme="outline"
              size="large"
              text="continue_with"
              shape="rectangular"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <CorporateLoginShell subtitle="Sign in with your company Google account to access your corporate wellness portal.">
      {error && <p className="mb-4 text-sm text-[var(--cwp-error)]">{error}</p>}
      {loading ? (
        <p className="text-center text-sm text-[var(--cwp-text-muted)]">Signing in…</p>
      ) : (
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => setError("Google sign-in was cancelled or failed")}
            useOneTap={false}
            theme="outline"
            size="large"
            text="continue_with"
            shape="rectangular"
          />
        </div>
      )}
      <p className="mt-6 text-center text-xs text-[var(--cwp-text-muted)]">
        Employees, HR admins, specialists, and corporate partners only.
      </p>
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
  // "checking" until the stored token is validated against the server, so we never
  // render the logged-in app with a stale token (which causes a blank page).
  const [session, setSession] = useState<{ role: string } | null | "checking">(() =>
    readStoredSession() ? "checking" : null
  );

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
          // Stale/invalid token (e.g. database reseeded) — clear and show login.
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

  return <CorporatePasswordLogin googleClientId={clientId} />;
}

export function CorporateRedirect() {
  return null;
}
