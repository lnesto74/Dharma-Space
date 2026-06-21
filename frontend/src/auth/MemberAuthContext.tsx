import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SiteMember } from "../lib/member-api";
import { fetchMemberMe } from "../lib/member-api";

const TOKEN_KEY = "dharma_member_token";
const MEMBER_KEY = "dharma_member";

type MemberAuthContextValue = {
  token: string;
  member: SiteMember | null;
  isLoggedIn: boolean;
  login: (token: string, member: SiteMember) => void;
  logout: () => void;
  refreshMember: () => Promise<void>;
};

const MemberAuthContext = createContext<MemberAuthContextValue | null>(null);

export function MemberAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [member, setMember] = useState<SiteMember | null>(() => {
    try {
      const raw = localStorage.getItem(MEMBER_KEY);
      return raw ? (JSON.parse(raw) as SiteMember) : null;
    } catch {
      return null;
    }
  });

  const login = (nextToken: string, nextMember: SiteMember) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(MEMBER_KEY, JSON.stringify(nextMember));
    setToken(nextToken);
    setMember(nextMember);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(MEMBER_KEY);
    setToken("");
    setMember(null);
  };

  const refreshMember = async () => {
    if (!token) return;
    try {
      const { member: next } = await fetchMemberMe(token);
      localStorage.setItem(MEMBER_KEY, JSON.stringify(next));
      setMember(next);
    } catch {
      logout();
    }
  };

  useEffect(() => {
    if (!token) return;
    refreshMember().catch(() => undefined);
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      member,
      isLoggedIn: Boolean(token && member),
      login,
      logout,
      refreshMember
    }),
    [token, member]
  );

  return <MemberAuthContext.Provider value={value}>{children}</MemberAuthContext.Provider>;
}

export function useMemberAuth() {
  const ctx = useContext(MemberAuthContext);
  if (!ctx) throw new Error("useMemberAuth must be used within MemberAuthProvider");
  return ctx;
}
