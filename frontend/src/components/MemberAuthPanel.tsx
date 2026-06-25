import { FormEvent, useState } from "react";
import { ChevronRight } from "lucide-react";
import { memberLogin, memberRegister, memberGoogleLogin } from "../lib/member-api";
import { useMemberAuth } from "../auth/MemberAuthContext";
import { GoogleSignIn, GoogleSignInDivider } from "./GoogleSignIn";

type MemberAuthPanelProps = {
  onSuccess?: () => void;
  compact?: boolean;
};

export function MemberAuthPanel({ onSuccess, compact }: MemberAuthPanelProps) {
  const { login } = useMemberAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const result =
        mode === "login"
          ? await memberLogin(form.email.trim(), form.password)
          : await memberRegister({
              name: form.name.trim(),
              email: form.email.trim(),
              password: form.password,
              phone: form.phone.trim() || undefined
            });
      login(result.token, result.member);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  };

  const handleGoogle = async (credential: string) => {
    setSending(true);
    setError("");
    try {
      const result = await memberGoogleLogin(credential);
      login(result.token, result.member);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={compact ? "p-6" : "p-8"}>
      <p className="text-[11px] tracking-[0.2em] text-[#2A2825]/50 uppercase text-center mb-1" style={{ fontFamily: "var(--font-body)" }}>
        Member account
      </p>
      <p className="text-[13px] text-[#7A7468] text-center mb-4" style={{ fontFamily: "var(--font-body)" }}>
        Sign in or create an account to book classes and events
      </p>
      <div className="flex gap-2 mb-6">
        {(["login", "register"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMode(tab)}
            className={`flex-1 py-2.5 text-[11px] tracking-[0.12em] uppercase border transition-colors ${
              mode === tab
                ? "border-[#C4785A] bg-[#C4785A] text-white"
                : "border-[#2A2825]/15 text-[#2A2825]/60 hover:border-[#C4785A]/40"
            }`}
            style={{ fontFamily: "var(--font-body)" }}
          >
            {tab === "login" ? "Log in" : "Create account"}
          </button>
        ))}
      </div>

      <GoogleSignIn onCredential={handleGoogle} onError={setError} disabled={sending} />
      <GoogleSignInDivider />

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "register" && (
          <div>
            <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={{ fontFamily: "var(--font-body)" }}>Full name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-[#EDE5D8] px-4 py-3 text-[14px] text-[#2A2825] focus:outline-none focus:ring-1 focus:ring-[#C4785A]"
              style={{ fontFamily: "var(--font-body)" }}
            />
          </div>
        )}
        <div>
          <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={{ fontFamily: "var(--font-body)" }}>Email</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full bg-[#EDE5D8] px-4 py-3 text-[14px] text-[#2A2825] focus:outline-none focus:ring-1 focus:ring-[#C4785A]"
            style={{ fontFamily: "var(--font-body)" }}
          />
        </div>
        {mode === "register" && (
          <div>
            <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={{ fontFamily: "var(--font-body)" }}>Phone / WhatsApp</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full bg-[#EDE5D8] px-4 py-3 text-[14px] text-[#2A2825] focus:outline-none focus:ring-1 focus:ring-[#C4785A]"
              style={{ fontFamily: "var(--font-body)" }}
            />
          </div>
        )}
        <div>
          <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={{ fontFamily: "var(--font-body)" }}>Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="w-full bg-[#EDE5D8] px-4 py-3 text-[14px] text-[#2A2825] focus:outline-none focus:ring-1 focus:ring-[#C4785A]"
            style={{ fontFamily: "var(--font-body)" }}
          />
        </div>
        {error && <p className="text-[12px] text-red-500 text-center" style={{ fontFamily: "var(--font-body)" }}>{error}</p>}
        <button
          type="submit"
          disabled={sending}
          className="w-full py-4 bg-[#C4785A] text-white text-[12px] tracking-[0.15em] uppercase hover:bg-[#B86848] transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {sending ? "Please wait…" : mode === "login" ? "Continue" : "Create account & continue"}
          <ChevronRight size={14} />
        </button>
      </form>
    </div>
  );
}
