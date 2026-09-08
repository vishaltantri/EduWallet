"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type UserRole = "student" | "university";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  walletAddress: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load session from localStorage on mount
  useEffect(() => {
    const restoreSession = () => {
      const savedToken = localStorage.getItem("eduwallet_token");
      const savedUser = localStorage.getItem("eduwallet_user");

      try {
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser) as User);
        } else {
          setToken(null);
          setUser(null);
        }
      } catch {
        localStorage.removeItem("eduwallet_token");
        localStorage.removeItem("eduwallet_user");
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    // Defer the browser-only read until after hydration. This prevents a
    // server/client markup mismatch while still restoring a session promptly.
    const frame = requestAnimationFrame(restoreSession);
    return () => cancelAnimationFrame(frame);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");

    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("eduwallet_token", data.token);
    localStorage.setItem("eduwallet_user", JSON.stringify(data.user));
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string, role: UserRole) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("eduwallet_token", data.token);
      localStorage.setItem("eduwallet_user", JSON.stringify(data.user));
    },
    []
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("eduwallet_token");
    localStorage.removeItem("eduwallet_user");
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
