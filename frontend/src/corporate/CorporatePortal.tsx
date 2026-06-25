import { FormEvent, useEffect, useState } from "react";
import { BrandLogo } from "../components/BrandLogo";
import { GoogleSignIn, GoogleSignInDivider } from "../components/GoogleSignIn";
import { CorporateOnboarding, CorporatePendingApproval, type CorporateUser } from "./CorporateOnboarding";

const API_URL = import.meta.env.VITE_API_URL || "";
const CORPORATE_ROLES = new Set(["EMPLOYEE", "HR_ADMIN", "CORPORATE_ADMIN", "TRAINER", "SUPER_ADMIN"]);

// Demo account shortcuts are only shown on localhost so the live site never exposes them.
const IS_LOCAL =
  typeof window !== "undefined" && /localhost|127\.0\.0\.1/.test(window.location.hostname);
const DEMO_ACCOUNTS: Array<[string, string]> = [
  ["Employee", "employee@demo.com"],
  ["HR Admin", "hr@demo.com"],
  ["Corporate Admin", "company@demo.com"],
  ["Specialist / Trainer", "trainer@demo.com"],
  ["Dharma Admin", "admin@demo.com"]
];

const ROLE_HOME: Record<string, string> = {
  EMPLOYEE: "/app/dashboard",
  HR_ADMIN: "/hr/dashboard",
  TRAINER: "/trainer/dashboard",
  CORPORATE_ADMIN: "/company/dashboard",
  SUPER_ADMIN: "/hr/dashboard"
};

const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: "Employee",
  HR_ADMIN: "HR Admin",
  CORPORATE_ADMIN: "Corporate Admin",
  TRAINER: "Specialist / Trainer",
  SUPER_ADMIN: "Dharma Admin"
};

function resolveHomePath(user: CorporateUser): string {
  if (user.homePath && user.homePath !== "/portal") return user.homePath;
  return ROLE_HOME[user.role] || "/app/dashboard";
}

type PortalGate = "login" | "onboarding" | "pending" | "app";

function storeSession(token: string, user: CorporateUser) {
  if (!CORPORATE_ROLES.has(user.role)) {
    throw new Error("This portal is for corporate wellness accounts only.");
  }
  localStorage.setItem("hsos_token", token);
  localStorage.setItem("hsos_user", JSON.stringify(user));
  window.location.href = resolveHomePath(user);
}

function clearSession() {
  localStorage.removeItem("hsos_token");
  localStorage.removeItem("hsos_user");
}

function readStoredUser(): CorporateUser | null {
  const userRaw = localStorage.getItem("hsos_user");
  if (!userRaw) return null;
  try {
    return JSON.parse(userRaw) as CorporateUser;
  } catch {
    return null;
  }
}

function gateFromUser(user: CorporateUser | null, token: string | null): PortalGate {
  if (!token || !user) return "login";
  if (user.needsOnboarding) return "onboarding";
  if (user.pendingApproval) return "pending";
  if (CORPORATE_ROLES.has(user.role)) return "app";
  return "login";
}

async function authRequest(path: string, body: object) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.pending) throw Object.assign(new Error(data.message), { pending: true });
    throw new Error(data.message || "Request failed");
  }
  return data as { token?: string; user?: CorporateUser; needsOnboarding?: boolean };
}

function CorporateLoginShell({ children, subtitle }: { children: React.ReactNode; subtitle: string }) {
  return (
    <div className="cwp-page flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <a
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--cwp-text-muted)] transition-colors hover:text-[var(--cwp-army)]"
        >
          <span aria-hidden>←</span> Back to Dharma Space
        </a>
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

function CorporateAuth({
  mode,
  setMode,
  showGoogle,
  onAuthResult,
  activeSession,
  onContinueSession,
  onSwitchAccount,
  onBeforeSignIn
}: {
  mode: "login" | "signup";
  setMode: (m: "login" | "signup") => void;
  showGoogle: boolean;
  onAuthResult: (data: { token?: string; user?: CorporateUser; needsOnboarding?: boolean }, pendingMessage?: string) => void;
  activeSession?: { user: CorporateUser; token: string } | null;
  onContinueSession?: () => void;
  onSwitchAccount?: () => void;
  onBeforeSignIn?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    onBeforeSignIn?.();
    try {
      const data = await authRequest(mode === "login" ? "/api/auth/login" : "/api/auth/register", { email, password });
      onAuthResult(data);
    } catch (err: unknown) {
      const e = err as Error & { pending?: boolean };
      if (e.pending) {
        onAuthResult({}, e.message);
        return;
      }
      setError(e.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitGoogle(credential: string) {
    setLoading(true);
    setError("");
    onBeforeSignIn?.();
    try {
      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: credential })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.pending) {
          onAuthResult({}, data.message);
          return;
        }
        throw new Error(data.message || "Google sign-in failed");
      }
      onAuthResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CorporateLoginShell
      subtitle={
        mode === "login"
          ? "Sign in with Google or your email to access the corporate wellness portal."
          : "Create your account to join your company on the corporate wellness platform."
      }
    >
      {activeSession && (
        <div className="mb-4 rounded-xl border border-[var(--cwp-border)] bg-[var(--cwp-bg)] p-4 text-sm">
          <p className="font-medium text-[var(--cwp-charcoal)]">
            Signed in as {activeSession.user.name}
            <span className="text-[var(--cwp-text-muted)]">
              {" "}
              ({ROLE_LABELS[activeSession.user.role] || activeSession.user.role})
            </span>
          </p>
          <p className="mt-1 text-xs text-[var(--cwp-text-muted)]">{activeSession.user.email}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="cwp-btn-primary" onClick={onContinueSession}>
              Continue to dashboard
            </button>
            <button type="button" className="cwp-btn-secondary" onClick={onSwitchAccount}>
              Use a different account
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex gap-2">
        {(["login", "signup"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMode(tab)}
            className={`flex-1 rounded-xl border py-2.5 text-sm font-medium ${
              mode === tab
                ? "border-[var(--cwp-army)] bg-[var(--cwp-army)] text-white"
                : "border-[var(--cwp-border)] text-[var(--cwp-text-muted)]"
            }`}
          >
            {tab === "login" ? "Sign in" : "Sign up"}
          </button>
        ))}
      </div>

      {IS_LOCAL && mode === "login" && (
        <div className="mb-4 grid gap-2">
          <p className="text-xs uppercase tracking-wide text-[var(--cwp-text-muted)]">Demo accounts (local only)</p>
          {DEMO_ACCOUNTS.map(([label, account]) => (
            <button
              key={account}
              type="button"
              onClick={() => {
                setEmail(account);
                setPassword("password123");
              }}
              className="flex items-center justify-between rounded-xl border border-[var(--cwp-border)] px-4 py-2.5 text-left text-sm hover:bg-[var(--cwp-bg)]"
            >
              <span className="font-medium">{label}</span>
              <span className="text-[var(--cwp-text-muted)]">{account}</span>
            </button>
          ))}
          <p className="text-xs text-[var(--cwp-text-muted)]">Password for all: <strong>password123</strong></p>
        </div>
      )}

      {showGoogle && (
        <>
          <GoogleSignIn onCredential={submitGoogle} onError={setError} disabled={loading} />
          <GoogleSignInDivider label="Or continue with email" />
        </>
      )}

      <form onSubmit={submitPassword} className="grid gap-4">
        <label className="grid gap-1.5 text-sm">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
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
            required
            minLength={8}
            className="rounded-xl border border-[var(--cwp-border)] px-4 py-3 outline-none focus:border-[var(--cwp-army)]"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>
        {error && <p className="text-sm text-[var(--cwp-error)]">{error}</p>}
        <button type="submit" disabled={loading} className="cwp-btn-primary w-full disabled:opacity-60">
          {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
    </CorporateLoginShell>
  );
}

function ingestSsoHash() {
  if (typeof window === "undefined") return;
  const hash = window.location.hash;
  if (!hash.startsWith("#sso=")) return;
  try {
    const decoded = JSON.parse(atob(decodeURIComponent(hash.slice(5)))) as { token?: string; user?: unknown };
    if (decoded.token && decoded.user) {
      localStorage.setItem("hsos_token", decoded.token);
      localStorage.setItem("hsos_user", JSON.stringify(decoded.user));
    }
  } catch {
    /* ignore */
  }
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

ingestSsoHash();

export default function CorporatePortal() {
  const [clientId, setClientId] = useState<string | null | undefined>(undefined);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [gate, setGate] = useState<PortalGate | "checking">(() => {
    const t = localStorage.getItem("hsos_token");
    return t ? "checking" : "login";
  });
  const [user, setUser] = useState<CorporateUser | null>(() => readStoredUser());
  const [token, setToken] = useState(() => localStorage.getItem("hsos_token") || "");
  const [pendingMessage, setPendingMessage] = useState(
    "Your profile was submitted. A Dharma Space administrator will review your access request."
  );

  useEffect(() => {
    fetch(`${API_URL}/api/auth/google/config`)
      .then((r) => r.json())
      .then((d) => setClientId(d.clientId || null))
      .catch(() => setClientId(null));
  }, []);

  useEffect(() => {
    if (gate !== "checking") return;
    const storedToken = localStorage.getItem("hsos_token");
    if (!storedToken) {
      setGate("login");
      return;
    }
    let active = true;
    fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${storedToken}` } })
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          clearSession();
          setToken("");
          setUser(null);
          setGate("login");
          return;
        }
        const data = await res.json();
        const nextUser = data.user as CorporateUser;
        setUser(nextUser);
        setToken(storedToken);
        localStorage.setItem("hsos_user", JSON.stringify(nextUser));
        const nextGate = gateFromUser(nextUser, storedToken);
        // Don't auto-redirect — let the user continue as this account or sign in as someone else.
        setGate(nextGate === "app" ? "login" : nextGate);
      })
      .catch(() => {
        if (active) {
          const storedUser = readStoredUser();
          const nextGate = gateFromUser(storedUser, storedToken);
          setGate(nextGate === "app" ? "login" : nextGate);
        }
      });
    return () => {
      active = false;
    };
  }, [gate]);

  function handleAuthResult(
    data: { token?: string; user?: CorporateUser; needsOnboarding?: boolean },
    pendingMsg?: string
  ) {
    if (pendingMsg) {
      setPendingMessage(pendingMsg);
      setGate("pending");
      return;
    }
    if (!data.token || !data.user) return;
    localStorage.setItem("hsos_token", data.token);
    localStorage.setItem("hsos_user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    if (data.needsOnboarding || data.user.needsOnboarding) {
      setGate("onboarding");
      return;
    }
    if (data.user.pendingApproval) {
      setPendingMessage("Your account is awaiting administrator approval.");
      setGate("pending");
      return;
    }
    storeSession(data.token, data.user);
  }

  if (gate === "checking") {
    return (
      <div className="cwp-page flex min-h-screen items-center justify-center text-sm text-[var(--cwp-text-muted)]">
        Loading…
      </div>
    );
  }

  if (gate === "onboarding" && token && user) {
    return (
      <CorporateLoginShell subtitle="Tell us about your role so we can set up your corporate wellness access.">
        <CorporateOnboarding
          token={token}
          initialName={user.name}
          initialEmail={user.email}
          onComplete={(message) => {
            const next = { ...user, needsOnboarding: false, pendingApproval: true };
            setUser(next);
            localStorage.setItem("hsos_user", JSON.stringify(next));
            setPendingMessage(message);
            setGate("pending");
          }}
        />
      </CorporateLoginShell>
    );
  }

  if (gate === "pending") {
    return (
      <CorporateLoginShell subtitle="Access request submitted">
        <CorporatePendingApproval
          message={pendingMessage}
          onSignOut={() => {
            clearSession();
            setToken("");
            setUser(null);
            setGate("login");
          }}
        />
      </CorporateLoginShell>
    );
  }

  function resetPortalSession() {
    clearSession();
    setToken("");
    setUser(null);
  }

  const activeSession =
    gate === "login" &&
    user &&
    token &&
    !user.needsOnboarding &&
    !user.pendingApproval &&
    user.accountStatus !== "REJECTED"
      ? { user, token }
      : null;

  return (
    <CorporateAuth
      mode={authMode}
      setMode={setAuthMode}
      showGoogle={clientId !== null && Boolean(clientId)}
      onAuthResult={handleAuthResult}
      activeSession={activeSession}
      onContinueSession={() => user && token && storeSession(token, user)}
      onSwitchAccount={resetPortalSession}
      onBeforeSignIn={resetPortalSession}
    />
  );
}

export function CorporateRedirect() {
  return null;
}
