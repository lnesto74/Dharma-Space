import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "";

export type UserType = {
  name: string;
  email: string;
  role: string;
  homePath?: string;
};

export function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem("hsos_token") || "");
  const [user, setUser] = useState<UserType | null>(() => {
    const stored = localStorage.getItem("hsos_user");
    if (!stored) return null;
    try {
      const parsed = JSON.parse(stored) as UserType;
      if (parsed.role === "SUPER_ADMIN") {
        parsed.homePath = "/admin";
      }
      return parsed;
    } catch {
      return null;
    }
  });

  // Validate the saved session against the server. If the token is stale or invalid
  // (e.g. the database was reseeded with new user IDs), clear it so the app shows the
  // login screen instead of silently failing every API call with "Invalid token".
  useEffect(() => {
    if (!token) return;
    let active = true;
    fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!active) return;
        if (res.status === 401) {
          localStorage.removeItem("hsos_token");
          localStorage.removeItem("hsos_user");
          setToken("");
          setUser(null);
        }
      })
      .catch(() => {
        /* Network error — keep the session and let later calls retry. */
      });
    return () => {
      active = false;
    };
  }, [token]);

  const login = (nextToken: string, nextUser: UserType) => {
    const userWithHome = nextUser.role === "SUPER_ADMIN"
      ? { ...nextUser, homePath: "/admin" }
      : nextUser;
    localStorage.setItem("hsos_token", nextToken);
    localStorage.setItem("hsos_user", JSON.stringify(userWithHome));
    setToken(nextToken);
    setUser(userWithHome);
  };

  const logout = () => {
    localStorage.removeItem("hsos_token");
    localStorage.removeItem("hsos_user");
    setToken("");
    setUser(null);
  };

  return { token, user, login, logout };
}
