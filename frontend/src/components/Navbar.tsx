"use client";

import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[rgba(5,10,24,0.8)] border-b border-[rgba(59,130,246,0.1)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
              E
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              EduWallet
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {user ? (
              <>
                <NavLink
                  href={user.role === "student" ? "/student/dashboard" : "/university/dashboard"}
                  active={isActive(user.role === "student" ? "/student/dashboard" : "/university/dashboard")}
                >
                  Dashboard
                </NavLink>
                {user.role === "student" && (
                  <NavLink href="/student/recovery" active={isActive("/student/recovery")}>
                    Recovery
                  </NavLink>
                )}
                <div className="mx-3 w-px h-5 bg-[rgba(59,130,246,0.15)]" />
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-300">{user.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {user.walletAddress?.slice(0, 6)}...{user.walletAddress?.slice(-4)}
                    </p>
                  </div>
                  <span className={`badge ${user.role === "university" ? "badge-valid" : "badge-pending"}`}>
                    {user.role}
                  </span>
                  <button onClick={handleLogout} className="btn-secondary !py-1.5 !px-3 !text-xs">
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <NavLink href="/login" active={isActive("/login")}>
                  Login
                </NavLink>
                <Link href="/register" className="btn-primary !py-2 !px-4 !text-xs ml-2">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-[rgba(59,130,246,0.1)] bg-[rgba(5,10,24,0.95)] backdrop-blur-xl"
          >
            <div className="px-4 py-4 space-y-2">
              {user ? (
                <>
                  <MobileNavLink
                    href={user.role === "student" ? "/student/dashboard" : "/university/dashboard"}
                    onClick={() => setMobileOpen(false)}
                  >
                    Dashboard
                  </MobileNavLink>
                  {user.role === "student" && (
                    <MobileNavLink href="/student/recovery" onClick={() => setMobileOpen(false)}>
                      Recovery
                    </MobileNavLink>
                  )}
                  <button
                    onClick={() => { handleLogout(); setMobileOpen(false); }}
                    className="w-full text-left px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors text-sm"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <MobileNavLink href="/login" onClick={() => setMobileOpen(false)}>Login</MobileNavLink>
                  <MobileNavLink href="/register" onClick={() => setMobileOpen(false)}>Register</MobileNavLink>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
        active
          ? "text-blue-400 bg-blue-500/10"
          : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
      }`}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-3 py-2 rounded-lg text-slate-300 hover:bg-white/5 transition-colors text-sm"
    >
      {children}
    </Link>
  );
}
