import { useEffect, useState } from "react";
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { Navigate } from "react-router-dom";
import PlatformApp from "../platform/PlatformApp";
import { LOGO_URL } from "../brand";

const API_URL = import.meta.env.VITE_API_URL || "";

function CorporateLogin({ clientId }: { clientId: string }) {
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
      localStorage.setItem("hsos_token", data.token);
      localStorage.setItem("hsos_user", JSON.stringify(data.user));
      window.location.href = data.user.homePath || "/company/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f9] flex items-center justify-center p-6" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src={LOGO_URL} alt="Dharma Space" className="h-12 w-auto mx-auto mb-4" />
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-2">Corporate Wellness</p>
          <h1 className="text-3xl font-semibold text-[#37352f]">Dharma Space</h1>
          <p className="mt-3 text-sm text-stone-600">Sign in with your company Google account to access your corporate wellness portal.</p>
        </div>
        <div className="bg-white border border-black/10 rounded-lg p-8 shadow-sm">
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          {loading ? (
            <p className="text-sm text-stone-500 text-center">Signing in…</p>
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
          <p className="mt-6 text-xs text-center text-stone-500">
            Employees, HR admins, and corporate partners only.<br />
            Public education bookings are on{" "}
            <a href="https://dharma-space.com/education" className="text-[#2383e2] hover:underline">dharma-space.com</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CorporatePortal() {
  const [clientId, setClientId] = useState<string | null>(null);
  const token = localStorage.getItem("hsos_token");
  const userRaw = localStorage.getItem("hsos_user");

  useEffect(() => {
    fetch(`${API_URL}/api/auth/google/config`)
      .then((r) => r.json())
      .then((d) => setClientId(d.clientId))
      .catch(() => setClientId(null));
  }, []);

  if (token && userRaw) {
    try {
      const user = JSON.parse(userRaw);
      if (["EMPLOYEE", "HR_ADMIN", "CORPORATE_ADMIN", "SUPER_ADMIN"].includes(user.role)) {
        return <PlatformApp />;
      }
    } catch {
      /* fall through to login */
    }
  }

  if (!clientId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-sm text-stone-600">
        Corporate Google login is not configured yet. Add GOOGLE_CLIENT_ID to backend/.env.
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <CorporateLogin clientId={clientId} />
    </GoogleOAuthProvider>
  );
}

export function CorporateRedirect() {
  return <Navigate to="/company/dashboard" replace />;
}
