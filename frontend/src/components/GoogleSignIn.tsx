import { useEffect, useState } from "react";
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from "@react-oauth/google";

const API_URL = import.meta.env.VITE_API_URL || "";

type GoogleSignInProps = {
  onCredential: (credential: string) => void | Promise<void>;
  onError?: (message: string) => void;
  disabled?: boolean;
  className?: string;
};

function GoogleLoginButton({
  onCredential,
  onError,
  disabled
}: Omit<GoogleSignInProps, "className">) {
  return (
    <GoogleLogin
      onSuccess={(response: CredentialResponse) => {
        if (response.credential) onCredential(response.credential);
        else onError?.("Google sign-in failed");
      }}
      onError={() => onError?.("Google sign-in was cancelled or failed")}
      useOneTap={false}
      theme="outline"
      size="large"
      text="continue_with"
      shape="rectangular"
    />
  );
}

export function GoogleSignIn({ onCredential, onError, disabled, className }: GoogleSignInProps) {
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/auth/google/config`)
      .then((r) => r.json())
      .then((d) => setClientId(d.clientId || null))
      .catch(() => setClientId(null));
  }, []);

  if (!clientId) return null;

  return (
    <div className={className}>
      <GoogleOAuthProvider clientId={clientId}>
        <div
          className="flex justify-center"
          style={{ opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? "none" : "auto" }}
        >
          <GoogleLoginButton onCredential={onCredential} onError={onError} disabled={disabled} />
        </div>
      </GoogleOAuthProvider>
    </div>
  );
}

export function GoogleSignInDivider({ label = "Or continue with" }: { label?: string }) {
  return (
    <div className="relative my-4">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-current opacity-20" />
      </div>
      <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em] opacity-60">
        <span className="bg-inherit px-3">{label}</span>
      </div>
    </div>
  );
}

export async function corporateGoogleSignIn(idToken: string) {
  const res = await fetch(`${API_URL}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.pending) throw new Error(data.message || "Account pending approval");
    throw new Error(data.message || "Google sign-in failed");
  }
  return data as { token: string; user: { homePath?: string; role: string } };
}
