"use client";

import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    if (!showUserMenu) return;
    const handleClick = () => setShowUserMenu(false);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [showUserMenu]);

  const handleLogout = () => {
    logout();
    router.push("/");
    setShowUserMenu(false);
  };

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-zinc-800 h-16 flex items-center">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white text-black font-bold text-base flex items-center justify-center">
            E
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white tracking-tight">
              EduWallet
            </span>
            <span className="hidden sm:inline-block text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
              Polygon
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <Link
                href={user.role === "student" ? "/student/dashboard" : "/university/dashboard"}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  isActive(user.role === "student" ? "/student/dashboard" : "/university/dashboard")
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Dashboard
              </Link>

              {user.role === "student" && (
                <Link
                  href="/student/recovery"
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    isActive("/student/recovery")
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Social Recovery
                </Link>
              )}

              <div className="w-px h-4 bg-zinc-800 mx-1" />

              {/* User Dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowUserMenu(!showUserMenu); }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-white transition-colors"
                >
                  <span className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-200">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span>{user.name}</span>
                  <span className="text-zinc-500 text-[10px]">({user.role})</span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-44 rounded-lg bg-zinc-900 border border-zinc-800 shadow-xl overflow-hidden py-1 z-50">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-zinc-800 font-medium transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/verify/demo" className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white font-medium transition-colors">
                Demo Verification
              </Link>
              <Link href="/login" className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white font-medium transition-colors">
                Sign In
              </Link>
              <Link href="/register" className="btn-primary !py-1.5 !px-3.5 !text-xs">
                Get Started →
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 text-zinc-400 hover:text-white"
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

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-black border-b border-zinc-800 p-4 space-y-2">
          {user ? (
            <>
              <Link
                href={user.role === "student" ? "/student/dashboard" : "/university/dashboard"}
                className="block px-3 py-2 rounded-md text-sm text-zinc-300 hover:bg-zinc-900"
                onClick={() => setMobileOpen(false)}
              >
                Dashboard
              </Link>
              {user.role === "student" && (
                <Link
                  href="/student/recovery"
                  className="block px-3 py-2 rounded-md text-sm text-zinc-300 hover:bg-zinc-900"
                  onClick={() => setMobileOpen(false)}
                >
                  Social Recovery
                </Link>
              )}
              <button
                onClick={() => { handleLogout(); setMobileOpen(false); }}
                className="w-full text-left px-3 py-2 rounded-md text-sm text-red-400 hover:bg-zinc-900 font-medium"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link href="/verify/demo" className="block px-3 py-2 text-sm text-zinc-300" onClick={() => setMobileOpen(false)}>Demo Verification</Link>
              <Link href="/login" className="block px-3 py-2 text-sm text-zinc-300" onClick={() => setMobileOpen(false)}>Sign In</Link>
              <Link href="/register" className="block px-3 py-2 text-sm text-white font-semibold" onClick={() => setMobileOpen(false)}>Get Started →</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
