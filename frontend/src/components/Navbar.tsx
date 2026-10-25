"use client";

import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { NetworkBadge } from "@/components/SystemStatus";

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const copyAddress = async () => {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(user.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the address is visible in the menu anyway.
    }
  };

  const links = useMemo(() => {
    if (!user) {
      return [
        { href: "/verify", label: "Verify a Certificate" },
        { href: "/login", label: "Sign In" },
      ];
    }
    const dashboard =
      user.role === "student" ? "/student/dashboard" : "/university/dashboard";
    return user.role === "student"
      ? [
          { href: dashboard, label: "Dashboard" },
          { href: `/u/${user.walletAddress}`, label: "Public Profile" },
          { href: "/student/recovery", label: "Social Recovery" },
          { href: "/verify", label: "Verify" },
        ]
      : [
          { href: dashboard, label: "Dashboard" },
          { href: "/verify", label: "Verify" },
        ];
  }, [user]);

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-zinc-800 h-16 flex items-center">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white text-black font-bold text-base flex items-center justify-center">
            E
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white tracking-tight">EduWallet</span>
            <NetworkBadge className="hidden sm:flex" />
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                isActive(link.href) ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}

          {user ? (
            <>
              <div className="w-px h-4 bg-zinc-800 mx-2" />
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowUserMenu(!showUserMenu);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-white transition-colors"
                >
                  <span className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-200">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-[10rem] truncate">{user.name}</span>
                </button>

                {showUserMenu && (
                  <div
                    className="absolute right-0 top-full mt-2 w-64 rounded-lg bg-zinc-900 border border-zinc-800 shadow-xl overflow-hidden z-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-4 py-3 border-b border-zinc-800">
                      <p className="text-xs font-semibold text-white truncate">
                        {user.institutionName || user.name}
                      </p>
                      <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
                      <span className="badge badge-info mt-2">{user.role}</span>
                    </div>
                    <button
                      onClick={copyAddress}
                      className="w-full text-left px-4 py-2.5 hover:bg-zinc-800 transition-colors"
                    >
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">
                        {copied ? "Address copied" : "Wallet address"}
                      </p>
                      <p className="text-[11px] font-mono text-zinc-300 truncate">
                        {user.walletAddress}
                      </p>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-xs text-red-400 hover:bg-zinc-800 font-medium transition-colors border-t border-zinc-800"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link href="/register" className="btn-primary !py-1.5 !px-3.5 !text-xs ml-2">
              Get Started →
            </Link>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 text-zinc-400 hover:text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
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
        <div className="md:hidden absolute top-16 left-0 right-0 bg-black border-b border-zinc-800 p-4 space-y-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-md text-sm text-zinc-300 hover:bg-zinc-900"
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <button
              onClick={() => {
                setMobileOpen(false);
                handleLogout();
              }}
              className="w-full text-left px-3 py-2 rounded-md text-sm text-red-400 hover:bg-zinc-900 font-medium"
            >
              Sign Out
            </button>
          ) : (
            <Link
              href="/register"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 text-sm text-white font-semibold"
            >
              Get Started →
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
