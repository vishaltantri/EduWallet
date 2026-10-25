"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

export type UserRole = "student" | "university";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  walletAddress: string;
  institutionName?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  /** Set when a stored session turned out to be expired or revoked. */
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => void;
  /** fetch() with the bearer token attached; signs out on a 401. */
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  /** Replace the stored session token, e.g. after a password change. */
  adoptToken: (token: string) => void;
  /** Re-read the signed-in user from the server, e.g. after a wallet migration. */
  refreshUser: () => Promise<void>;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  institutionName?: string;
}

const TOKEN_KEY = "eduwallet_token";
const USER_KEY = "eduwallet_user";

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  // authFetch is handed to effects in pages; keep the token in a ref so the
  // callback identity stays stable and does not re-trigger those effects.
  const tokenRef = useRef<string | null>(null);

  const clearSession = useCallback(() => {
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const applySession = useCallback((nextToken: string, nextUser: User) => {
    tokenRef.current = nextToken;
    setToken(nextToken);
    setUser(nextUser);
    setSessionExpired(false);
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  }, []);

  /**
   * Restore and *validate* the stored session.
   *
   * Tokens live 24h. Previously the client trusted localStorage blindly, so an
   * expired token produced a signed-in shell whose every request 401'd and
   * whose dashboards silently rendered "no credentials". Now the token is
   * checked against the server before the UI commits to it.
   */
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      let savedToken: string | null = null;
      let savedUser: string | null = null;
      try {
        savedToken = localStorage.getItem(TOKEN_KEY);
        savedUser = localStorage.getItem(USER_KEY);
      } catch {
        // Storage can be unavailable (private mode, blocked cookies).
      }

      if (!savedToken || !savedUser) {
        if (!cancelled) setLoading(false);
        return;
      }

      // Show the cached user immediately, then confirm it in the background.
      try {
        const parsed = JSON.parse(savedUser) as User;
        tokenRef.current = savedToken;
        if (!cancelled) {
          setToken(savedToken);
          setUser(parsed);
        }
      } catch {
        clearSession();
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${savedToken}` },
        });
        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          applySession(savedToken, data.user as User);
        } else if (res.status === 401) {
          clearSession();
          setSessionExpired(true);
        }
        // Any other status is a server-side blip: keep the cached session.
      } catch {
        // Offline — keep the cached session rather than logging the user out.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, [applySession, clearSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      applySession(data.token, data.user);
      return data.user as User;
    },
    [applySession]
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      applySession(data.token, data.user);
      return data.user as User;
    },
    [applySession]
  );

  const logout = useCallback(() => {
    clearSession();
    setSessionExpired(false);
  }, [clearSession]);

  const adoptToken = useCallback((nextToken: string) => {
    tokenRef.current = nextToken;
    setToken(nextToken);
    try {
      localStorage.setItem(TOKEN_KEY, nextToken);
    } catch {
      // Storage unavailable; the in-memory token still works for this tab.
    }
  }, []);

  /**
   * Pull the current user back from the server.
   *
   * A social recovery changes the account's wallet address server-side, so
   * the cached copy in localStorage would otherwise keep pointing the
   * dashboard at an address the account no longer uses.
   */
  const refreshUser = useCallback(async () => {
    if (!tokenRef.current) return;
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      applySession(tokenRef.current, data.user as User);
    } catch {
      // Offline; keep what we have.
    }
  }, [applySession]);

  const authFetch = useCallback(
    async (input: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (tokenRef.current) headers.set("Authorization", `Bearer ${tokenRef.current}`);
      if (init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      const res = await fetch(input, { ...init, headers });
      if (res.status === 401) {
        clearSession();
        setSessionExpired(true);
      }
      return res;
    },
    [clearSession]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        sessionExpired,
        login,
        register,
        logout,
        authFetch,
        adoptToken,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
