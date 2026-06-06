import { useState } from "react";

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
